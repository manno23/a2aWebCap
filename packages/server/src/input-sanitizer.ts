/**
 * InputSanitizer - Sanitizes and validates user inputs
 *
 * Prevents injection attacks and ensures data integrity
 */

import type { Message, Part } from '@a2a-webcap/shared';

export interface SanitizerConfig {
  maxMessageLength?: number;
  maxPartsPerMessage?: number;
  maxTextLength?: number;
  allowedProtocols?: string[];
}

/**
 * Input sanitizer for A2A messages
 */
export class InputSanitizer {
  private config: SanitizerConfig;

  constructor(config: SanitizerConfig = {}) {
    this.config = {
      maxMessageLength: 1024 * 1024, // 1MB
      maxPartsPerMessage: 100,
      maxTextLength: 512 * 1024, // 512KB
      allowedProtocols: ['http:', 'https:', 'file:'],
      ...config
    };
  }

  /**
   * Sanitize a message
   */
  sanitizeMessage(message: Message): Message {
    // Validate message structure
    if (!message.messageId || typeof message.messageId !== 'string') {
      throw new Error('Invalid messageId');
    }

    if (!message.role || !['user', 'agent'].includes(message.role)) {
      throw new Error('Invalid role');
    }

    if (!Array.isArray(message.parts)) {
      throw new Error('Invalid parts array');
    }

    // Check parts count
    if (message.parts.length > this.config.maxPartsPerMessage!) {
      throw new Error(
        `Too many parts (${message.parts.length} > ${this.config.maxPartsPerMessage})`
      );
    }

    // Sanitize each part
    const sanitizedParts = message.parts.map((part) => this.sanitizePart(part));

    // Sanitize string fields
    return {
      messageId: this.sanitizeString(message.messageId, 256),
      contextId: message.contextId ? this.sanitizeString(message.contextId, 256) : undefined,
      taskId: message.taskId ? this.sanitizeString(message.taskId, 256) : undefined,
      role: message.role,
      parts: sanitizedParts,
      metadata: message.metadata ? this.sanitizeMetadata(message.metadata) : undefined
    };
  }

  /**
   * Sanitize a message part
   */
  private sanitizePart(part: Part): Part {
    switch (part.kind) {
      case 'text':
        return {
          kind: 'text',
          text: this.sanitizeText(part.text)
        };

      case 'file':
        return {
          kind: 'file',
          file: {
            name: part.file.name ? this.sanitizeFilename(part.file.name) : undefined,
            mimeType: part.file.mimeType ? this.sanitizeMimeType(part.file.mimeType) : undefined,
            bytes: part.file.bytes,
            uri: part.file.uri ? this.sanitizeUri(part.file.uri) : undefined
          }
        };

      case 'data':
        return {
          kind: 'data',
          data: this.sanitizeData(part.data)
        };

      default:
        throw new Error(`Unknown part kind: ${(part as any).kind}`);
    }
  }

  /**
   * Sanitize text content
   */
  private sanitizeText(text: string): string {
    if (typeof text !== 'string') {
      throw new Error('Text must be a string');
    }

    if (text.length > this.config.maxTextLength!) {
      throw new Error(`Text too long (${text.length} > ${this.config.maxTextLength})`);
    }

    // Remove null bytes
    return text.replace(/\0/g, '');
  }

  /**
   * Sanitize a general string
   */
  private sanitizeString(str: string, maxLength: number): string {
    if (typeof str !== 'string') {
      throw new Error('Value must be a string');
    }

    if (str.length > maxLength) {
      throw new Error(`String too long (${str.length} > ${maxLength})`);
    }

    // Remove null bytes and control characters
    return str.replace(/[\0\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }

  /**
   * Sanitize filename to prevent directory traversal
   */
  private sanitizeFilename(filename: string): string {
    if (typeof filename !== 'string') {
      throw new Error('Filename must be a string');
    }

    // Remove path separators and null bytes
    let sanitized = filename.replace(/[\/\\:\0]/g, '_');

    // Remove leading dots
    sanitized = sanitized.replace(/^\.+/, '');

    // Limit length
    if (sanitized.length > 255) {
      sanitized = sanitized.substring(0, 255);
    }

    // If empty after sanitization, use default
    if (sanitized.length === 0) {
      sanitized = 'unnamed_file';
    }

    return sanitized;
  }

  /**
   * Sanitize MIME type
   */
  private sanitizeMimeType(mimeType: string): string {
    if (typeof mimeType !== 'string') {
      throw new Error('MIME type must be a string');
    }

    // Basic MIME type validation
    const mimeRegex = /^[a-zA-Z0-9][a-zA-Z0-9\-_.+]*\/[a-zA-Z0-9][a-zA-Z0-9\-_.+]*$/;

    if (!mimeRegex.test(mimeType)) {
      throw new Error(`Invalid MIME type: ${mimeType}`);
    }

    return mimeType.toLowerCase();
  }

  /**
   * Sanitize URI to prevent injection
   */
  private sanitizeUri(uri: string): string {
    if (typeof uri !== 'string') {
      throw new Error('URI must be a string');
    }

    // Parse URL
    try {
      const url = new URL(uri);

      // Check protocol
      if (!this.config.allowedProtocols!.includes(url.protocol)) {
        throw new Error(`Protocol not allowed: ${url.protocol}`);
      }

      // Prevent javascript: and data: URIs
      if (['javascript:', 'data:', 'vbscript:'].includes(url.protocol)) {
        throw new Error(`Dangerous protocol: ${url.protocol}`);
      }

      return url.toString();
    } catch (error: any) {
      throw new Error(`Invalid URI: ${error.message}`);
    }
  }

  /**
   * Sanitize generic data
   */
  private sanitizeData(data: any): any {
    // For now, just ensure it's JSON-serializable
    try {
      JSON.stringify(data);
      return data;
    } catch {
      throw new Error('Data must be JSON-serializable');
    }
  }

  /**
   * Sanitize metadata object
   */
  private sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(metadata)) {
      // Sanitize key
      const sanitizedKey = this.sanitizeString(key, 128);

      // Sanitize value (basic sanitization)
      if (typeof value === 'string') {
        sanitized[sanitizedKey] = this.sanitizeString(value, 1024);
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        sanitized[sanitizedKey] = value;
      } else if (value === null || value === undefined) {
        sanitized[sanitizedKey] = value;
      } else {
        // For complex types, ensure JSON-serializable
        try {
          JSON.stringify(value);
          sanitized[sanitizedKey] = value;
        } catch {
          // Skip non-serializable values
        }
      }
    }

    return sanitized;
  }
}
