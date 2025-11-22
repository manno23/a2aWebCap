/**
 * FilePartHandler - Handles file part validation and processing
 *
 * Provides utilities for:
 * - Base64 encoding/decoding
 * - URI validation
 * - MIME type validation
 * - File size limits
 * - File metadata extraction
 */

import type { FilePart } from '../shared/a2a.types.ts';

export interface FilePartHandlerConfig {
  maxFileSize: number; // Maximum file size in bytes (0 = unlimited)
  allowedMimeTypes: string[]; // Allowed MIME types ('*' = all)
  tempDirectory: string; // Temporary directory for file storage
}

export class FilePartHandler {
  private config: FilePartHandlerConfig;

  constructor(config: FilePartHandlerConfig) {
    this.config = config;
  }

  /**
   * Decode base64-encoded file content
   */
  decodeBase64Content(filePart: FilePart): Buffer {
    if (!filePart.file.bytes) {
      throw new Error('No base64 content to decode');
    }

    try {
      return Buffer.from(filePart.file.bytes, 'base64');
    } catch (error: any) {
      throw new Error(`Failed to decode base64 content: ${error.message}`);
    }
  }

  /**
   * Encode content to base64
   */
  encodeBase64Content(content: Buffer | string): string {
    const buffer = typeof content === 'string' ? Buffer.from(content) : content;
    return buffer.toString('base64');
  }

  /**
   * Validate URI format
   */
  isValidUri(uri: string): boolean {
    if (!uri || uri.length === 0) {
      return false;
    }

    // Reject dangerous schemes
    const dangerousSchemes = ['javascript:', 'data:', 'vbscript:'];
    const lowerUri = uri.toLowerCase();
    if (dangerousSchemes.some(scheme => lowerUri.startsWith(scheme))) {
      return false;
    }

    // Validate URL format
    try {
      const url = new URL(uri);
      // Allow http, https, and file schemes
      return ['http:', 'https:', 'file:'].includes(url.protocol);
    } catch {
      return false;
    }
  }

  /**
   * Get URI scheme (protocol)
   */
  getUriScheme(uri: string): string | null {
    try {
      const url = new URL(uri);
      return url.protocol.replace(':', '');
    } catch {
      return null;
    }
  }

  /**
   * Validate MIME type format
   */
  isValidMimeType(mimeType: string): boolean {
    if (!mimeType || mimeType.length === 0) {
      return false;
    }

    // Basic MIME type validation: type/subtype
    const mimeTypeRegex = /^[a-zA-Z0-9][a-zA-Z0-9\-_.+]*\/[a-zA-Z0-9][a-zA-Z0-9\-_.+]*$/;
    return mimeTypeRegex.test(mimeType);
  }

  /**
   * Check if MIME type is allowed based on configuration
   */
  isAllowedMimeType(mimeType: string): boolean {
    // If allowedMimeTypes includes '*', allow all valid MIME types
    if (this.config.allowedMimeTypes.includes('*')) {
      return this.isValidMimeType(mimeType);
    }

    // Check if MIME type is in allowed list
    return this.config.allowedMimeTypes.includes(mimeType);
  }

  /**
   * Validate file size against configured limits
   */
  validateFileSize(filePart: FilePart): void {
    // If maxFileSize is 0, unlimited size is allowed
    if (this.config.maxFileSize === 0) {
      return;
    }

    let fileSize = 0;

    if (filePart.file.bytes) {
      fileSize = this.getBase64DecodedSize(filePart.file.bytes);
    } else if (filePart.file.uri) {
      // For URI references, we can't validate size without fetching
      // This is a limitation - in production, you might want to fetch HEAD
      return;
    }

    if (fileSize > this.config.maxFileSize) {
      throw new Error(
        `File size exceeds maximum allowed size (${fileSize} > ${this.config.maxFileSize})`
      );
    }
  }

  /**
   * Calculate decoded size of base64-encoded content
   */
  getBase64DecodedSize(base64: string): number {
    // Remove any whitespace
    const cleanBase64 = base64.replace(/\s/g, '');

    // Calculate padding
    let padding = 0;
    if (cleanBase64.endsWith('==')) {
      padding = 2;
    } else if (cleanBase64.endsWith('=')) {
      padding = 1;
    }

    // Calculate decoded size
    // Base64 encodes 3 bytes into 4 characters
    const encodedLength = cleanBase64.length;
    const decodedSize = (encodedLength * 3) / 4 - padding;

    return Math.floor(decodedSize);
  }

  /**
   * Validate a FilePart has all required fields
   */
  validateFilePart(filePart: FilePart): void {
    // Must have either bytes or uri
    if (!filePart.file.bytes && !filePart.file.uri) {
      throw new Error('File must have either bytes or uri');
    }

    // Validate URI if provided
    if (filePart.file.uri && !this.isValidUri(filePart.file.uri)) {
      throw new Error(`Invalid URI: ${filePart.file.uri}`);
    }

    // Validate MIME type if provided
    if (filePart.file.mimeType) {
      if (!this.isValidMimeType(filePart.file.mimeType)) {
        throw new Error(`Invalid MIME type: ${filePart.file.mimeType}`);
      }

      if (!this.isAllowedMimeType(filePart.file.mimeType)) {
        throw new Error(`MIME type not allowed: ${filePart.file.mimeType}`);
      }
    }

    // Validate size if bytes are provided
    if (filePart.file.bytes) {
      this.validateFileSize(filePart);
    }
  }

  /**
   * Extract file metadata from FilePart
   */
  getFileMetadata(filePart: FilePart): {
    name?: string;
    mimeType?: string;
    size?: number;
    hasBytes: boolean;
    hasUri: boolean;
  } {
    let size: number | undefined;

    if (filePart.file.bytes) {
      size = this.getBase64DecodedSize(filePart.file.bytes);
    }

    return {
      name: filePart.file.name,
      mimeType: filePart.file.mimeType,
      size,
      hasBytes: !!filePart.file.bytes,
      hasUri: !!filePart.file.uri
    };
  }

  /**
   * Sanitize filename to prevent directory traversal attacks
   */
  sanitizeFilename(filename: string): string {
    // Remove path separators and null bytes
    let sanitized = filename.replace(/[/\\:\0]/g, '_');

    // Remove leading dots
    sanitized = sanitized.replace(/^\.+/, '');

    // If filename is empty after sanitization, use a default
    if (sanitized.length === 0) {
      sanitized = 'unnamed_file';
    }

    return sanitized;
  }

  /**
   * Get file extension from filename or MIME type
   */
  getFileExtension(filePart: FilePart): string | null {
    // Try to get extension from filename
    if (filePart.file.name) {
      const match = filePart.file.name.match(/\.([^.]+)$/);
      if (match) {
        return match[1].toLowerCase();
      }
    }

    // Try to infer from MIME type
    if (filePart.file.mimeType) {
      const mimeToExt: Record<string, string> = {
        'text/plain': 'txt',
        'text/html': 'html',
        'application/json': 'json',
        'application/pdf': 'pdf',
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/gif': 'gif',
        'video/mp4': 'mp4',
        'audio/mpeg': 'mp3'
      };

      return mimeToExt[filePart.file.mimeType] || null;
    }

    return null;
  }
}
