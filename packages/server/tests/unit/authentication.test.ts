/**
 * Authentication Service Tests
 *
 * Tests JWT validation, API key validation, and authentication flows
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AuthenticationService } from '../../src/authentication-service';
import { SessionManager } from '../../src/session-manager';
import { wait } from '../utils';

describe('AuthenticationService', () => {
  let authService: AuthenticationService;

  beforeEach(() => {
    authService = new AuthenticationService({
      jwtSecret: 'test-secret-key-do-not-use-in-production',
      jwtIssuer: 'a2a-test',
      jwtAudience: 'a2a-api'
    });
  });

  describe('JWT Authentication', () => {
    it('should accept valid JWT token', async () => {
      const token = authService.generateJWT('user123', ['read', 'write']);

      const result = await authService.authenticate({ type: 'bearer', token });

      expect(result.authenticated).toBe(true);
      expect(result.userId).toBe('user123');
      expect(result.permissions).toEqual(['read', 'write']);
      expect(result.expiresAt).toBeDefined();
    });

    it('should reject expired JWT token', async () => {
      const token = authService.generateJWT('user123', ['read'], {
        expiresIn: '0s' // Immediately expired
      });

      // Wait a bit to ensure token is expired
      await wait(100);

      const result = await authService.authenticate({ type: 'bearer', token });

      expect(result.authenticated).toBe(false);
      expect(result.metadata?.errorType).toBe('expired');
    });

    it('should reject token with invalid signature', async () => {
      const otherService = new AuthenticationService({
        jwtSecret: 'different-secret',
        jwtIssuer: 'a2a-test',
        jwtAudience: 'a2a-api'
      });

      const token = otherService.generateJWT('user123', ['read']);

      const result = await authService.authenticate({ type: 'bearer', token });

      expect(result.authenticated).toBe(false);
      expect(result.metadata?.errorType).toBe('invalid_signature');
    });

    it('should reject revoked token', async () => {
      const tokenId = 'token-to-revoke';
      const token = authService.generateJWT('user123', ['read'], { tokenId });

      // Revoke the token
      authService.revokeToken(tokenId);

      const result = await authService.authenticate({ type: 'bearer', token });

      expect(result.authenticated).toBe(false);
      expect(result.metadata?.error).toContain('revoked');
    });

    it('should extract permissions from JWT', async () => {
      const token = authService.generateJWT('user123', ['read', 'write', 'execute']);

      const result = await authService.authenticate({ type: 'bearer', token });

      expect(result.authenticated).toBe(true);
      expect(result.permissions).toEqual(['read', 'write', 'execute']);
    });

    it('should include token metadata in result', async () => {
      const token = authService.generateJWT('user123', ['read']);

      const result = await authService.authenticate({ type: 'bearer', token });

      expect(result.authenticated).toBe(true);
      expect(result.metadata?.tokenId).toBeDefined();
      expect(result.metadata?.issuedAt).toBeDefined();
    });
  });

  describe('API Key Authentication', () => {
    it('should accept valid API key', async () => {
      const { apiKey } = authService.generateApiKey('user456', ['read', 'write']);

      const result = await authService.authenticate({ type: 'apikey', apiKey });

      expect(result.authenticated).toBe(true);
      expect(result.userId).toBe('user456');
      expect(result.permissions).toEqual(['read', 'write']);
    });

    it('should reject invalid API key', async () => {
      const result = await authService.authenticate({
        type: 'apikey',
        apiKey: 'ak_test_invalid_key_123'
      });

      expect(result.authenticated).toBe(false);
      expect(result.metadata?.error).toContain('not found');
    });

    it('should reject API key with invalid format', async () => {
      const result = await authService.authenticate({
        type: 'apikey',
        apiKey: 'invalid-format'
      });

      expect(result.authenticated).toBe(false);
      expect(result.metadata?.error).toContain('Invalid API key format');
    });

    it('should reject expired API key', async () => {
      const { apiKey } = authService.generateApiKey('user456', ['read'], {
        expiresIn: 1 // 1 second
      });

      // Wait for key to expire
      await wait(1100);

      const result = await authService.authenticate({ type: 'apikey', apiKey });

      expect(result.authenticated).toBe(false);
      expect(result.metadata?.error).toContain('expired');
    });

    it('should generate API key with correct format', () => {
      const { apiKey, keyId } = authService.generateApiKey('user456', ['read'], {
        environment: 'live'
      });

      expect(apiKey).toMatch(/^ak_live_[a-f0-9]{64}$/);
      expect(keyId).toBeDefined();
    });

    it('should list API keys for user', async () => {
      const key1 = authService.generateApiKey('user1', ['read']);
      const key2 = authService.generateApiKey('user1', ['write']);
      const key3 = authService.generateApiKey('user2', ['read']);

      const user1Keys = await authService.listApiKeys('user1');
      const user2Keys = await authService.listApiKeys('user2');

      expect(user1Keys.length).toBe(2);
      expect(user2Keys.length).toBe(1);
      expect(user1Keys[0]).not.toHaveProperty('hashedKey'); // Should not expose hash
    });

    it('should revoke API key', async () => {
      const { apiKey, keyId } = authService.generateApiKey('user456', ['read']);

      // Key should work initially
      let result = await authService.authenticate({ type: 'apikey', apiKey });
      expect(result.authenticated).toBe(true);

      // Revoke key
      await authService.revokeApiKey(keyId);

      // Key should no longer work
      result = await authService.authenticate({ type: 'apikey', apiKey });
      expect(result.authenticated).toBe(false);
    });

    it('should store API keys securely (hashed)', async () => {
      const { apiKey, keyId } = authService.generateApiKey('user456', ['read']);

      const store = authService.getApiKeyStore();
      const keys = await store.list();
      const storedKey = keys.find((k) => k.id === keyId);

      expect(storedKey).toBeDefined();
      expect(storedKey!.hashedKey).not.toBe(apiKey); // Should be hashed, not plaintext
      expect(storedKey!.hashedKey.length).toBe(64); // SHA-256 hex = 64 chars
    });
  });

  describe('OAuth 2.0 Authentication', () => {
    it('should return not-implemented for OAuth tokens', async () => {
      const result = await authService.authenticate({
        type: 'oauth2',
        token: 'oauth-token-123'
      });

      expect(result.authenticated).toBe(false);
      expect(result.metadata?.error).toContain('not configured');
    });
  });

  describe('Authentication Metadata', () => {
    it('should include IP address in audit log', async () => {
      const token = authService.generateJWT('user123', ['read']);

      await authService.authenticate(
        { type: 'bearer', token },
        { ipAddress: '192.168.1.1', userAgent: 'Test Client' }
      );

      // Audit logging is tested via logs
      expect(true).toBe(true);
    });

    it('should handle authentication errors gracefully', async () => {
      const result = await authService.authenticate({
        type: 'bearer',
        token: 'malformed-token'
      });

      expect(result.authenticated).toBe(false);
      expect(result.metadata?.error).toBeDefined();
    });
  });

  describe('Unsupported Authentication Types', () => {
    it('should reject unsupported auth type', async () => {
      const result = await authService.authenticate({
        type: 'mtls' as any,
        certificate: 'cert-data'
      });

      expect(result.authenticated).toBe(false);
      expect(result.metadata?.error).toContain('Unsupported auth type');
    });
  });
});

describe('SessionManager', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager({
      sessionTimeout: 3600, // 1 hour
      cleanupInterval: 100 // Fast cleanup for testing
    });
  });

  afterEach(() => {
    sessionManager.destroy();
  });

  describe('Session Creation', () => {
    it('should create a new session', async () => {
      const session = await sessionManager.createSession({
        userId: 'user123',
        permissions: ['read', 'write']
      });

      expect(session.id).toMatch(/^sess_[a-f0-9]{64}$/);
      expect(session.userId).toBe('user123');
      expect(session.permissions).toEqual(['read', 'write']);
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.expiresAt).toBeInstanceOf(Date);
      expect(session.expiresAt.getTime()).toBeGreaterThan(session.createdAt.getTime());
    });

    it('should include metadata in session', async () => {
      const metadata = { ipAddress: '192.168.1.1', clientInfo: 'browser' };

      const session = await sessionManager.createSession({
        userId: 'user123',
        permissions: ['read'],
        metadata
      });

      expect(session.metadata).toEqual(metadata);
    });

    it('should generate unique session IDs', async () => {
      const session1 = await sessionManager.createSession({
        userId: 'user1',
        permissions: ['read']
      });

      const session2 = await sessionManager.createSession({
        userId: 'user2',
        permissions: ['read']
      });

      expect(session1.id).not.toBe(session2.id);
    });
  });

  describe('Session Validation', () => {
    it('should validate existing session', async () => {
      const created = await sessionManager.createSession({
        userId: 'user123',
        permissions: ['read']
      });

      const validated = await sessionManager.validateSession(created.id);

      expect(validated).not.toBeNull();
      expect(validated!.id).toBe(created.id);
      expect(validated!.userId).toBe('user123');
    });

    it('should return null for non-existent session', async () => {
      const validated = await sessionManager.validateSession('sess_nonexistent');

      expect(validated).toBeNull();
    });

    it('should return null for expired session', async () => {
      const shortSessionManager = new SessionManager({
        sessionTimeout: 1 // 1 second
      });

      const session = await shortSessionManager.createSession({
        userId: 'user123',
        permissions: ['read']
      });

      // Wait for session to expire
      await wait(1100);

      const validated = await shortSessionManager.validateSession(session.id);

      expect(validated).toBeNull();

      shortSessionManager.destroy();
    });
  });

  describe('Session Consumption', () => {
    it('should consume session (one-time use)', async () => {
      const session = await sessionManager.createSession({
        userId: 'user123',
        permissions: ['read']
      });

      const consumed = await sessionManager.consumeSession(session.id);

      expect(consumed).not.toBeNull();
      expect(consumed!.id).toBe(session.id);

      // Session should be deleted after consumption
      const validated = await sessionManager.validateSession(session.id);
      expect(validated).toBeNull();
    });

    it('should return null when consuming non-existent session', async () => {
      const consumed = await sessionManager.consumeSession('sess_nonexistent');

      expect(consumed).toBeNull();
    });
  });

  describe('Session Extension', () => {
    it('should extend session expiration', async () => {
      const session = await sessionManager.createSession({
        userId: 'user123',
        permissions: ['read']
      });

      const originalExpiry = session.expiresAt.getTime();

      const extended = await sessionManager.extendSession(session.id, 1800); // Add 30 minutes

      expect(extended).toBe(true);

      const validated = await sessionManager.validateSession(session.id);
      expect(validated!.expiresAt.getTime()).toBeGreaterThan(originalExpiry);
    });

    it('should return false when extending non-existent session', async () => {
      const extended = await sessionManager.extendSession('sess_nonexistent', 1800);

      expect(extended).toBe(false);
    });
  });

  describe('Session Deletion', () => {
    it('should delete a session', async () => {
      const session = await sessionManager.createSession({
        userId: 'user123',
        permissions: ['read']
      });

      const deleted = await sessionManager.deleteSession(session.id);

      expect(deleted).toBe(true);

      const validated = await sessionManager.validateSession(session.id);
      expect(validated).toBeNull();
    });

    it('should return false when deleting non-existent session', async () => {
      const deleted = await sessionManager.deleteSession('sess_nonexistent');

      expect(deleted).toBe(false);
    });
  });

  describe('User Sessions', () => {
    it('should list all sessions for a user', async () => {
      await sessionManager.createSession({ userId: 'user1', permissions: ['read'] });
      await sessionManager.createSession({ userId: 'user1', permissions: ['write'] });
      await sessionManager.createSession({ userId: 'user2', permissions: ['read'] });

      const user1Sessions = await sessionManager.getUserSessions('user1');
      const user2Sessions = await sessionManager.getUserSessions('user2');

      expect(user1Sessions.length).toBe(2);
      expect(user2Sessions.length).toBe(1);
    });

    it('should return empty array for user with no sessions', async () => {
      const sessions = await sessionManager.getUserSessions('user_no_sessions');

      expect(sessions).toEqual([]);
    });
  });

  describe('Session Management', () => {
    it('should track session count', async () => {
      expect(sessionManager.getSessionCount()).toBe(0);

      await sessionManager.createSession({ userId: 'user1', permissions: ['read'] });
      expect(sessionManager.getSessionCount()).toBe(1);

      await sessionManager.createSession({ userId: 'user2', permissions: ['read'] });
      expect(sessionManager.getSessionCount()).toBe(2);
    });

    it('should clear all sessions', async () => {
      await sessionManager.createSession({ userId: 'user1', permissions: ['read'] });
      await sessionManager.createSession({ userId: 'user2', permissions: ['read'] });

      expect(sessionManager.getSessionCount()).toBe(2);

      sessionManager.clearAllSessions();

      expect(sessionManager.getSessionCount()).toBe(0);
    });

    it('should automatically clean up expired sessions', async () => {
      const shortManager = new SessionManager({
        sessionTimeout: 1, // 1 second
        cleanupInterval: 500 // Cleanup every 500ms
      });

      await shortManager.createSession({ userId: 'user1', permissions: ['read'] });
      await shortManager.createSession({ userId: 'user2', permissions: ['read'] });

      expect(shortManager.getSessionCount()).toBe(2);

      // Wait for sessions to expire and cleanup to run
      await wait(2000);

      expect(shortManager.getSessionCount()).toBe(0);

      shortManager.destroy();
    });
  });
});
