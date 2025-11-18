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
import { createLogger } from '@a2a/shared';
import type { CapabilitySet } from '@a2a/shared';
import { AuthenticationService } from './authentication-service.js';

const log = createLogger('session-manager');

import type { CapabilitySet } from '@a2a-webcap/shared';

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
  sessionTimeout: number; // Session timeout in seconds
  cleanupInterval?: number; // Cleanup interval in milliseconds
}

/**
 * SessionManager handles temporary authentication sessions
 */
export class SessionManager {
  private authService = new AuthenticationService({ jwtSecret: 'dummy' });
  
  private sessions = new Map<string, Session>();
  private cleanupTimer?: NodeJS.Timeout;
  private config: SessionManagerConfig;

  constructor(config: SessionManagerConfig) {
  private authService = new AuthenticationService({ jwtSecret: 'dummy' });
  
  private sessions = new Map<string, Session>();
  private cleanupTimer?: NodeJS.Timeout;
  private config: SessionManagerConfig;
  private authService = new AuthenticationService({ jwtSecret: 'dummy' });
  
  private sessions = new Map<string, Session>();
  private cleanupTimer?: NodeJS.Timeout;
  private config: SessionManagerConfig;
  private authService = new AuthenticationService({ jwtSecret: 'dummy' }); // Minimal config for capabilities
  
  private sessions = new Map<string, Session>();
  private sessions = new Map<string, Session>();
  private cleanupTimer?: NodeJS.Timeout;
  private config: SessionManagerConfig;

  constructor(config: SessionManagerConfig) {
    this.config = {
      cleanupInterval: 60000,
      ...config
    };
    this.startCleanup();
    log.info({ config: this.config }, 'SessionManager initialized');
  }
    this.config = {
      cleanupInterval: 60000, // Default: 1 minute
      ...config
    };

    // Start automatic cleanup of expired sessions
    this.startCleanup();

    log.info({ config: this.config }, 'SessionManager initialized');
  }

  /**
   * Create a new session
   */
async createSession(data: {
  userId: string;
  permissions: string[];
  metadata?: Record<string, any>;
}): Promise<Session> {
  const sessionId = this.generateSessionId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + this.config.sessionTimeout * 1000);

  // Create capabilities
  const capabilities = this.authService.createCapabilitySet(sessionId);
  capabilities.globalCapabilities.push({
    id: 'root',
    actions: ['*'],
    resources: ['*'],
    expiresAt: expiresAt.getTime()
  });

  const session: Session = {
    id: sessionId,
    userId: data.userId,
    permissions: data.permissions,
    capabilities,
    createdAt: now,
    expiresAt,
    metadata: data.metadata
  };

  this.sessions.set(sessionId, session);

  log.info(
    {
      sessionId,
      userId: data.userId,
      expiresAt: expiresAt.toISOString()
    },
    'Session created'
  );

  return session;
}
    const sessionId = this.generateSessionId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.sessionTimeout * 1000);

    const session: Session = {
      id: sessionId,
      userId: data.userId,
      permissions: data.permissions,
      createdAt: now,
      expiresAt,
      metadata: data.metadata
    };

    this.sessions.set(sessionId, session);

    log.info(
      {
        sessionId,
        userId: data.userId,
        expiresAt: expiresAt.toISOString()
      },
      'Session created'
    );

    return session;
  }

  /**
   * Validate and retrieve a session
   */
  async validateSession(sessionId: string): Promise<Session | null> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      log.debug({ sessionId }, 'Session not found');
      return null;
    }

    // Check if expired
    if (session.expiresAt < new Date()) {
      log.debug({ sessionId }, 'Session expired');
      this.sessions.delete(sessionId);
      return null;
    }

    log.debug({ sessionId, userId: session.userId }, 'Session validated');
    return session;
  }

  /**
   * Consume a session (one-time use)
   * Returns session data and immediately deletes it
   */
  async consumeSession(sessionId: string): Promise<Session | null> {
    const session = await this.validateSession(sessionId);

    if (session) {
      this.sessions.delete(sessionId);
      log.info({ sessionId, userId: session.userId }, 'Session consumed');
    }

    return session;
  }

  /**
   * Extend session expiration time
   */
  async extendSession(sessionId: string, additionalSeconds: number): Promise<boolean> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return false;
    }

    session.expiresAt = new Date(session.expiresAt.getTime() + additionalSeconds * 1000);

    log.debug({ sessionId, newExpiresAt: session.expiresAt }, 'Session extended');
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
   * Get all sessions for a user
   */
  async getUserSessions(userId: string): Promise<Session[]> {
    const userSessions: Session[] = [];

    for (const session of this.sessions.values()) {
      if (session.userId === userId) {
        userSessions.push(session);
      }
    }

    return userSessions;
  }

  /**
   * Get session count
   */
  getAuthService() {
    return this.authService;
  }

  getAuthService() {
    return this.authService;
  }

getAuthService() {
  return this.authService;
}

getSession(sessionId: string): Session | null {
  const session = this.sessions.get(sessionId);
  if (!session || session.expiresAt < new Date()) {
    this.sessions.delete(sessionId);
    return null;
  }
  return session;
}

getAuthService() {
  return this.authService;
}

getSession(sessionId: string): Session | null {
  const session = this.sessions.get(sessionId);
  if (!session || session.expiresAt < new Date()) {
    this.sessions.delete(sessionId);
    return null;
  }
  return session;
}

getSessionCount(): number {
  return this.sessions.size;
}

  /**
   * Clear all sessions
   */
  clearAllSessions(): void {
    const count = this.sessions.size;
    this.sessions.clear();
    log.info({ count }, 'All sessions cleared');
  }

  /**
   * Generate a cryptographically secure session ID
   */
  private generateSessionId(): string {
    return 'sess_' + crypto.randomBytes(32).toString('hex');
  }

  /**
   * Start automatic cleanup of expired sessions
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredSessions();
    }, this.config.cleanupInterval);

    // Don't keep the process alive just for cleanup
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Clean up expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = new Date();
    let expiredCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAt < now) {
        this.sessions.delete(sessionId);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      log.debug({ expiredCount, remaining: this.sessions.size }, 'Expired sessions cleaned up');
    }
  }

  /**
   * Stop cleanup timer (for graceful shutdown)
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    log.info('SessionManager destroyed');
  }
}
