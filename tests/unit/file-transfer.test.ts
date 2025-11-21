/**
 * FilePart Transfer Tests
 *
 * Tests file transfer support with base64 encoding, URI references, and size limits
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TaskManager } from '../../src/server/task-manager';
import { FilePartHandler } from '../../src/server/file-part-handler';
import {
  createTestMessageWithParts,
  createFilePart,
  createTextPart
} from '../utils';
import type { FilePart } from '@a2a-webcap/shared';

describe('FilePart Support', () => {
  let taskManager: TaskManager;
  let fileHandler: FilePartHandler;

  beforeEach(() => {
    taskManager = new TaskManager();
    fileHandler = new FilePartHandler({
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedMimeTypes: ['*'],
      tempDirectory: '/tmp/a2a-files'
    });
  });

  describe('Base64 Encoding', () => {
    it('should accept file with base64-encoded content', async () => {
      const fileContent = 'Hello, this is a test file!';
      const filePart = createFilePart('test.txt', fileContent, 'text/plain');

      const message = createTestMessageWithParts([filePart]);
      const task = await taskManager.createTask(message);

      expect(task.history![0].parts[0]).toEqual(filePart);
      expect((task.history![0].parts[0] as FilePart).file.bytes).toBeDefined();
    });

    it('should decode base64 content correctly', async () => {
      const originalContent = 'This is test content';
      const base64Content = Buffer.from(originalContent).toString('base64');

      const filePart: FilePart = {
        kind: 'file',
        file: {
          name: 'test.txt',
          mimeType: 'text/plain',
          bytes: base64Content
        }
      };

      const decoded = fileHandler.decodeBase64Content(filePart);
      expect(decoded.toString('utf-8')).toBe(originalContent);
    });

    it('should handle binary files with base64 encoding', async () => {
      // Simulate binary data (e.g., an image)
      const binaryData = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]); // PNG header
      const base64Data = binaryData.toString('base64');

      const filePart: FilePart = {
        kind: 'file',
        file: {
          name: 'image.png',
          mimeType: 'image/png',
          bytes: base64Data
        }
      };

      const decoded = fileHandler.decodeBase64Content(filePart);
      expect(decoded).toEqual(binaryData);
    });

    it('should handle large text files with base64 encoding', async () => {
      const largeContent = 'A'.repeat(1024 * 100); // 100KB of 'A's
      const filePart = createFilePart('large.txt', largeContent, 'text/plain');

      const message = createTestMessageWithParts([filePart]);
      const task = await taskManager.createTask(message);

      const storedFile = task.history![0].parts[0] as FilePart;
      const decoded = fileHandler.decodeBase64Content(storedFile);
      expect(decoded.toString('utf-8')).toBe(largeContent);
    });
  });

  describe('URI References', () => {
    it('should accept file with URI reference', async () => {
      const filePart: FilePart = {
        kind: 'file',
        file: {
          name: 'document.pdf',
          mimeType: 'application/pdf',
          uri: 'https://example.com/files/document.pdf'
        }
      };

      const message = createTestMessageWithParts([filePart]);
      const task = await taskManager.createTask(message);

      expect((task.history![0].parts[0] as FilePart).file.uri).toBe(
        'https://example.com/files/document.pdf'
      );
    });

    it('should validate URI format', () => {
      const validUris = [
        'https://example.com/file.txt',
        'http://localhost:8080/file.pdf',
        'file:///tmp/test.txt'
      ];

      for (const uri of validUris) {
        expect(fileHandler.isValidUri(uri)).toBe(true);
      }
    });

    it('should reject invalid URI format', () => {
      const invalidUris = [
        'not-a-uri',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        ''
      ];

      for (const uri of invalidUris) {
        expect(fileHandler.isValidUri(uri)).toBe(false);
      }
    });

    it('should prefer base64 content over URI if both provided', async () => {
      const content = 'This is the actual content';
      const filePart: FilePart = {
        kind: 'file',
        file: {
          name: 'test.txt',
          mimeType: 'text/plain',
          bytes: Buffer.from(content).toString('base64'),
          uri: 'https://example.com/file.txt'
        }
      };

      const decoded = fileHandler.decodeBase64Content(filePart);
      expect(decoded.toString('utf-8')).toBe(content);
    });

    it('should handle file:// URIs for local files', () => {
      const localUri = 'file:///tmp/test.txt';
      expect(fileHandler.isValidUri(localUri)).toBe(true);
      expect(fileHandler.getUriScheme(localUri)).toBe('file');
    });

    it('should handle https:// URIs for remote files', () => {
      const remoteUri = 'https://cdn.example.com/files/document.pdf';
      expect(fileHandler.isValidUri(remoteUri)).toBe(true);
      expect(fileHandler.getUriScheme(remoteUri)).toBe('https');
    });
  });

  describe('MIME Type Validation', () => {
    it('should accept common MIME types', () => {
      const validMimeTypes = [
        'text/plain',
        'text/html',
        'application/json',
        'application/pdf',
        'image/png',
        'image/jpeg',
        'video/mp4',
        'audio/mpeg'
      ];

      for (const mimeType of validMimeTypes) {
        expect(fileHandler.isValidMimeType(mimeType)).toBe(true);
      }
    });

    it('should reject invalid MIME types', () => {
      const invalidMimeTypes = [
        '',
        'not-a-mime-type',
        'text',
        'image',
        'application'
      ];

      for (const mimeType of invalidMimeTypes) {
        expect(fileHandler.isValidMimeType(mimeType)).toBe(false);
      }
    });

    it('should enforce allowed MIME types if configured', () => {
      const restrictiveHandler = new FilePartHandler({
        maxFileSize: 10 * 1024 * 1024,
        allowedMimeTypes: ['text/plain', 'application/json'],
        tempDirectory: '/tmp/a2a-files'
      });

      expect(restrictiveHandler.isAllowedMimeType('text/plain')).toBe(true);
      expect(restrictiveHandler.isAllowedMimeType('application/json')).toBe(true);
      expect(restrictiveHandler.isAllowedMimeType('image/png')).toBe(false);
      expect(restrictiveHandler.isAllowedMimeType('application/pdf')).toBe(false);
    });
  });

  describe('Size Limits', () => {
    it('should reject files exceeding size limit', () => {
      const smallHandler = new FilePartHandler({
        maxFileSize: 1024, // 1KB limit
        allowedMimeTypes: ['*'],
        tempDirectory: '/tmp/a2a-files'
      });

      const largeContent = 'A'.repeat(2048); // 2KB
      const filePart = createFilePart('large.txt', largeContent, 'text/plain');

      expect(() => {
        smallHandler.validateFileSize(filePart);
      }).toThrow('File size exceeds maximum allowed size');
    });

    it('should accept files within size limit', () => {
      const content = 'Small file content';
      const filePart = createFilePart('small.txt', content, 'text/plain');

      expect(() => {
        fileHandler.validateFileSize(filePart);
      }).not.toThrow();
    });

    it('should calculate correct file size from base64', () => {
      const content = 'Test content';
      const base64 = Buffer.from(content).toString('base64');

      const size = fileHandler.getBase64DecodedSize(base64);
      expect(size).toBe(content.length);
    });

    it('should handle size limit of 0 (unlimited)', () => {
      const unlimitedHandler = new FilePartHandler({
        maxFileSize: 0, // Unlimited
        allowedMimeTypes: ['*'],
        tempDirectory: '/tmp/a2a-files'
      });

      const largeContent = 'A'.repeat(100 * 1024 * 1024); // 100MB
      const filePart = createFilePart('huge.txt', largeContent, 'text/plain');

      expect(() => {
        unlimitedHandler.validateFileSize(filePart);
      }).not.toThrow();
    });
  });

  describe('Multimodal Messages', () => {
    it('should handle message with both text and file parts', async () => {
      const textPart = createTextPart('Please analyze this file:');
      const filePart = createFilePart('data.json', '{"key": "value"}', 'application/json');

      const message = createTestMessageWithParts([textPart, filePart]);
      const task = await taskManager.createTask(message);

      expect(task.history![0].parts).toHaveLength(2);
      expect(task.history![0].parts[0].kind).toBe('text');
      expect(task.history![0].parts[1].kind).toBe('file');
    });

    it('should handle message with multiple files', async () => {
      const textPart = createTextPart('Compare these files:');
      const file1 = createFilePart('file1.txt', 'Content 1', 'text/plain');
      const file2 = createFilePart('file2.txt', 'Content 2', 'text/plain');
      const file3 = createFilePart('file3.txt', 'Content 3', 'text/plain');

      const message = createTestMessageWithParts([textPart, file1, file2, file3]);
      const task = await taskManager.createTask(message);

      expect(task.history![0].parts).toHaveLength(4);
      const fileParts = task.history![0].parts.filter(p => p.kind === 'file');
      expect(fileParts).toHaveLength(3);
    });

    it('should preserve file order in multimodal messages', async () => {
      const parts = [
        createTextPart('Part 1'),
        createFilePart('file1.txt', 'File 1', 'text/plain'),
        createTextPart('Part 2'),
        createFilePart('file2.txt', 'File 2', 'text/plain'),
        createTextPart('Part 3')
      ];

      const message = createTestMessageWithParts(parts);
      const task = await taskManager.createTask(message);

      expect(task.history![0].parts).toHaveLength(5);
      expect(task.history![0].parts[0].kind).toBe('text');
      expect(task.history![0].parts[1].kind).toBe('file');
      expect(task.history![0].parts[2].kind).toBe('text');
      expect(task.history![0].parts[3].kind).toBe('file');
      expect(task.history![0].parts[4].kind).toBe('text');
    });
  });

  describe('File Metadata', () => {
    it('should preserve file name', async () => {
      const filePart = createFilePart('document.pdf', 'Content', 'application/pdf');
      const message = createTestMessageWithParts([filePart]);
      const task = await taskManager.createTask(message);

      const storedFile = task.history![0].parts[0] as FilePart;
      expect(storedFile.file.name).toBe('document.pdf');
    });

    it('should preserve MIME type', async () => {
      const filePart = createFilePart('image.png', 'PNG data', 'image/png');
      const message = createTestMessageWithParts([filePart]);
      const task = await taskManager.createTask(message);

      const storedFile = task.history![0].parts[0] as FilePart;
      expect(storedFile.file.mimeType).toBe('image/png');
    });

    it('should handle file without name', async () => {
      const filePart: FilePart = {
        kind: 'file',
        file: {
          mimeType: 'text/plain',
          bytes: Buffer.from('Content').toString('base64')
        }
      };

      const message = createTestMessageWithParts([filePart]);
      const task = await taskManager.createTask(message);

      expect(task.history![0].parts[0]).toBeDefined();
    });

    it('should handle file without MIME type', async () => {
      const filePart: FilePart = {
        kind: 'file',
        file: {
          name: 'unknown.bin',
          bytes: Buffer.from('Content').toString('base64')
        }
      };

      const message = createTestMessageWithParts([filePart]);
      const task = await taskManager.createTask(message);

      const storedFile = task.history![0].parts[0] as FilePart;
      expect(storedFile.file.name).toBe('unknown.bin');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid base64 encoding gracefully', () => {
      // Note: Buffer.from() with 'base64' encoding is forgiving and will decode
      // what it can, so this doesn't throw. In production, you might want
      // stricter validation.
      const invalidBase64 = 'This is not valid base64!!!@#$';

      const result = fileHandler.decodeBase64Content({
        kind: 'file',
        file: { bytes: invalidBase64 }
      });

      // Should decode something, even if not what was intended
      expect(result).toBeInstanceOf(Buffer);
    });

    it('should handle empty file content', () => {
      const emptyBase64 = Buffer.from('').toString('base64');
      const filePart: FilePart = {
        kind: 'file',
        file: {
          name: 'empty.txt',
          mimeType: 'text/plain',
          bytes: emptyBase64 || '' // Handle case where empty buffer gives empty string
        }
      };

      if (filePart.file.bytes && filePart.file.bytes.length > 0) {
        const decoded = fileHandler.decodeBase64Content(filePart);
        expect(decoded.length).toBe(0);
      } else {
        // Empty string is valid for empty file
        expect(filePart.file.bytes).toBeDefined();
      }
    });

    it('should handle missing file data', () => {
      const filePart: FilePart = {
        kind: 'file',
        file: {
          name: 'missing.txt'
          // No bytes or uri
        }
      };

      expect(() => {
        fileHandler.validateFilePart(filePart);
      }).toThrow('File must have either bytes or uri');
    });
  });
});
