/**
 * saas-utils/rate-limiter
 * Rate limiting utilities with request deduplication
 *
 * ⚠️ SERVERLESS WARNING:
 * This rate limiter uses in-memory storage (Map). On serverless platforms (Vercel, Lambda),
 * each function instance has its own memory, so rate limits may not be enforced across
 * instances. For production use cases requiring strict rate limiting:
 * - Use Redis-based rate limiting via @upstash/ratelimit
 * - Or configure a shared cache via saas-utils/cache
 *
 * Two modes:
 * 1. Simple: checkRateLimit() for basic per-IP rate limiting
 * 2. Advanced: AdvancedRateLimiter class with deduplication, mutex locking, result caching
 *
 * Usage:
 *   // Simple mode
 *   import { checkRateLimit, getClientId } from 'saas-utils/rate-limiter'
 *   const clientId = getClientId(request)
 *   checkRateLimit(clientId, { requestsPerHour: 100, enabled: true })
 *
 *   // Advanced mode
 *   import { AdvancedRateLimiter } from 'saas-utils/rate-limiter'
 *   const limiter = new AdvancedRateLimiter({ requestsPerMinute: 10 })
 *   const result = await limiter.checkRateLimit(userId)
 */

import crypto from 'crypto';

// ============================================================================
// Simple Rate Limiter (in-memory, per-hour)
// ============================================================================

interface SimpleRateLimitEntry {
  count: number;
  resetTime: number;
}

const simpleRateLimitStore = new Map<string, SimpleRateLimitEntry>();

// Periodic cleanup for simple rate limiter (prevent unbounded growth)
// Runs every 5 minutes, removes entries expired more than 1 hour ago
const SIMPLE_CLEANUP_INTERVAL = 5 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  const expiredThreshold = now - 60 * 60 * 1000; // 1 hour buffer
  for (const [key, entry] of simpleRateLimitStore) {
    if (entry.resetTime < expiredThreshold) {
      simpleRateLimitStore.delete(key);
    }
  }
}, SIMPLE_CLEANUP_INTERVAL).unref(); // unref() allows process to exit without waiting

export interface SimpleRateLimitConfig {
  requestsPerHour: number;
  enabled: boolean;
}

/**
 * Gets the client identifier from request headers
 */
export function getClientId(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');

  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  if (realIp) {
    return realIp;
  }

  return 'local-dev';
}

/**
 * Simple rate limit check - throws if limit exceeded
 */
export function checkRateLimit(clientId: string, config: SimpleRateLimitConfig): void {
  if (!config.enabled) {
    return;
  }

  const now = Date.now();
  const entry = simpleRateLimitStore.get(clientId);

  if (entry && now > entry.resetTime) {
    simpleRateLimitStore.delete(clientId);
  }

  const currentEntry = simpleRateLimitStore.get(clientId);

  if (!currentEntry) {
    simpleRateLimitStore.set(clientId, {
      count: 1,
      resetTime: now + 60 * 60 * 1000,
    });
    return;
  }

  if (currentEntry.count >= config.requestsPerHour) {
    const resetIn = Math.ceil((currentEntry.resetTime - now) / 1000 / 60);
    throw new Error(
      `Rate limit exceeded. Try again in ${resetIn} minutes. Limit: ${config.requestsPerHour} requests/hour.`,
    );
  }

  currentEntry.count += 1;
  simpleRateLimitStore.set(clientId, currentEntry);
}

/**
 * Gets rate limit info for a client
 */
export function getRateLimitInfo(clientId: string, config: SimpleRateLimitConfig) {
  const entry = simpleRateLimitStore.get(clientId);

  if (!entry) {
    return {
      remaining: config.requestsPerHour,
      resetAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };
  }

  return {
    remaining: Math.max(0, config.requestsPerHour - entry.count),
    resetAt: new Date(entry.resetTime).toISOString(),
  };
}

/**
 * Clear rate limit store (useful for testing)
 */
export function clearRateLimitStore(): void {
  simpleRateLimitStore.clear();
}

// ============================================================================
// Advanced Rate Limiter (with deduplication and mutex locking)
// ============================================================================

export interface AdvancedRateLimitConfig {
  requestsPerMinute?: number;
  requestsPerHour?: number;
  dedupCacheTtl?: number;
  cleanupInterval?: number;
  lockTimeout?: number;
  namespace?: string;
}

interface RateLimitRecord {
  count: number;
  resetTime: number;
  lastRequest: number;
  locked: boolean;
}

interface PendingRequest<T = unknown> {
  requestId: string;
  userId: string;
  contentHash: string;
  timestamp: number;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

interface CachedResult<T = unknown> {
  result: T;
  timestamp: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
  reason?: string;
  remaining?: number;
  resetTime?: number;
}

export interface DeduplicationResult<T = unknown> {
  isDuplicate: boolean;
  requestId: string;
  existingResult?: T;
}

export interface UserStatus {
  requestsRemaining: number;
  resetTime: number;
  isLimited: boolean;
}

export interface RateLimiterStats {
  activeUsers: number;
  pendingRequests: number;
  cachedResults: number;
  timestamp: number;
}

export class AdvancedRateLimiter<T = unknown> {
  private userLimits = new Map<string, RateLimitRecord>();
  private pendingRequests = new Map<string, PendingRequest<T>>();
  private completedRequests = new Map<string, CachedResult<T>>();
  private cleanupIntervalHandle: ReturnType<typeof setInterval> | null = null;

  private readonly requestsPerMinute: number;
  private readonly requestsPerHour: number;
  private readonly dedupCacheTtl: number;
  private readonly cleanupInterval: number;
  private readonly lockTimeout: number;
  private readonly namespace: string;

  constructor(config: AdvancedRateLimitConfig = {}) {
    this.requestsPerMinute = config.requestsPerMinute ?? 3;
    this.requestsPerHour = config.requestsPerHour ?? 10;
    this.dedupCacheTtl = config.dedupCacheTtl ?? 5 * 60 * 1000;
    this.cleanupInterval = config.cleanupInterval ?? 60 * 1000;
    this.lockTimeout = config.lockTimeout ?? 1000;
    this.namespace = config.namespace ?? 'default';

    this.cleanupIntervalHandle = setInterval(() => this.cleanup(), this.cleanupInterval);
  }

  destroy(): void {
    if (this.cleanupIntervalHandle) {
      clearInterval(this.cleanupIntervalHandle);
      this.cleanupIntervalHandle = null;
    }
    this.userLimits.clear();
    this.pendingRequests.clear();
    this.completedRequests.clear();
  }

  private async acquireLock(key: string): Promise<boolean> {
    const startTime = Date.now();
    const maxIterations = Math.ceil(this.lockTimeout / 10) + 10;

    for (let i = 0; i < maxIterations; i++) {
      const record = this.userLimits.get(key);

      if (!record) return true;

      if (!record.locked) {
        record.locked = true;
        this.userLimits.set(key, record);
        return true;
      }

      if (Date.now() - startTime > this.lockTimeout) {
        record.locked = false;
        this.userLimits.set(key, record);
        return true;
      }

      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    return true;
  }

  private releaseLock(key: string): void {
    const record = this.userLimits.get(key);
    if (record) {
      record.locked = false;
      this.userLimits.set(key, record);
    }
  }

  async checkRateLimit(userId: string): Promise<RateLimitResult> {
    const isTestEnv = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
    const enforceInTests = process.env.ENFORCE_RATE_LIMIT_TESTS === 'true';

    if (isTestEnv && !enforceInTests) {
      return { allowed: true, remaining: this.requestsPerMinute };
    }

    const now = Date.now();
    const userKey = `${this.namespace}:${userId}`;

    await this.acquireLock(userKey);

    try {
      let record = this.userLimits.get(userKey);

      if (!record) {
        record = {
          count: 1,
          resetTime: now + 60 * 1000,
          lastRequest: now,
          locked: false,
        };
        this.userLimits.set(userKey, record);
        return {
          allowed: true,
          remaining: this.requestsPerMinute - 1,
          resetTime: record.resetTime,
        };
      }

      if (now >= record.resetTime) {
        record.count = 1;
        record.resetTime = now + 60 * 1000;
        record.lastRequest = now;
        this.userLimits.set(userKey, record);
        return {
          allowed: true,
          remaining: this.requestsPerMinute - 1,
          resetTime: record.resetTime,
        };
      }

      if (record.count >= this.requestsPerMinute) {
        const retryAfter = Math.ceil((record.resetTime - now) / 1000);
        return {
          allowed: false,
          retryAfter,
          reason: `Rate limit exceeded: ${this.requestsPerMinute} requests per minute. Try again in ${retryAfter}s.`,
          remaining: 0,
          resetTime: record.resetTime,
        };
      }

      const hourAgo = now - 60 * 60 * 1000;
      if (record.lastRequest > hourAgo && record.count >= this.requestsPerHour) {
        return {
          allowed: false,
          retryAfter: 3600,
          reason: `Hourly limit reached: ${this.requestsPerHour} requests per hour. Try again later.`,
          remaining: 0,
          resetTime: now + 3600 * 1000,
        };
      }

      record.count++;
      record.lastRequest = now;
      this.userLimits.set(userKey, record);

      return {
        allowed: true,
        remaining: Math.max(0, this.requestsPerMinute - record.count),
        resetTime: record.resetTime,
      };
    } finally {
      this.releaseLock(userKey);
    }
  }

  generateContentHash(userId: string, content: string | object): string {
    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
    return crypto
      .createHash('sha256')
      .update(`${userId}:${contentStr}`)
      .digest('hex')
      .substring(0, 16);
  }

  async handleDeduplication(
    userId: string,
    content: string | object,
  ): Promise<DeduplicationResult<T>> {
    const contentHash = this.generateContentHash(userId, content);
    const requestId = `${userId}:${contentHash}`;

    const existingResult = this.completedRequests.get(requestId);
    if (existingResult) {
      const age = Date.now() - existingResult.timestamp;
      if (age < this.dedupCacheTtl) {
        return {
          isDuplicate: true,
          requestId,
          existingResult: existingResult.result,
        };
      } else {
        this.completedRequests.delete(requestId);
      }
    }

    const pendingRequest = this.pendingRequests.get(requestId);
    if (pendingRequest) {
      return new Promise((resolve, reject) => {
        const originalResolve = pendingRequest.resolve;
        const originalReject = pendingRequest.reject;

        pendingRequest.resolve = (result) => {
          originalResolve(result);
          resolve({ isDuplicate: true, requestId, existingResult: result });
        };

        pendingRequest.reject = (error) => {
          originalReject(error);
          reject(error);
        };
      });
    }

    return { isDuplicate: false, requestId };
  }

  registerPendingRequest(
    requestId: string,
    userId: string,
    contentHash: string,
  ): {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (error: unknown) => void;
  } {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;

    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    const pendingRequest: PendingRequest<T> = {
      requestId,
      userId,
      contentHash,
      timestamp: Date.now(),
      resolve,
      reject,
    };

    this.pendingRequests.set(requestId, pendingRequest);

    return { promise, resolve, reject };
  }

  completePendingRequest(requestId: string, result: T): void {
    const pendingRequest = this.pendingRequests.get(requestId);
    if (pendingRequest) {
      pendingRequest.resolve(result);
      this.pendingRequests.delete(requestId);

      this.completedRequests.set(requestId, {
        result,
        timestamp: Date.now(),
      });
    }
  }

  failPendingRequest(requestId: string, error: unknown): void {
    const pendingRequest = this.pendingRequests.get(requestId);
    if (pendingRequest) {
      pendingRequest.reject(error);
      this.pendingRequests.delete(requestId);
    }
  }

  getUserStatus(userId: string): UserStatus {
    const now = Date.now();
    const userKey = `${this.namespace}:${userId}`;
    const record = this.userLimits.get(userKey);

    if (!record || now >= record.resetTime) {
      return {
        requestsRemaining: this.requestsPerMinute,
        resetTime: now + 60 * 1000,
        isLimited: false,
      };
    }

    const remaining = Math.max(0, this.requestsPerMinute - record.count);
    return {
      requestsRemaining: remaining,
      resetTime: record.resetTime,
      isLimited: remaining === 0,
    };
  }

  getStats(): RateLimiterStats {
    return {
      activeUsers: this.userLimits.size,
      pendingRequests: this.pendingRequests.size,
      cachedResults: this.completedRequests.size,
      timestamp: Date.now(),
    };
  }

  private cleanup(): void {
    const now = Date.now();

    Array.from(this.userLimits.entries()).forEach(([key, record]) => {
      if (now >= record.resetTime + 60 * 1000) {
        this.userLimits.delete(key);
      }
    });

    Array.from(this.pendingRequests.entries()).forEach(([key, request]) => {
      if (now - request.timestamp > 5 * 60 * 1000) {
        request.reject(new Error('Request timeout'));
        this.pendingRequests.delete(key);
      }
    });

    Array.from(this.completedRequests.entries()).forEach(([key, result]) => {
      if (now - result.timestamp > this.dedupCacheTtl) {
        this.completedRequests.delete(key);
      }
    });
  }
}

export function createRateLimiter<T = unknown>(
  config?: AdvancedRateLimitConfig,
): AdvancedRateLimiter<T> {
  return new AdvancedRateLimiter<T>(config);
}
