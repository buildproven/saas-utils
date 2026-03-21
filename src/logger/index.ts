/**
 * saas-utils/logger
 * Structured logger for operational logging
 *
 * Usage:
 *   import { logger } from 'saas-utils/logger'
 *   logger.info('User created', { module: 'UserService', userId: '123' })
 */

export interface LogContext {
  module?: string;
  [key: string]: unknown;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private isTest =
    process.env.NODE_ENV === 'test' ||
    process.env.VITEST === 'true' ||
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT === true;

  /**
   * Log informational messages (startup, configuration, cache hits/misses)
   */
  info(message: string, context?: LogContext): void {
    if (this.isTest) return;
    const prefix = context?.module ? `[${context.module}]` : '';
    console.info(`${prefix} ${message}`);
  }

  /**
   * Log warning messages (non-critical issues, fallbacks)
   */
  warn(message: string, context?: LogContext): void {
    if (this.isTest) return;
    const prefix = context?.module ? `[${context.module}]` : '';
    console.warn(`${prefix} ${message}`);
  }

  /**
   * Log error messages (failures, exceptions)
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (this.isTest) return;
    const prefix = context?.module ? `[${context.module}]` : '';
    console.error(`${prefix} ${message}`, error || '');
  }

  /**
   * Log debug messages (only in development)
   */
  debug(message: string, context?: LogContext): void {
    if (this.isTest || !this.isDevelopment) return;
    const prefix = context?.module ? `[${context.module}]` : '';
    console.debug(`${prefix} ${message}`);
  }
}

export const logger = new Logger();

/**
 * Create a new logger instance with a default module name
 */
export function createLogger(module?: string): Logger {
  const log = new Logger();
  if (module) {
    // Wrap methods to include module context
    const originalInfo = log.info.bind(log);
    const originalWarn = log.warn.bind(log);
    const originalError = log.error.bind(log);
    const originalDebug = log.debug.bind(log);

    log.info = (message: string, context?: LogContext) =>
      originalInfo(message, { ...context, module });
    log.warn = (message: string, context?: LogContext) =>
      originalWarn(message, { ...context, module });
    log.error = (message: string, error?: Error | unknown, context?: LogContext) =>
      originalError(message, error, { ...context, module });
    log.debug = (message: string, context?: LogContext) =>
      originalDebug(message, { ...context, module });
  }
  return log;
}

export { Logger };
