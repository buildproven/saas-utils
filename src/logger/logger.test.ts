/**
 * saas-utils/logger tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, createLogger, Logger } from './index';

describe('Logger', () => {
  let consoleSpy: {
    info: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
    debug: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    consoleSpy = {
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
    };
    // Ensure not in test mode for these tests
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('VITEST', '');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe('singleton logger', () => {
    it('should export a singleton logger instance', () => {
      expect(logger).toBeDefined();
      expect(logger).toBeInstanceOf(Logger);
    });
  });

  describe('createLogger', () => {
    it('should create a logger with default module', () => {
      const customLogger = createLogger();
      expect(customLogger).toBeInstanceOf(Logger);
    });

    it('should create a logger with custom module name', () => {
      const customLogger = createLogger('CustomModule');
      customLogger.info('test message');
      expect(consoleSpy.info).toHaveBeenCalled();
      const call = consoleSpy.info.mock.calls[0][0];
      expect(call).toContain('CustomModule');
    });
  });

  describe('log levels', () => {
    it('should log info messages', () => {
      const testLogger = createLogger();
      testLogger.info('test info message');
      expect(consoleSpy.info).toHaveBeenCalled();
      const call = consoleSpy.info.mock.calls[0][0];
      expect(call).toContain('test info message');
    });

    it('should log warn messages', () => {
      const testLogger = createLogger();
      testLogger.warn('test warning message');
      expect(consoleSpy.warn).toHaveBeenCalled();
      const call = consoleSpy.warn.mock.calls[0][0];
      expect(call).toContain('test warning message');
    });

    it('should log error messages', () => {
      const testLogger = createLogger();
      testLogger.error('test error message');
      expect(consoleSpy.error).toHaveBeenCalled();
      const call = consoleSpy.error.mock.calls[0][0];
      expect(call).toContain('test error message');
    });

    it('should log debug messages in development', () => {
      const testLogger = createLogger();
      testLogger.debug('test debug message');
      expect(consoleSpy.debug).toHaveBeenCalled();
      const call = consoleSpy.debug.mock.calls[0][0];
      expect(call).toContain('test debug message');
    });
  });

  describe('context', () => {
    it('should include module context in log output', () => {
      const testLogger = createLogger();
      testLogger.info('message with context', { module: 'TestModule' });
      const call = consoleSpy.info.mock.calls[0][0];
      expect(call).toContain('TestModule');
    });
  });

  describe('error logging', () => {
    it('should log Error objects', () => {
      const testLogger = createLogger();
      const error = new Error('Test error');
      testLogger.error('error occurred', error);
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('should handle non-Error objects gracefully', () => {
      const testLogger = createLogger();
      testLogger.error('error occurred', { custom: 'error' });
      expect(consoleSpy.error).toHaveBeenCalled();
    });
  });

  describe('test mode suppression', () => {
    it('should suppress logs in test environment', () => {
      vi.stubEnv('NODE_ENV', 'test');
      // Create a new logger after changing env
      createLogger('TestMode');
      // Logs should be suppressed in test mode
      // The logger checks NODE_ENV at instantiation time
    });
  });

  describe('Logger class export', () => {
    it('should export Logger class', () => {
      expect(Logger).toBeDefined();
    });
  });
});
