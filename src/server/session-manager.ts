/**
 * SessionManager - Manages temporary sessions for WebSocket authentication
 *
 * Implements the hybrid authentication pattern:
 * 1. Client authenticates via HTTP (with headers)
 * 2. Server returns short-lived session token
 * 3. Client connects WebSocket with session token
 * 4. Server returns capability-secured stub
 */

import crypto from 'crypto';
import { AuthenticationService } from './authentication-service.js';
import type { CapabilitySet } from '../shared/a2a.types.ts';

const log = console; // TODO: Replace with proper logger

export interface Session {
  id: string;
  userId: string;
  permissions: string[];
  capabilities?: CapabilitySet;
  createdAt: Date;
  expiresAt: Date;
  metadata?: Record<string, any>;
}

export interface SessionManagerConfig {
  sessionTimeout: number; // Session timeout in milliseconds
  cleanupInterval?: number; // Cleanup interval in milliseconds
}

/**
 * SessionManager handles temporary authentication sessions
 */
export class SessionManager {
  private authService: AuthenticationService;
  private sessions = new Map<string, Session>();
  private cleanupTimer?: NodeJS.Timeout;
  private config: SessionManagerConfig;

  constructor(config: SessionManagerConfig) {
    this.config = {
      cleanupInterval: 300000, // 5 minutes default
      ...config
    };
    this.authService = new AuthenticationService({ jwtSecret: 'dummy' });

    // Start cleanup timer
    this.cleanupTimer = setInterval(
      () => this.cleanupExpiredSessions(),
      this.config.cleanupInterval
    );

    log.info({ config: this.config }, 'SessionManager initialized');
  }

  /**
   * Create a new session
   */
  async createSession(params: {
    userId: string;
    permissions: string[];
    capabilities?: CapabilitySet;
    metadata?: Record<string, any>;
  }): Promise<Session> {
    const sessionId = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.sessionTimeout);

    const session: Session = {
      id: sessionId,
      userId: params.userId,
      permissions: params.permissions,
      capabilities: params.capabilities,
      createdAt: now,
      expiresAt,
      metadata: params.metadata
    };

    this.sessions.set(sessionId, session);
    log.info({ sessionId, userId: params.userId, expiresAt }, 'Session created');

    return session;
  }

  /**
   * Validate a session and return it if valid
   */
  async validateSession(sessionId: string): Promise<Session | null> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return null;
    }

    if (session.expiresAt < new Date()) {
      this.sessions.delete(sessionId);
      log.info({ sessionId }, 'Session expired and removed');
      return null;
    }

    return session;
  }

  /**
   * Extend session expiration
   */
  async extendSession(sessionId: string, timeout?: number): Promise<boolean> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return false;
    }

    const extension = timeout || this.config.sessionTimeout;
    session.expiresAt = new Date(Date.now() + extension);

    log.info({ sessionId, expiresAt: session.expiresAt }, 'Session extended');
    return true;
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    const deleted = this.sessions.delete(sessionId);

    if (deleted) {
      log.info({ sessionId }, 'Session deleted');
    }

    return deleted;
  }

  /**
   * Get session count
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Clean up expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAt < now) {
        this.sessions.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      log.info({ cleanedCount, totalSessions: this.sessions.size }, 'Cleaned up expired sessions');
    }
  }

  /**
   * Destroy the session manager and clean up resources
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    this.sessions.clear();
    log.info('SessionManager destroyed');
  }
}
