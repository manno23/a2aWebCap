/**
 * AuthenticationService - Workers-compatible authentication implementation
 *
 * Implements:
 * - JWT validation with signature verification using Web Crypto API
 * - API key validation with hashing
 * - OAuth 2.0 token introspection (optional)
 * - Audit logging
 */

import * as jwt from './jwt-worker.js';
import crypto from 'crypto';
import { createLogger, type Logger } from '../shared/logger.js';

// Minimal type definitions for missing types - simplified for compilation
interface Capability {
  name: string;
  resource: string;
  actions?: string[];
  resources?: string[];
  expiresAt?: Date;
}

interface CapabilitySet {
  capabilities: Capability[];
  globalCapabilities?: Capability[];
  taskCapabilities?: Capability[];
}

interface AuthCredentials {
  type: 'jwt' | 'apikey' | 'oauth2' | 'bearer';
  token: string;
  apiKey?: string;
}

interface AuthResult {
  authenticated: boolean;
  userId?: string;
  permissions?: string[];
  capabilities?: CapabilitySet;
  metadata?: Record<string, any>;
  expiresAt?: Date;
}

const log = createLogger('auth-service');

export interface AuthenticationServiceConfig {
  jwtSecret: string;
  jwtAlgorithm?: string;
  jwtIssuer?: string;
  jwtAudience?: string;
  apiKeyHashAlgorithm?: string;
}

export interface ApiKey {
  id: string;
  hashedKey: string;
  userId: string;
  permissions: string[];
  expiresAt?: Date;
  lastUsedAt?: Date;
  createdAt: Date;
}

export interface AuthAuditLog {
  timestamp: Date;
  userId?: string;
  action: 'login' | 'logout' | 'token_refresh' | 'access_denied' | 'token_validation';
  success: boolean;
  method: 'bearer' | 'apikey' | 'oauth2' | 'mtls' | 'custom';
  ipAddress?: string;
  userAgent?: string;
  reason?: string;
}

/**
 * In-memory API key store (for MVP - use database in production)
 */
class ApiKeyStore {
  private keys = new Map<string, ApiKey>();

  async findByHash(hashedKey: string): Promise<ApiKey | null> {
    for (const key of this.keys.values()) {
      if (key.hashedKey === hashedKey) {
        return key;
      }
    }
    return null;
  }

  async create(apiKey: ApiKey): Promise<void> {
    this.keys.set(apiKey.id, apiKey);
  }

  async update(id: string, updates: Partial<ApiKey>): Promise<void> {
    const key = this.keys.get(id);
    if (key) {
      Object.assign(key, updates);
    }
  }

  async delete(id: string): Promise<void> {
    this.keys.delete(id);
  }

  async list(): Promise<ApiKey[]> {
    return Array.from(this.keys.values());
  }
}

/**
 * Main authentication service
 */
export class AuthenticationService {
  private capabilities = new Map<string, CapabilitySet>();

  createCapabilitySet(sessionId: string): CapabilitySet {
    const capSet: CapabilitySet = {
      taskCapabilities: {},
      globalCapabilities: []
    };
    this.capabilities.set(sessionId, capSet);
    return capSet;
  }

  hasCapability(sessionId: string, action: string, resource: string, taskId?: string): boolean {
    const caps = this.capabilities.get(sessionId);
    if (!caps) return false;

    const checkCaps = (capabilities: Capability[]): boolean => {
      return capabilities.some(cap => 
        cap.actions.includes(action) && 
        cap.resources.includes(resource) && 
        (!cap.expiresAt || cap.expiresAt > Date.now())
      );
    };

    // Check global capabilities first
    if (checkCaps(caps.globalCapabilities)) return true;

    // Check task-specific capabilities
    if (taskId && caps.taskCapabilities[taskId]) {
      return checkCaps(caps.taskCapabilities[taskId]);
    }

    return false;
  }

  private generateCapabilityId(): string {
    return crypto.randomUUID();
  }

  private config: AuthenticationServiceConfig;
  private apiKeyStore: ApiKeyStore;
  private revokedTokens = new Set<string>(); // In-memory revocation list

  constructor(config: AuthenticationServiceConfig) {
    this.config = {
      jwtAlgorithm: 'HS256',
      apiKeyHashAlgorithm: 'sha256',
      ...config
    };
    this.apiKeyStore = new ApiKeyStore();

    log.info({ config: { jwtIssuer: config.jwtIssuer } }, 'AuthenticationService initialized');
  }

  /**
   * Main authentication entry point
   */
  async authenticate(
    credentials: AuthCredentials,
    metadata?: { ipAddress?: string; userAgent?: string }
  ): Promise<AuthResult> {
    const startTime = Date.now();

    try {
      let result: AuthResult;

      switch (credentials.type) {
        case 'bearer':
          result = await this.validateBearerToken(credentials.token!);
          break;

        case 'apikey':
          result = await this.validateApiKey(credentials.apiKey || credentials.token!);
          break;

        case 'oauth2':
          result = await this.validateOAuthToken(credentials.token!);
          break;

        default:
          result = {
            authenticated: false,
            metadata: { error: `Unsupported auth type: ${credentials.type}` }
          };
      }

      // Log authentication attempt
      this.logAuthEvent({
        timestamp: new Date(),
        userId: result.userId,
        action: 'login',
        success: result.authenticated,
        method: credentials.type as any,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        reason: result.authenticated ? undefined : result.metadata?.error
      });

      const duration = Date.now() - startTime;
      log.info(
        {
          authenticated: result.authenticated,
          userId: result.userId,
          method: credentials.type as any,
          duration
        },
        'Authentication attempt'
      );

      return result;
    } catch (error: any) {
      log.error({ error: error.message, method: credentials.type }, 'Authentication error');

      this.logAuthEvent({
        timestamp: new Date(),
        action: 'access_denied',
        success: false,
        method: credentials.type as any,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        reason: error.message
      });

      return {
        authenticated: false,
        metadata: { error: error.message }
      };
    }
  }

  /**
   * Validate JWT bearer token
   */
  private async validateBearerToken(token: string): Promise<AuthResult> {
    try {
      // Verify JWT signature and claims
      const decoded = await jwt.verify(token, this.config.jwtSecret, {
        algorithms: [this.config.jwtAlgorithm || 'HS256'],
        issuer: this.config.jwtIssuer,
        audience: this.config.jwtAudience
      });

      // Check if token is revoked
      const tokenId = decoded.jti;
      if (tokenId && this.revokedTokens.has(tokenId)) {
        return {
          authenticated: false,
          metadata: { error: 'Token has been revoked' }
        };
      }

      // Extract user information and permissions
      const userId = decoded.sub;
      const permissions = decoded.permissions || decoded.scope?.split(' ') || [];

      return {
        authenticated: true,
        userId,
        permissions,
        expiresAt: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : undefined,
        metadata: {
          tokenId,
          issuedAt: decoded.iat ? new Date(decoded.iat * 1000).toISOString() : undefined
        }
      };
    } catch (error: any) {
      // Distinguish between different JWT errors
      if (error.name === 'TokenExpiredError') {
        return {
          authenticated: false,
          metadata: { error: 'Token has expired', errorType: 'expired' }
        };
      } else if (error.name === 'JsonWebTokenError') {
        return {
          authenticated: false,
          metadata: { error: 'Invalid token signature', errorType: 'invalid_signature' }
        };
      } else {
        return {
          authenticated: false,
          metadata: { error: error.message, errorType: 'unknown' }
        };
      }
    }
  }

  /**
   * Validate API key
   */
  private async validateApiKey(apiKey: string): Promise<AuthResult> {
    try {
      // Extract key prefix (e.g., "ak_live_" or "ak_test_")
      const parts = apiKey.split('_');
      if (parts.length < 3 || parts[0] !== 'ak') {
        return {
          authenticated: false,
          metadata: { error: 'Invalid API key format' }
        };
      }

      // Hash the key
      const hashedKey = this.hashApiKey(apiKey);

      // Look up in store
      const storedKey = await this.apiKeyStore.findByHash(hashedKey);

      if (!storedKey) {
        return {
          authenticated: false,
          metadata: { error: 'API key not found' }
        };
      }

      // Check expiry
      if (storedKey.expiresAt && storedKey.expiresAt < new Date()) {
        return {
          authenticated: false,
          metadata: { error: 'API key has expired' }
        };
      }

      // Update last used timestamp (async, don't wait)
      this.apiKeyStore
        .update(storedKey.id, { lastUsedAt: new Date() })
        .catch((err) => log.error({ error: err }, 'Failed to update API key last used'));

      return {
        authenticated: true,
        userId: storedKey.userId,
        permissions: storedKey.permissions,
        expiresAt: storedKey.expiresAt?.toISOString(),
        metadata: {
          keyId: storedKey.id,
          createdAt: storedKey.createdAt.toISOString()
        }
      };
    } catch (error: any) {
      return {
        authenticated: false,
        metadata: { error: error.message }
      };
    }
  }

  /**
   * Validate OAuth 2.0 token via introspection
   * (Placeholder implementation - requires OAuth provider configuration)
   */
  private async validateOAuthToken(token: string): Promise<AuthResult> {
    // In production, this would call the OAuth introspection endpoint
    // For MVP, we'll just return a not-implemented response

    log.warn('OAuth 2.0 token validation not fully implemented');

    return {
      authenticated: false,
      metadata: {
        error: 'OAuth 2.0 validation not configured',
        hint: 'Configure OAUTH_INTROSPECTION_URL in environment'
      }
    };
  }

  /**
   * Hash an API key for storage
   */
  private hashApiKey(apiKey: string): string {
    return crypto
      .createHash(this.config.apiKeyHashAlgorithm!)
      .update(apiKey)
      .digest('hex');
  }

  /**
   * Generate a new API key
   */
  generateApiKey(
    userId: string,
    permissions: string[],
    options?: { expiresIn?: number; environment?: 'live' | 'test' }
  ): { apiKey: string; keyId: string } {
    const env = options?.environment || 'test';
    const keyId = crypto.randomUUID();
    const randomPart = crypto.randomBytes(32).toString('hex');
    const apiKey = `ak_${env}_${randomPart}`;

    const hashedKey = this.hashApiKey(apiKey);

    const expiresAt = options?.expiresIn
      ? new Date(Date.now() + options.expiresIn * 1000)
      : undefined;

    const keyData: ApiKey = {
      id: keyId,
      hashedKey,
      userId,
      permissions,
      expiresAt,
      createdAt: new Date()
    };

    this.apiKeyStore.create(keyData).catch((err) => {
      log.error({ error: err }, 'Failed to store API key');
    });

    log.info({ userId, keyId, expiresAt }, 'Generated new API key');

    return { apiKey, keyId };
  }

  /**
   * Revoke a JWT token
   */
  revokeToken(tokenId: string): void {
    this.revokedTokens.add(tokenId);
    log.info({ tokenId }, 'Token revoked');
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(keyId: string): Promise<void> {
    await this.apiKeyStore.delete(keyId);
    log.info({ keyId }, 'API key revoked');
  }

  /**
   * List all API keys for a user
   */
  async listApiKeys(userId: string): Promise<Array<Omit<ApiKey, 'hashedKey'>>> {
    const allKeys = await this.apiKeyStore.list();
    return allKeys
      .filter((key) => key.userId === userId)
      .map(({ hashedKey, ...rest }) => rest);
  }

  /**
   * Log authentication event (for audit trail)
   */
  private logAuthEvent(event: AuthAuditLog): void {
    log.info(
      {
        ...event,
        level: event.success ? 'info' : 'warn',
        category: 'auth_audit'
      },
      `Auth: ${event.action} - ${event.success ? 'success' : 'failed'}`
    );

    // In production, persist to audit database
    // auditDatabase.insert(event).catch(...)
  }

  /**
   * Generate a JWT token (for testing or token creation)
   */
  async generateJWT(
    userId: string,
    permissions: string[],
    options?: { expiresIn?: string; tokenId?: string }
  ): Promise<string> {
    const payload = {
      sub: userId,
      permissions,
      jti: options?.tokenId || crypto.randomUUID(),
      iss: this.config.jwtIssuer,
      aud: this.config.jwtAudience
    };

    const signOptions: any = {
      algorithm: this.config.jwtAlgorithm || 'HS256',
      expiresIn: options?.expiresIn || '1h'
    };

    return jwt.sign(payload, this.config.jwtSecret, signOptions);
  }

  /**
   * Get the underlying API key store (for testing)
   */
  getApiKeyStore(): ApiKeyStore {
    return this.apiKeyStore;
  }
}
