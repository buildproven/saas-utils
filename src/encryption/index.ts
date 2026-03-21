/**
 * saas-utils/encryption
 * Token encryption utilities using AES-256-GCM
 *
 * Encrypts sensitive tokens (OAuth access/refresh, API keys) before storing in database.
 * Uses AES-256-GCM for authenticated encryption with scrypt key derivation.
 *
 * Setup:
 * 1. Generate key: openssl rand -hex 32
 * 2. Add to .env: ENCRYPTION_KEY=your_generated_key
 *
 * Usage:
 *   import { encryptToken, decryptToken } from 'saas-utils/encryption'
 *   const encrypted = await encryptToken(accessToken)
 *   const decrypted = await decryptToken(encrypted)
 */

import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

export interface EncryptionConfig {
  encryptionKey?: string;
}

let globalEncryptionKey: string | null = null;

/**
 * Set the encryption key programmatically (alternative to env var)
 */
export function setEncryptionKey(key: string): void {
  if (key.length !== 64) {
    throw new Error('Encryption key must be exactly 32 bytes (64 hex characters)');
  }
  globalEncryptionKey = key;
}

/**
 * Clear the programmatically set encryption key
 */
export function clearEncryptionKey(): void {
  globalEncryptionKey = null;
}

function getEncryptionKey(): string {
  const encryptionKey = globalEncryptionKey || process.env.ENCRYPTION_KEY;

  if (!encryptionKey) {
    throw new Error(
      'ENCRYPTION_KEY environment variable is required for token encryption. Generate with: openssl rand -hex 32',
    );
  }

  if (encryptionKey.length !== 64) {
    throw new Error(
      'ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters). Generate with: openssl rand -hex 32',
    );
  }

  return encryptionKey;
}

async function deriveKey(masterKey: string, salt: Buffer): Promise<Buffer> {
  const keyBuffer = Buffer.from(masterKey, 'hex');
  return (await scryptAsync(keyBuffer, salt, KEY_LENGTH)) as Buffer;
}

/**
 * Encrypts a token using AES-256-GCM
 * @param token - The plaintext token to encrypt
 * @returns Base64-encoded encrypted token (includes salt, IV, auth tag)
 */
export async function encryptToken(token: string): Promise<string> {
  if (!token) {
    return token;
  }

  try {
    const masterKey = getEncryptionKey();

    const salt = randomBytes(SALT_LENGTH);
    const iv = randomBytes(IV_LENGTH);

    const key = await deriveKey(masterKey, salt);

    const cipher = createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    const combined = Buffer.concat([salt, iv, tag, Buffer.from(encrypted, 'hex')]);

    return combined.toString('base64');
  } catch (error) {
    if (error instanceof Error && error.message.includes('ENCRYPTION_KEY')) {
      throw error;
    }
    console.error('Token encryption failed:', error);
    throw new Error('Failed to encrypt token', { cause: error });
  }
}

/**
 * Decrypts a token encrypted with encryptToken
 * @param encryptedToken - Base64-encoded encrypted token
 * @returns The original plaintext token
 */
export async function decryptToken(encryptedToken: string): Promise<string> {
  if (!encryptedToken) {
    return encryptedToken;
  }

  try {
    const masterKey = getEncryptionKey();

    const combined = Buffer.from(encryptedToken, 'base64');

    const salt = combined.subarray(0, SALT_LENGTH);
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

    const key = await deriveKey(masterKey, salt);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    if (error instanceof Error && error.message.includes('ENCRYPTION_KEY')) {
      throw error;
    }
    console.error('Token decryption failed:', error);
    throw new Error('Failed to decrypt token - token may be corrupted or key changed', {
      cause: error,
    });
  }
}

/**
 * Checks if a value looks like an encrypted token
 * @param value - The value to check
 * @returns True if the value appears to be an encrypted token
 */
export function isEncryptedToken(value: string): boolean {
  if (!value) return false;

  try {
    const buffer = Buffer.from(value, 'base64');
    return buffer.length >= SALT_LENGTH + IV_LENGTH + TAG_LENGTH + 1;
  } catch {
    return false;
  }
}

/**
 * Generates a new encryption key
 * @returns A 32-byte (64 hex character) encryption key
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Re-encrypts a token with a new key (for key rotation)
 * @param encryptedToken - Token encrypted with old key
 * @param oldKey - The old encryption key
 * @param newKey - The new encryption key
 * @returns Token encrypted with new key
 */
export async function rotateTokenEncryption(
  encryptedToken: string,
  oldKey: string,
  newKey: string,
): Promise<string> {
  if (!encryptedToken) {
    return encryptedToken;
  }

  const originalKey = globalEncryptionKey;
  setEncryptionKey(oldKey);

  try {
    const decrypted = await decryptToken(encryptedToken);
    setEncryptionKey(newKey);
    const reencrypted = await encryptToken(decrypted);
    return reencrypted;
  } finally {
    if (originalKey) {
      setEncryptionKey(originalKey);
    } else {
      clearEncryptionKey();
    }
  }
}

/**
 * Encrypts data if not already encrypted, returns as-is if already encrypted
 * Useful for idempotent encryption operations
 */
export async function ensureEncrypted(value: string): Promise<string> {
  if (!value) return value;
  if (isEncryptedToken(value)) return value;
  return encryptToken(value);
}

/**
 * Decrypts data if encrypted, returns as-is if not encrypted
 * Useful for safe decryption operations
 */
export async function ensureDecrypted(value: string): Promise<string> {
  if (!value) return value;
  if (!isEncryptedToken(value)) return value;
  return decryptToken(value);
}
