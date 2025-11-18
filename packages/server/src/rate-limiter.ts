/**
 * RateLimiter - Simple in-memory rate limiting
 *
 * Implements token bucket algorithm for rate limiting per user and globally
 */

import { createLogger } from '@a2a-webcap/shared';

const log = createLogger('rate-limiter');

export interface RateLimiterConfig {
  points: number; // Number of requests allowed
  duration: number; // Time window in seconds
  blockDuration?: number; // How long to block after limit exceeded (seconds)
}

interface RateLimitEntry {
  points: number;
  resetAt: Date;
  blockedUntil?: Date;
}

/**
 * Simple in-memory rate limiter using token bucket algorithm
 */
export class RateLimiter {
  private entries = new Map<string, RateLimitEntry>();
  private config: RateLimiterConfig;

  constructor(config: RateLimiterConfig) {
    this.config = {
      blockDuration: 300, // Default: 5 minutes
      ...config
    };

    log.info({ config: this.config }, 'RateLimiter initialized');
  }

  /**
   * Consume a point (make a request)
   * Throws error if rate limit exceeded
   */
  async consume(key: string, points: number = 1): Promise<void> {
    const entry = this.getOrCreateEntry(key);
    const now = new Date();

    // Check if blocked
    if (entry.blockedUntil && entry.blockedUntil > now) {
      const retryAfter = Math.ceil((entry.blockedUntil.getTime() - now.getTime()) / 1000);
      throw new RateLimitError(
        `Rate limit exceeded. Try again in ${retryAfter} seconds`,
        retryAfter
      );
    }

    // Reset if window expired
    if (entry.resetAt < now) {
      entry.points = this.config.points;
      entry.resetAt = new Date(now.getTime() + this.config.duration * 1000);
      entry.blockedUntil = undefined;
    }

    // Check if enough points available
    if (entry.points < points) {
      // Set block duration
      if (this.config.blockDuration) {
        entry.blockedUntil = new Date(now.getTime() + this.config.blockDuration * 1000);
      }

      const retryAfter = this.config.blockDuration || this.config.duration;
      throw new RateLimitError(
        `Rate limit exceeded. Try again in ${retryAfter} seconds`,
        retryAfter
      );
    }

    // Consume points
    entry.points -= points;

    log.debug(
      {
        key,
        pointsRemaining: entry.points,
        resetAt: entry.resetAt
      },
      'Rate limit consumed'
    );
  }

  /**
   * Get remaining points for a key
   */
  getRemainingPoints(key: string): number {
    const entry = this.entries.get(key);

    if (!entry) {
      return this.config.points;
    }

    const now = new Date();

    // Reset if window expired
    if (entry.resetAt < now) {
      return this.config.points;
    }

    return entry.points;
  }

  /**
   * Check if key is currently blocked
   */
  isBlocked(key: string): boolean {
    const entry = this.entries.get(key);

    if (!entry || !entry.blockedUntil) {
      return false;
    }

    return entry.blockedUntil > new Date();
  }

  /**
   * Reset rate limit for a key
   */
  reset(key: string): void {
    this.entries.delete(key);
    log.debug({ key }, 'Rate limit reset');
  }

  /**
   * Clear all rate limit entries
   */
  clearAll(): void {
    const count = this.entries.size;
    this.entries.clear();
    log.debug({ count }, 'All rate limits cleared');
  }

  /**
   * Get or create entry for a key
   */
  private getOrCreateEntry(key: string): RateLimitEntry {
    let entry = this.entries.get(key);

    if (!entry) {
      const now = new Date();
      entry = {
        points: this.config.points,
        resetAt: new Date(now.getTime() + this.config.duration * 1000)
      };
      this.entries.set(key, entry);
    }

    return entry;
  }

  /**
   * Get entry count (for testing)
   */
  getEntryCount(): number {
    return this.entries.size;
  }
}

/**
 * Rate limit error
 */
export class RateLimitError extends Error {
  constructor(
    message: string,
    public retryAfter: number
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}
