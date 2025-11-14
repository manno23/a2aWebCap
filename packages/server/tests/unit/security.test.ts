/**
 * Security Tests - Rate Limiting and Input Sanitization
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RateLimiter, RateLimitError } from '../../src/rate-limiter';
import { InputSanitizer } from '../../src/input-sanitizer';
import { createTestMessage, wait } from '../utils';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter({
      points: 5, // 5 requests
      duration: 60, // per 60 seconds
      blockDuration: 30 // block for 30 seconds
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests within limit', async () => {
      await rateLimiter.consume('user1');
      await rateLimiter.consume('user1');
      await rateLimiter.consume('user1');

      expect(rateLimiter.getRemainingPoints('user1')).toBe(2);
    });

    it('should reject requests exceeding limit', async () => {
      // Consume all points
      await rateLimiter.consume('user1');
      await rateLimiter.consume('user1');
      await rateLimiter.consume('user1');
      await rateLimiter.consume('user1');
      await rateLimiter.consume('user1');

      // Next request should fail
      await expect(rateLimiter.consume('user1')).rejects.toThrow(RateLimitError);
    });

    it('should track different users separately', async () => {
      await rateLimiter.consume('user1');
      await rateLimiter.consume('user1');
      await rateLimiter.consume('user2');

      expect(rateLimiter.getRemainingPoints('user1')).toBe(3);
      expect(rateLimiter.getRemainingPoints('user2')).toBe(4);
    });

    it('should reset after time window', async () => {
      const shortLimiter = new RateLimiter({
        points: 2,
        duration: 1 // 1 second
      });

      await shortLimiter.consume('user1');
      await shortLimiter.consume('user1');

      // Should be at limit
      expect(shortLimiter.getRemainingPoints('user1')).toBe(0);

      // Wait for reset
      await wait(1100);

      // Should be reset
      expect(shortLimiter.getRemainingPoints('user1')).toBe(2);
      await shortLimiter.consume('user1');
      expect(shortLimiter.getRemainingPoints('user1')).toBe(1);
    });

    it('should block user after exceeding limit', async () => {
      // Exceed limit
      for (let i = 0; i < 5; i++) {
        await rateLimiter.consume('user1');
      }

      await expect(rateLimiter.consume('user1')).rejects.toThrow(RateLimitError);

      expect(rateLimiter.isBlocked('user1')).toBe(true);
    });

    it('should unblock after block duration', async () => {
      const shortBlockLimiter = new RateLimiter({
        points: 1,
        duration: 10,
        blockDuration: 1 // 1 second block
      });

      await shortBlockLimiter.consume('user1');
      await expect(shortBlockLimiter.consume('user1')).rejects.toThrow();

      expect(shortBlockLimiter.isBlocked('user1')).toBe(true);

      // Wait for unblock
      await wait(1100);

      expect(shortBlockLimiter.isBlocked('user1')).toBe(false);
    });

    it('should consume multiple points at once', async () => {
      await rateLimiter.consume('user1', 3);

      expect(rateLimiter.getRemainingPoints('user1')).toBe(2);
    });

    it('should reset rate limit for user', async () => {
      await rateLimiter.consume('user1');
      await rateLimiter.consume('user1');

      expect(rateLimiter.getRemainingPoints('user1')).toBe(3);

      rateLimiter.reset('user1');

      expect(rateLimiter.getRemainingPoints('user1')).toBe(5);
    });

    it('should clear all rate limits', async () => {
      await rateLimiter.consume('user1');
      await rateLimiter.consume('user2');

      expect(rateLimiter.getEntryCount()).toBe(2);

      rateLimiter.clearAll();

      expect(rateLimiter.getEntryCount()).toBe(0);
      expect(rateLimiter.getRemainingPoints('user1')).toBe(5);
    });

    it('should include retry-after in error', async () => {
      for (let i = 0; i < 5; i++) {
        await rateLimiter.consume('user1');
      }

      try {
        await rateLimiter.consume('user1');
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(RateLimitError);
        expect(error.retryAfter).toBeGreaterThan(0);
      }
    });
  });
});

describe('InputSanitizer', () => {
  let sanitizer: InputSanitizer;

  beforeEach(() => {
    sanitizer = new InputSanitizer();
  });

  describe('Message Sanitization', () => {
    it('should sanitize valid message', () => {
      const message = createTestMessage('Hello, world!');

      const sanitized = sanitizer.sanitizeMessage(message);

      expect(sanitized.messageId).toBe(message.messageId);
      expect(sanitized.role).toBe('user');
      expect(sanitized.parts).toHaveLength(1);
      expect(sanitized.parts[0]).toEqual(message.parts[0]);
    });

    it('should reject message without messageId', () => {
      const message: any = { role: 'user', parts: [] };

      expect(() => sanitizer.sanitizeMessage(message)).toThrow('Invalid messageId');
    });

    it('should reject message with invalid role', () => {
      const message: any = {
        messageId: 'msg-1',
        role: 'invalid',
        parts: []
      };

      expect(() => sanitizer.sanitizeMessage(message)).toThrow('Invalid role');
    });

    it('should reject message with too many parts', () => {
      const parts = Array.from({ length: 101 }, (_, i) => ({
        kind: 'text' as const,
        text: `Part ${i}`
      }));

      const message: any = {
        messageId: 'msg-1',
        role: 'user',
        parts
      };

      expect(() => sanitizer.sanitizeMessage(message)).toThrow('Too many parts');
    });

    it('should sanitize contextId and taskId', () => {
      const message = createTestMessage('Test', {
        contextId: 'ctx-123\0null-byte',
        taskId: 'task-456\x00control-char'
      });

      const sanitized = sanitizer.sanitizeMessage(message);

      expect(sanitized.contextId).not.toContain('\0');
      expect(sanitized.taskId).not.toContain('\x00');
    });

    it('should sanitize metadata', () => {
      const message = createTestMessage('Test', {
        metadata: {
          key1: 'value1',
          key2: 123,
          key3: true,
          key4: null
        }
      });

      const sanitized = sanitizer.sanitizeMessage(message);

      expect(sanitized.metadata).toBeDefined();
      expect(sanitized.metadata!.key1).toBe('value1');
      expect(sanitized.metadata!.key2).toBe(123);
      expect(sanitized.metadata!.key3).toBe(true);
      expect(sanitized.metadata!.key4).toBe(null);
    });
  });

  describe('Text Part Sanitization', () => {
    it('should remove null bytes from text', () => {
      const message = createTestMessage('Hello\0World');

      const sanitized = sanitizer.sanitizeMessage(message);

      expect(sanitized.parts[0]).toHaveProperty('text', 'HelloWorld');
    });

    it('should reject text that is too long', () => {
      const longText = 'A'.repeat(600 * 1024); // 600KB (exceeds 512KB limit)
      const message = createTestMessage(longText);

      expect(() => sanitizer.sanitizeMessage(message)).toThrow('Text too long');
    });

    it('should reject non-string text', () => {
      const message: any = {
        messageId: 'msg-1',
        role: 'user',
        parts: [{ kind: 'text', text: 123 }]
      };

      expect(() => sanitizer.sanitizeMessage(message)).toThrow('Text must be a string');
    });
  });

  describe('File Part Sanitization', () => {
    it('should sanitize filename', () => {
      const message: any = {
        messageId: 'msg-1',
        role: 'user',
        parts: [
          {
            kind: 'file',
            file: {
              name: '../../../etc/passwd',
              bytes: 'base64data'
            }
          }
        ]
      };

      const sanitized = sanitizer.sanitizeMessage(message);
      const filePart: any = sanitized.parts[0];

      // Should not contain path separators
      expect(filePart.file.name).not.toContain('/');
      expect(filePart.file.name).not.toContain('\\');
      expect(filePart.file.name).not.toContain(':');
      // Leading dots should be removed
      expect(filePart.file.name).not.toMatch(/^\.+/);
    });

    it('should sanitize filename with null bytes', () => {
      const message: any = {
        messageId: 'msg-1',
        role: 'user',
        parts: [
          {
            kind: 'file',
            file: {
              name: 'file\0name.txt',
              bytes: 'data'
            }
          }
        ]
      };

      const sanitized = sanitizer.sanitizeMessage(message);
      const filePart: any = sanitized.parts[0];

      expect(filePart.file.name).not.toContain('\0');
      expect(filePart.file.name).toBe('file_name.txt');
    });

    it('should validate MIME type', () => {
      const message: any = {
        messageId: 'msg-1',
        role: 'user',
        parts: [
          {
            kind: 'file',
            file: {
              name: 'file.txt',
              mimeType: 'invalid-mime',
              bytes: 'data'
            }
          }
        ]
      };

      expect(() => sanitizer.sanitizeMessage(message)).toThrow('Invalid MIME type');
    });

    it('should reject dangerous URI schemes', () => {
      const dangerousUris = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'vbscript:msgbox(1)'
      ];

      for (const uri of dangerousUris) {
        const message: any = {
          messageId: 'msg-1',
          role: 'user',
          parts: [
            {
              kind: 'file',
              file: {
                name: 'file.txt',
                uri
              }
            }
          ]
        };

        expect(() => sanitizer.sanitizeMessage(message)).toThrow(); // Should throw an error
      }
    });

    it('should allow safe URI schemes', () => {
      const safeUris = [
        'https://example.com/file.txt',
        'http://localhost:8080/file.pdf',
        'file:///tmp/test.txt'
      ];

      for (const uri of safeUris) {
        const message: any = {
          messageId: 'msg-1',
          role: 'user',
          parts: [
            {
              kind: 'file',
              file: {
                name: 'file.txt',
                uri
              }
            }
          ]
        };

        const sanitized = sanitizer.sanitizeMessage(message);
        const filePart: any = sanitized.parts[0];

        expect(filePart.file.uri).toContain(uri.split(':')[0]);
      }
    });

    it('should use default filename for invalid names', () => {
      const message: any = {
        messageId: 'msg-1',
        role: 'user',
        parts: [
          {
            kind: 'file',
            file: {
              name: '...', // Only dots
              bytes: 'data'
            }
          }
        ]
      };

      const sanitized = sanitizer.sanitizeMessage(message);
      const filePart: any = sanitized.parts[0];

      expect(filePart.file.name).toBe('unnamed_file');
    });
  });

  describe('Data Part Sanitization', () => {
    it('should allow JSON-serializable data', () => {
      const message: any = {
        messageId: 'msg-1',
        role: 'user',
        parts: [
          {
            kind: 'data',
            data: { key: 'value', number: 123, array: [1, 2, 3] }
          }
        ]
      };

      const sanitized = sanitizer.sanitizeMessage(message);
      expect(sanitized.parts[0]).toBeDefined();
    });

    it('should reject non-serializable data', () => {
      const circular: any = {};
      circular.self = circular;

      const message: any = {
        messageId: 'msg-1',
        role: 'user',
        parts: [
          {
            kind: 'data',
            data: circular
          }
        ]
      };

      expect(() => sanitizer.sanitizeMessage(message)).toThrow('JSON-serializable');
    });
  });

  describe('Configuration', () => {
    it('should respect custom limits', () => {
      const strictSanitizer = new InputSanitizer({
        maxTextLength: 100,
        maxPartsPerMessage: 5
      });

      const longText = 'A'.repeat(101);
      const message = createTestMessage(longText);

      expect(() => strictSanitizer.sanitizeMessage(message)).toThrow('Text too long');
    });

    it('should respect allowed protocols', () => {
      const strictSanitizer = new InputSanitizer({
        allowedProtocols: ['https:']
      });

      const message: any = {
        messageId: 'msg-1',
        role: 'user',
        parts: [
          {
            kind: 'file',
            file: {
              uri: 'http://example.com/file.txt' // http not allowed
            }
          }
        ]
      };

      expect(() => strictSanitizer.sanitizeMessage(message)).toThrow('Protocol not allowed');
    });
  });
});
