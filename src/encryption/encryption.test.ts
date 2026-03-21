/**
 * saas-utils/encryption tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  encryptToken,
  decryptToken,
  isEncryptedToken,
  generateEncryptionKey,
  rotateTokenEncryption,
  ensureEncrypted,
  ensureDecrypted,
  setEncryptionKey,
  clearEncryptionKey,
} from './index';

describe('Encryption', () => {
  const testKey = 'a'.repeat(64); // 32 bytes = 64 hex chars

  beforeEach(() => {
    clearEncryptionKey();
    vi.stubEnv('ENCRYPTION_KEY', testKey);
  });

  afterEach(() => {
    clearEncryptionKey();
    vi.unstubAllEnvs();
  });

  describe('generateEncryptionKey', () => {
    it('should generate a 64-character hex string', () => {
      const key = generateEncryptionKey();
      expect(key).toHaveLength(64);
      expect(/^[0-9a-f]+$/.test(key)).toBe(true);
    });

    it('should generate unique keys', () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();
      expect(key1).not.toBe(key2);
    });
  });

  describe('setEncryptionKey', () => {
    it('should accept valid 64-char key', () => {
      clearEncryptionKey();
      expect(() => setEncryptionKey(testKey)).not.toThrow();
    });

    it('should reject invalid key length', () => {
      expect(() => setEncryptionKey('short')).toThrow('32 bytes');
    });
  });

  describe('encryptToken', () => {
    it('should encrypt a token', async () => {
      const token = 'my-secret-token';
      const encrypted = await encryptToken(token);
      expect(encrypted).not.toBe(token);
      expect(encrypted.length).toBeGreaterThan(token.length);
    });

    it('should return empty string for empty input', async () => {
      const result = await encryptToken('');
      expect(result).toBe('');
    });

    it('should produce different ciphertext each time (random IV)', async () => {
      const token = 'same-token';
      const encrypted1 = await encryptToken(token);
      const encrypted2 = await encryptToken(token);
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should throw without encryption key', async () => {
      vi.unstubAllEnvs();
      clearEncryptionKey();
      await expect(encryptToken('token')).rejects.toThrow('ENCRYPTION_KEY');
    });
  });

  describe('decryptToken', () => {
    it('should decrypt an encrypted token', async () => {
      const original = 'my-secret-token';
      const encrypted = await encryptToken(original);
      const decrypted = await decryptToken(encrypted);
      expect(decrypted).toBe(original);
    });

    it('should return empty string for empty input', async () => {
      const result = await decryptToken('');
      expect(result).toBe('');
    });

    it('should handle unicode characters', async () => {
      const original = '🔐 Secret 日本語 Token';
      const encrypted = await encryptToken(original);
      const decrypted = await decryptToken(encrypted);
      expect(decrypted).toBe(original);
    });

    it('should throw for corrupted token', async () => {
      await expect(decryptToken('invalid-base64')).rejects.toThrow();
    });
  });

  describe('isEncryptedToken', () => {
    it('should return true for encrypted tokens', async () => {
      const encrypted = await encryptToken('test');
      expect(isEncryptedToken(encrypted)).toBe(true);
    });

    it('should return false for plain text', () => {
      expect(isEncryptedToken('plain-text')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isEncryptedToken('')).toBe(false);
    });

    it('should return false for short base64', () => {
      expect(isEncryptedToken('YWJj')).toBe(false);
    });
  });

  describe('rotateTokenEncryption', () => {
    it('should re-encrypt with new key', async () => {
      const oldKey = 'b'.repeat(64);
      const newKey = 'c'.repeat(64);

      setEncryptionKey(oldKey);
      const original = 'secret-data';
      const encryptedOld = await encryptToken(original);

      const encryptedNew = await rotateTokenEncryption(encryptedOld, oldKey, newKey);

      setEncryptionKey(newKey);
      const decrypted = await decryptToken(encryptedNew);
      expect(decrypted).toBe(original);
    });

    it('should return empty string for empty input', async () => {
      const result = await rotateTokenEncryption('', 'a'.repeat(64), 'b'.repeat(64));
      expect(result).toBe('');
    });
  });

  describe('ensureEncrypted', () => {
    it('should encrypt plain text', async () => {
      const result = await ensureEncrypted('plain');
      expect(isEncryptedToken(result)).toBe(true);
    });

    it('should not double-encrypt', async () => {
      const encrypted = await encryptToken('data');
      const result = await ensureEncrypted(encrypted);
      const decrypted = await decryptToken(result);
      expect(decrypted).toBe('data');
    });

    it('should handle empty string', async () => {
      const result = await ensureEncrypted('');
      expect(result).toBe('');
    });
  });

  describe('ensureDecrypted', () => {
    it('should decrypt encrypted text', async () => {
      const encrypted = await encryptToken('secret');
      const result = await ensureDecrypted(encrypted);
      expect(result).toBe('secret');
    });

    it('should return plain text as-is', async () => {
      const result = await ensureDecrypted('plain-text');
      expect(result).toBe('plain-text');
    });

    it('should handle empty string', async () => {
      const result = await ensureDecrypted('');
      expect(result).toBe('');
    });
  });
});

describe('Edge Cases', () => {
  const testKey = 'a'.repeat(64);

  beforeEach(() => {
    clearEncryptionKey();
    vi.stubEnv('ENCRYPTION_KEY', testKey);
  });

  afterEach(() => {
    clearEncryptionKey();
    vi.unstubAllEnvs();
  });

  describe('Token Content Edge Cases', () => {
    it('should handle very long tokens (10KB)', async () => {
      const longToken = 'x'.repeat(10240);
      const encrypted = await encryptToken(longToken);
      const decrypted = await decryptToken(encrypted);
      expect(decrypted).toBe(longToken);
    });

    it('should handle tokens with newlines', async () => {
      const multiline = 'line1\nline2\r\nline3';
      const encrypted = await encryptToken(multiline);
      const decrypted = await decryptToken(encrypted);
      expect(decrypted).toBe(multiline);
    });

    it('should handle tokens with null bytes', async () => {
      const withNull = 'before\x00after';
      const encrypted = await encryptToken(withNull);
      const decrypted = await decryptToken(encrypted);
      expect(decrypted).toBe(withNull);
    });

    it('should handle JSON tokens', async () => {
      const jsonToken = JSON.stringify({
        access_token: 'abc',
        expires_in: 3600,
      });
      const encrypted = await encryptToken(jsonToken);
      const decrypted = await decryptToken(encrypted);
      expect(JSON.parse(decrypted)).toEqual({
        access_token: 'abc',
        expires_in: 3600,
      });
    });

    it('should handle OAuth-style tokens with special chars', async () => {
      const oauthToken = 'ya29.a0AfH6SMB_token+with/special=chars&more=stuff';
      const encrypted = await encryptToken(oauthToken);
      const decrypted = await decryptToken(encrypted);
      expect(decrypted).toBe(oauthToken);
    });
  });

  describe('Key Edge Cases', () => {
    it('should accept any 64-char string as key', () => {
      // Implementation only validates length, not hex format
      const anyKey = 'x'.repeat(64);
      expect(() => setEncryptionKey(anyKey)).not.toThrow();
    });

    it('should accept mixed case hex key', () => {
      const mixedKey = 'aAbBcCdDeEfF'.repeat(5) + 'aabb';
      expect(() => setEncryptionKey(mixedKey)).not.toThrow();
    });
  });

  describe('Decryption Error Cases', () => {
    it('should throw for truncated ciphertext', async () => {
      const encrypted = await encryptToken('test');
      const truncated = encrypted.substring(0, encrypted.length - 10);
      await expect(decryptToken(truncated)).rejects.toThrow();
    });

    it('should throw for modified ciphertext (tampered)', async () => {
      const encrypted = await encryptToken('test');
      // Modify the auth tag portion (after salt+iv, bytes 48-64 = base64 chars ~64-85)
      // Change a character that's definitely part of the ciphertext/tag
      const tagIndex = 70; // Well into the tag/ciphertext area
      const originalChar = encrypted[tagIndex];
      // Replace with a different valid base64 character
      const newChar = originalChar === 'A' ? 'B' : 'A';
      const tampered =
        encrypted.substring(0, tagIndex) + newChar + encrypted.substring(tagIndex + 1);
      await expect(decryptToken(tampered)).rejects.toThrow();
    });

    it('should throw for wrong key', async () => {
      const encrypted = await encryptToken('test');
      setEncryptionKey('b'.repeat(64));
      await expect(decryptToken(encrypted)).rejects.toThrow();
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle 10 concurrent encrypt operations', async () => {
      const promises = Array(10)
        .fill(null)
        .map((_, i) => encryptToken(`token-${i}`));

      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
      results.forEach((r) => expect(r.length).toBeGreaterThan(0));
    }, 30000);

    it('should handle 10 concurrent decrypt operations', async () => {
      const encrypted = await encryptToken('shared-token');
      const promises = Array(10)
        .fill(null)
        .map(() => decryptToken(encrypted));

      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
      results.forEach((r) => expect(r).toBe('shared-token'));
    }, 30000);
  });
});

describe('Stress Tests', () => {
  const testKey = 'a'.repeat(64);

  beforeEach(() => {
    clearEncryptionKey();
    vi.stubEnv('ENCRYPTION_KEY', testKey);
  });

  afterEach(() => {
    clearEncryptionKey();
    vi.unstubAllEnvs();
  });

  it('should handle 5 sequential encrypt/decrypt cycles', async () => {
    for (let i = 0; i < 5; i++) {
      const original = `token-${i}-${Date.now()}`;
      const encrypted = await encryptToken(original);
      const decrypted = await decryptToken(encrypted);
      expect(decrypted).toBe(original);
    }
  }, 30000);

  it('should generate unique ciphertext for identical plaintext', async () => {
    const token = 'identical-token';
    const encrypted = new Set<string>();

    for (let i = 0; i < 5; i++) {
      encrypted.add(await encryptToken(token));
    }

    // All 5 should be unique due to random IV/salt
    expect(encrypted.size).toBe(5);
  }, 30000);
});
