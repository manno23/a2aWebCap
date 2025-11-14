# Authentication Specification for a2aWebCap
**Project:** a2aWebCap - A2A Protocol with Cap'n Proto Web Transport  
**Date:** 2025-11-14  
**Phase:** Phase 4 - Production Readiness  
**Version:** 1.0  

---

## Executive Summary

This document specifies the complete authentication and authorization architecture for the a2aWebCap project, integrating requirements from both the A2A Protocol v0.4.0 specification and Cap'n Proto Web (capnweb) best practices. The architecture uses a **hybrid approach**: traditional token-based authentication for initial identity verification, followed by capability-based authorization for fine-grained access control.

**Key Design Decision:** Use A2A-compliant HTTP/WebSocket authentication at the transport layer, then leverage capnweb's capability model for authorization to achieve both standards compliance and enhanced security.

---

## Table of Contents

1. [A2A Protocol Authentication Requirements](#1-a2a-protocol-authentication-requirements)
2. [CapnWeb Authentication Patterns](#2-capnweb-authentication-patterns)
3. [Recommended Implementation Approach](#3-recommended-implementation-approach)
4. [Security Considerations](#4-security-considerations)
5. [Testing Requirements](#5-testing-requirements)
6. [Implementation Roadmap](#6-implementation-roadmap)
7. [References](#7-references)

---

## 1. A2A Protocol Authentication Requirements

### 1.1 Protocol Overview

The A2A Protocol v0.4.0 specifies authentication as a **transport-layer concern**, not embedded in protocol payloads. Key requirements:

| Requirement | Description | Priority |
|-------------|-------------|----------|
| **R1: Discovery** | Clients discover auth schemes via AgentCard | MUST |
| **R2: HTTP Headers** | Credentials transmitted in HTTP headers | MUST |
| **R3: Every Request** | Servers authenticate every incoming request | MUST |
| **R4: Standard Codes** | Use 401/403 for auth failures | SHOULD |
| **R5: Multiple Schemes** | Support multiple auth schemes | MAY |
| **R6: Scheme Types** | Support Bearer, ApiKey, OAuth2, mTLS, Custom | SHOULD |

### 1.2 Required Authentication Schemes

Based on A2A specification and industry standards:

#### 1.2.1 Bearer Token Authentication
```typescript
// AgentCard declaration
{
  authentication: [
    {
      type: "bearer",
      description: "OAuth 2.0 or JWT bearer token",
      parameters: {
        headerName: "Authorization",
        format: "Bearer <token>"
      }
    }
  ]
}

// Client usage
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Requirements:**
- Token validation (signature, expiry, issuer)
- JWT standard compliance (RFC 7519)
- Support for refresh tokens
- Token revocation checking

#### 1.2.2 API Key Authentication
```typescript
{
  authentication: [
    {
      type: "apikey",
      description: "API key for service-to-service auth",
      parameters: {
        headerName: "X-API-Key",
        format: "<key>"
      }
    }
  ]
}

// Client usage
X-API-Key: ak_live_1234567890abcdef
```

**Requirements:**
- Secure key storage (hashed, not plaintext)
- Key rotation support
- Per-key rate limiting
- Usage tracking and auditing

#### 1.2.3 OAuth 2.0 / OpenID Connect
```typescript
{
  authentication: [
    {
      type: "oauth2",
      description: "OAuth 2.0 authorization code flow",
      parameters: {
        authorizationUrl: "https://auth.example.com/oauth/authorize",
        tokenUrl: "https://auth.example.com/oauth/token",
        scopes: ["read", "write", "execute"]
      }
    }
  ]
}
```

**Requirements:**
- OAuth 2.0 flow support (RFC 6749)
- OpenID Connect discovery
- Token introspection
- Scope validation

#### 1.2.4 Mutual TLS (mTLS)
```typescript
{
  authentication: [
    {
      type: "mtls",
      description: "Client certificate authentication",
      parameters: {
        requireClientCert: true,
        trustedCA: "CN=MyCA, O=Example Org"
      }
    }
  ]
}
```

**Requirements:**
- TLS 1.3 support
- Client certificate validation
- CA trust chain verification
- Certificate revocation checking (OCSP/CRL)

### 1.3 Authentication Message Flow

```
┌──────────┐                                    ┌──────────┐
│  Client  │                                    │  Server  │
└────┬─────┘                                    └────┬─────┘
     │                                               │
     │ 1. GET /.well-known/agent.json               │
     │──────────────────────────────────────────────>│
     │                                               │
     │ 2. AgentCard (with auth requirements)         │
     │<──────────────────────────────────────────────│
     │                                               │
     │ 3. Acquire credentials (out-of-band)          │
     │    - OAuth flow, API key provisioning, etc.   │
     │                                               │
     │ 4. Request with credentials                   │
     │    Authorization: Bearer <token>              │
     │──────────────────────────────────────────────>│
     │                                               │
     │                            5. Validate token  │
     │                               - Signature     │
     │                               - Expiry        │
     │                               - Permissions   │
     │                                               │
     │ 6. Response (or 401/403)                      │
     │<──────────────────────────────────────────────│
     │                                               │
     │ 7. Subsequent requests (with credentials)     │
     │    Authorization: Bearer <token>              │
     │──────────────────────────────────────────────>│
     │                                               │
     │ 8. Response                                   │
     │<──────────────────────────────────────────────│
```

### 1.4 Error Handling Requirements

| Error Type | HTTP Status | Response Format |
|------------|-------------|-----------------|
| No credentials | 401 Unauthorized | `WWW-Authenticate: Bearer realm="a2a"` |
| Invalid credentials | 401 Unauthorized | `{ "error": "UNAUTHORIZED", "message": "Invalid token" }` |
| Insufficient permissions | 403 Forbidden | `{ "error": "FORBIDDEN", "message": "Insufficient permissions" }` |
| Expired credentials | 401 Unauthorized | `{ "error": "UNAUTHORIZED", "message": "Token expired" }` |
| Rate limit exceeded | 429 Too Many Requests | `{ "error": "RATE_LIMIT_EXCEEDED" }` |

### 1.5 A2A Compliance Gaps in Current Implementation

**Current Status:** Stub implementation accepts any non-empty token

**Critical Gaps:**
- ❌ No token validation (signature, expiry)
- ❌ No actual authentication against identity provider
- ❌ No API key management
- ❌ No OAuth 2.0 flow support
- ❌ No mTLS support
- ❌ No rate limiting
- ❌ No audit logging
- ❌ No WWW-Authenticate challenge headers

---

## 2. CapnWeb Authentication Patterns

### 2.1 Capability-Based Security Model

CapnWeb implements an **object-capability security model**, which differs fundamentally from traditional authentication:

| Traditional Auth | Capability-Based Auth |
|------------------|----------------------|
| Identity + ACL lookup | Possession = Authority |
| Token on every request | One-time auth, then capability |
| Ambient authority | No ambient authority |
| External revocation list | Direct stub disposal |
| Difficult delegation | Natural reference passing |

### 2.2 WebSocket Authentication Challenge

**Critical Browser Limitation:** The WebSocket API in browsers **does not allow setting custom headers**.

```javascript
// ❌ This does NOT work in browsers:
const ws = new WebSocket('wss://agent.com/a2a', {
  headers: { 'Authorization': 'Bearer token123' }
});
```

This creates a fundamental authentication challenge for browser-based clients.

#### 2.2.1 Workaround Options

**Option A: URL Query Parameters (⚠️ INSECURE)**
```javascript
// ❌ BAD: Token exposed in URLs
const ws = new WebSocket('wss://agent.com/a2a?token=secret123');
```
**Problems:**
- Tokens logged by proxies, servers, browsers
- Visible in browser history
- May be cached
- Security risk: HIGH

**Option B: First Message Authentication (✅ ACCEPTABLE)**
```javascript
// ✅ Send auth in first message
const ws = new WebSocket('wss://agent.com/a2a');
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'authenticate',
    token: 'Bearer token123'
  }));
};
```
**Problems:**
- Server must hold connection before auth (DoS vector)
- Requires state management
- Non-standard flow
**Benefits:**
- Token not in URL
- Works in all browsers
- Relatively simple

**Option C: HTTP Upgrade Pattern (✅ RECOMMENDED)**
```javascript
// ✅ BEST: Two-phase authentication
// Phase 1: HTTP auth
const response = await fetch('https://agent.com/a2a/auth', {
  headers: { 'Authorization': 'Bearer token123' }
});
const sessionId = await response.json();

// Phase 2: WebSocket with session token
const ws = new WebSocket(`wss://agent.com/a2a?session=${sessionId}`);
```
**Benefits:**
- Standard HTTP auth
- Session token is short-lived
- Minimizes token exposure
- Compatible with A2A requirements
**Tradeoffs:**
- Two-phase flow (more complex)
- Session management required

### 2.3 Capability Pattern: Authentication Service

The recommended capnweb pattern from the security analysis:

```typescript
/**
 * Public API - No authentication required
 */
class PublicA2AService extends RpcTarget {
  /**
   * Authenticate and receive capability-secured stub
   */
  async authenticate(credentials: AuthCredentials): Promise<AuthenticatedA2AService> {
    // 1. Validate credentials (JWT, API key, OAuth token)
    const authResult = await this.authService.validate(credentials);
    
    if (!authResult.valid) {
      throw new Error('UNAUTHORIZED: Invalid credentials');
    }
    
    // 2. Return capability-secured stub with user context
    return new AuthenticatedA2AService(
      this.taskManager,
      authResult.userId,
      authResult.permissions
    );
  }
  
  /**
   * Public agent card (no auth required)
   */
  getAgentCard(): AgentCard {
    return { /* ... */ };
  }
}

/**
 * Authenticated API - Capability-secured
 */
class AuthenticatedA2AService extends RpcTarget {
  constructor(
    private taskManager: TaskManager,
    private userId: string,
    private permissions: string[]
  ) {
    super();
  }
  
  /**
   * All methods automatically have user context
   * No need to send credentials again!
   */
  async sendMessage(message: Message): Promise<Task> {
    // User context available via this.userId
    // No token validation needed - possession = authorization
    return await this.taskManager.createTask(message, {
      userId: this.userId
    });
  }
  
  async getTask(taskId: string): Promise<Task> {
    const task = await this.taskManager.getTask(taskId);
    
    // Capability-based authorization
    if (task.metadata?.userId !== this.userId) {
      throw new Error('FORBIDDEN: Task does not belong to user');
    }
    
    return task;
  }
}
```

### 2.4 Capability Security Patterns

#### 2.4.1 Attenuation (Least Privilege)
```typescript
/**
 * Create read-only version of a capability
 */
class ReadOnlyTaskWrapper extends RpcTarget {
  constructor(private task: Task) {
    super();
  }
  
  // Allow reading
  async getStatus(): Promise<TaskStatus> {
    return this.task.getStatus();
  }
  
  // Deny modification
  async cancel(): Promise<never> {
    throw new Error('FORBIDDEN: Read-only access');
  }
}

// Usage
const task = await api.sendMessage(...);
const readOnlyTask = new ReadOnlyTaskWrapper(task);
await shareWithObserver(readOnlyTask); // Observer can't cancel
```

#### 2.4.2 Membrane Pattern (Transitive Revocation)
```typescript
/**
 * Membrane wraps all capabilities for group revocation
 */
class Membrane {
  private revoked = false;
  private wrapped = new WeakMap();
  
  wrap<T extends RpcTarget>(inner: T): T {
    if (this.revoked) throw new Error('Membrane revoked');
    
    if (this.wrapped.has(inner)) {
      return this.wrapped.get(inner);
    }
    
    const proxy = new Proxy(inner, {
      get: (target, prop) => {
        if (this.revoked) throw new Error('Membrane revoked');
        const value = target[prop];
        
        // Wrap returned capabilities
        if (typeof value === 'object' && value instanceof RpcTarget) {
          return this.wrap(value);
        }
        
        return value;
      }
    });
    
    this.wrapped.set(inner, proxy);
    return proxy as T;
  }
  
  revoke(): void {
    this.revoked = true;
    // All wrapped capabilities immediately invalid
  }
}

// Usage: Time-limited access
const membrane = new Membrane();
const limitedApi = membrane.wrap(authenticatedApi);
user.setApi(limitedApi);

setTimeout(() => membrane.revoke(), 3600000); // 1 hour
```

#### 2.4.3 Swiss Numbers (Serializable Capabilities)
```typescript
/**
 * Swiss numbers: Unguessable tokens that restore capabilities
 * Bridges capability model with token persistence
 */
class CapabilityManager {
  private caps = new Map<string, RpcTarget>();
  
  // Convert capability to serializable token
  mint(capability: RpcTarget): string {
    const swissNumber = crypto.randomUUID();
    this.caps.set(swissNumber, capability);
    return swissNumber;
  }
  
  // Restore capability from token
  restore(swissNumber: string): RpcTarget | undefined {
    return this.caps.get(swissNumber);
  }
  
  // Revoke
  revoke(swissNumber: string): void {
    this.caps.delete(swissNumber);
  }
}

// Usage: Persist capability across restarts
const capManager = new CapabilityManager();
const taskCap = await api.sendMessage(...);
const token = capManager.mint(taskCap);
await saveToDatabase({ userId, taskToken: token });

// Later: Restore capability
const token = await loadFromDatabase(userId);
const taskCap = capManager.restore(token);
await taskCap.getStatus();
```

### 2.5 Browser Compatibility Considerations

| Feature | Chrome | Firefox | Safari | Edge | Node.js |
|---------|--------|---------|--------|------|---------|
| WebSocket | ✅ | ✅ | ✅ | ✅ | ✅ |
| Custom WS headers | ❌ | ❌ | ❌ | ❌ | ✅ |
| Fetch API | ✅ | ✅ | ✅ | ✅ | ✅ |
| TLS 1.3 | ✅ | ✅ | ✅ | ✅ | ✅ |
| HTTP/2 | ✅ | ✅ | ✅ | ✅ | ✅ |

**Implication:** For browser clients, we **MUST** use first-message auth or HTTP upgrade pattern.

---

## 3. Recommended Implementation Approach

### 3.1 Hybrid Architecture

**Design Philosophy:** Use token-based authentication (A2A-compliant) for identity verification, then leverage capabilities (capnweb-native) for authorization.

```
┌─────────────────────────────────────────────┐
│    Authentication Layer (Token-Based)       │
│  • OIDC/OAuth 2.0                          │
│  • JWT validation                          │
│  • API key verification                    │
│  • mTLS (transport)                        │
└──────────────┬──────────────────────────────┘
               │ (validate once)
               ▼
        ┌──────────────┐
        │  Return stub │
        └──────┬───────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│   Authorization Layer (Capability-Based)    │
│  • Possession = authority                  │
│  • Fine-grained access control             │
│  • Attenuation & delegation                │
│  • Immediate revocation                    │
└─────────────────────────────────────────────┘
```

### 3.2 Authentication Flow (Step-by-Step)

#### Phase 1: Discovery
```typescript
// Client discovers auth requirements
const agentCard = await fetch('https://agent.com/.well-known/agent.json')
  .then(r => r.json());

console.log(agentCard.authentication);
// [{ type: "bearer", description: "OAuth 2.0 token" }]
```

#### Phase 2: Credential Acquisition (Out-of-Band)
```typescript
// Example: OAuth 2.0 flow
const authUrl = agentCard.authentication[0].parameters.authorizationUrl;
// User completes OAuth flow in browser...
const accessToken = await completeOAuthFlow(authUrl);
```

#### Phase 3: Initial Authentication (HTTP)
```typescript
// For browser clients: Two-phase auth
// Step 3a: HTTP authentication
const sessionResponse = await fetch('https://agent.com/a2a/auth', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ clientInfo: 'browser' })
});

if (!sessionResponse.ok) {
  throw new Error('Authentication failed');
}

const { sessionId, expiresIn } = await sessionResponse.json();

// Step 3b: WebSocket connection with session
const ws = new WebSocket(`wss://agent.com/a2a?session=${sessionId}`);
```

#### Phase 4: Capability Acquisition (First Message)
```typescript
// After WebSocket connected
ws.onopen = async () => {
  // Send authenticate RPC call
  const authMessage = {
    id: crypto.randomUUID(),
    method: 'authenticate',
    params: {
      credentials: {
        type: 'bearer',
        token: accessToken
      }
    }
  };
  
  ws.send(JSON.stringify(authMessage));
};

ws.onmessage = (event) => {
  const response = JSON.parse(event.data);
  
  if (response.method === 'authenticate') {
    // Server returned authenticated stub reference
    const authenticatedStubId = response.result.stubId;
    // All subsequent calls use this stub
  }
};
```

#### Phase 5: Authorized Operations (No More Credentials!)
```typescript
// No credentials needed - possession of stub = authorization
const sendMessageRequest = {
  id: crypto.randomUUID(),
  method: 'sendMessage',
  stub: authenticatedStubId, // Reference to authenticated stub
  params: {
    message: {
      messageId: crypto.randomUUID(),
      role: 'user',
      parts: [{ kind: 'text', text: 'Hello' }]
    }
  }
};

ws.send(JSON.stringify(sendMessageRequest));
```

### 3.3 Message Format Specifications

#### 3.3.1 HTTP Authentication Endpoint

**Request:**
```http
POST /a2a/auth HTTP/1.1
Host: agent.example.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "clientInfo": "browser|node|mobile",
  "capabilities": ["sendMessage", "streamingTask"]
}
```

**Success Response:**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "sessionId": "sess_1234567890abcdef",
  "expiresIn": 3600,
  "userId": "user_abc123",
  "permissions": ["read", "write", "execute"]
}
```

**Error Response:**
```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="a2a", error="invalid_token"
Content-Type: application/json

{
  "error": "UNAUTHORIZED",
  "message": "Invalid or expired token",
  "code": "INVALID_TOKEN"
}
```

#### 3.3.2 WebSocket RPC Messages

**Authentication Call:**
```json
{
  "jsonrpc": "2.0",
  "id": "req-001",
  "method": "authenticate",
  "params": {
    "credentials": {
      "type": "bearer",
      "token": "eyJhbGciOiJIUzI1NiIs..."
    }
  }
}
```

**Authentication Response:**
```json
{
  "jsonrpc": "2.0",
  "id": "req-001",
  "result": {
    "stubId": "stub_auth_abc123",
    "userId": "user_xyz789",
    "permissions": ["read", "write"],
    "expiresAt": "2025-11-14T12:00:00Z"
  }
}
```

**Subsequent Calls (with stub reference):**
```json
{
  "jsonrpc": "2.0",
  "id": "req-002",
  "stub": "stub_auth_abc123",
  "method": "sendMessage",
  "params": {
    "message": {
      "messageId": "msg-001",
      "role": "user",
      "parts": [{"kind": "text", "text": "Hello"}]
    }
  }
}
```

### 3.4 Token Validation Requirements

#### 3.4.1 JWT Validation
```typescript
import jwt from 'jsonwebtoken';

interface TokenValidationResult {
  valid: boolean;
  userId?: string;
  permissions?: string[];
  error?: string;
}

async function validateJWT(token: string): Promise<TokenValidationResult> {
  try {
    // 1. Verify signature
    const decoded = jwt.verify(token, process.env.JWT_SECRET!, {
      algorithms: ['HS256', 'RS256'],
      issuer: process.env.JWT_ISSUER,
      audience: process.env.JWT_AUDIENCE
    });
    
    // 2. Check expiry (jwt.verify does this automatically)
    
    // 3. Check custom claims
    if (typeof decoded !== 'object' || !decoded.sub) {
      return { valid: false, error: 'Invalid token structure' };
    }
    
    // 4. Check revocation list (optional)
    if (await isTokenRevoked(decoded.jti)) {
      return { valid: false, error: 'Token revoked' };
    }
    
    // 5. Extract permissions
    const permissions = decoded.permissions || [];
    
    return {
      valid: true,
      userId: decoded.sub,
      permissions
    };
  } catch (err: any) {
    return {
      valid: false,
      error: err.message
    };
  }
}
```

#### 3.4.2 API Key Validation
```typescript
import crypto from 'crypto';

interface ApiKey {
  id: string;
  hashedKey: string;
  userId: string;
  permissions: string[];
  expiresAt?: Date;
  lastUsedAt?: Date;
}

async function validateApiKey(apiKey: string): Promise<TokenValidationResult> {
  // 1. Extract key ID (prefix)
  const [prefix, keyValue] = apiKey.split('_');
  
  if (prefix !== 'ak') {
    return { valid: false, error: 'Invalid API key format' };
  }
  
  // 2. Hash the key
  const hashedKey = crypto
    .createHash('sha256')
    .update(keyValue)
    .digest('hex');
  
  // 3. Look up in database
  const storedKey = await database.apiKeys.findOne({ hashedKey });
  
  if (!storedKey) {
    return { valid: false, error: 'Invalid API key' };
  }
  
  // 4. Check expiry
  if (storedKey.expiresAt && storedKey.expiresAt < new Date()) {
    return { valid: false, error: 'API key expired' };
  }
  
  // 5. Update last used timestamp (async)
  database.apiKeys.update(storedKey.id, {
    lastUsedAt: new Date()
  }).catch(() => {});
  
  return {
    valid: true,
    userId: storedKey.userId,
    permissions: storedKey.permissions
  };
}
```

#### 3.4.3 OAuth 2.0 Token Introspection
```typescript
async function validateOAuthToken(token: string): Promise<TokenValidationResult> {
  // 1. Call OAuth introspection endpoint
  const response = await fetch(process.env.OAUTH_INTROSPECTION_URL!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(
        `${process.env.CLIENT_ID}:${process.env.CLIENT_SECRET}`
      ).toString('base64')}`
    },
    body: new URLSearchParams({ token })
  });
  
  const result = await response.json();
  
  // 2. Check active status
  if (!result.active) {
    return { valid: false, error: 'Token inactive' };
  }
  
  // 3. Extract user info
  return {
    valid: true,
    userId: result.sub,
    permissions: result.scope?.split(' ') || []
  };
}
```

### 3.5 Capability Mapping Strategy

**Goal:** Map user permissions (from token) to capability stubs with appropriate access levels.

```typescript
class AuthenticationService {
  constructor(
    private taskManager: TaskManager,
    private toolExecutor: ToolExecutor
  ) {}
  
  /**
   * Create capability-secured stub based on permissions
   */
  createAuthenticatedStub(
    userId: string,
    permissions: string[]
  ): AuthenticatedA2AService {
    // Map permissions to access levels
    const accessLevel = this.determineAccessLevel(permissions);
    
    switch (accessLevel) {
      case 'read':
        return new ReadOnlyA2AService(this.taskManager, userId);
      
      case 'write':
        return new StandardA2AService(this.taskManager, userId, permissions);
      
      case 'admin':
        return new AdminA2AService(
          this.taskManager,
          this.toolExecutor,
          userId,
          permissions
        );
      
      default:
        throw new Error('FORBIDDEN: Insufficient permissions');
    }
  }
  
  private determineAccessLevel(permissions: string[]): 'read' | 'write' | 'admin' {
    if (permissions.includes('admin')) return 'admin';
    if (permissions.includes('write') || permissions.includes('execute')) return 'write';
    return 'read';
  }
}

/**
 * Read-only stub (attenuated capability)
 */
class ReadOnlyA2AService extends RpcTarget {
  constructor(
    private taskManager: TaskManager,
    private userId: string
  ) {
    super();
  }
  
  // Allow reads
  async getTask(taskId: string): Promise<Task> {
    return this.taskManager.getTask(taskId);
  }
  
  async listTasks(params: ListTasksParams): Promise<ListTasksResult> {
    return this.taskManager.listTasks(params);
  }
  
  // Deny writes
  async sendMessage(): Promise<never> {
    throw new Error('FORBIDDEN: Read-only access');
  }
  
  async cancelTask(): Promise<never> {
    throw new Error('FORBIDDEN: Read-only access');
  }
}
```

### 3.6 Error Handling Approach

```typescript
/**
 * Authentication error hierarchy
 */
class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public httpStatus: number,
    public headers?: Record<string, string>
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

class UnauthorizedError extends AuthError {
  constructor(message: string, scheme?: string) {
    const headers = scheme
      ? { 'WWW-Authenticate': `${scheme} realm="a2a"` }
      : undefined;
    
    super(message, 'UNAUTHORIZED', 401, headers);
  }
}

class ForbiddenError extends AuthError {
  constructor(message: string) {
    super(message, 'FORBIDDEN', 403);
  }
}

class RateLimitError extends AuthError {
  constructor(retryAfter: number) {
    super(
      'Rate limit exceeded',
      'RATE_LIMIT_EXCEEDED',
      429,
      { 'Retry-After': retryAfter.toString() }
    );
  }
}

/**
 * Error handler middleware
 */
function handleAuthError(error: Error): Response {
  if (error instanceof AuthError) {
    return new Response(
      JSON.stringify({
        error: error.code,
        message: error.message
      }),
      {
        status: error.httpStatus,
        headers: {
          'Content-Type': 'application/json',
          ...error.headers
        }
      }
    );
  }
  
  // Unknown error
  return new Response(
    JSON.stringify({
      error: 'INTERNAL_ERROR',
      message: 'Authentication failed'
    }),
    {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}
```

---

## 4. Security Considerations

### 4.1 Threat Model

| Threat | Impact | Mitigation |
|--------|--------|------------|
| **Token theft** | HIGH | Short-lived tokens, secure storage, HTTPS only |
| **Replay attacks** | MEDIUM | Nonce/timestamp validation, token binding |
| **Man-in-the-middle** | HIGH | TLS 1.3, certificate pinning |
| **Token forgery** | HIGH | Signature validation, secure secrets |
| **Credential stuffing** | MEDIUM | Rate limiting, account lockout |
| **Session hijacking** | HIGH | Secure session tokens, IP validation |
| **Privilege escalation** | HIGH | Capability attenuation, least privilege |
| **DoS (unauthenticated)** | MEDIUM | Rate limiting at edge, CAPTCHA |

### 4.2 Mitigation Strategies

#### 4.2.1 Token Security
```typescript
// Token storage best practices
class SecureTokenStore {
  // NEVER store tokens in localStorage (XSS risk)
  // Use httpOnly cookies or sessionStorage
  
  setToken(token: string): void {
    // Option 1: httpOnly cookie (best for web)
    document.cookie = `authToken=${token}; Secure; HttpOnly; SameSite=Strict; Max-Age=3600`;
    
    // Option 2: sessionStorage (acceptable)
    sessionStorage.setItem('authToken', token);
    
    // ❌ NEVER: localStorage (XSS vulnerable)
    // localStorage.setItem('authToken', token);
  }
  
  getToken(): string | null {
    // Read from sessionStorage
    return sessionStorage.getItem('authToken');
  }
  
  clearToken(): void {
    sessionStorage.removeItem('authToken');
    document.cookie = 'authToken=; Max-Age=0';
  }
}
```

#### 4.2.2 Rate Limiting
```typescript
import { RateLimiter } from 'rate-limiter-flexible';

const rateLimiter = new RateLimiter({
  points: 100,        // Number of requests
  duration: 60,       // Per 60 seconds
  blockDuration: 300  // Block for 5 minutes if exceeded
});

async function checkRateLimit(userId: string): Promise<void> {
  try {
    await rateLimiter.consume(userId);
  } catch (err) {
    throw new RateLimitError(300); // Retry after 5 minutes
  }
}
```

#### 4.2.3 Audit Logging
```typescript
interface AuthAuditLog {
  timestamp: Date;
  userId?: string;
  action: 'login' | 'logout' | 'token_refresh' | 'access_denied';
  success: boolean;
  ipAddress: string;
  userAgent: string;
  reason?: string;
}

function logAuthEvent(event: AuthAuditLog): void {
  logger.info({
    ...event,
    level: event.success ? 'info' : 'warn',
    category: 'auth_audit'
  });
  
  // Persist to audit database
  auditDatabase.insert(event).catch(err => {
    logger.error({ error: err }, 'Failed to persist audit log');
  });
}

// Usage
logAuthEvent({
  timestamp: new Date(),
  userId: 'user_123',
  action: 'login',
  success: true,
  ipAddress: request.ip,
  userAgent: request.headers['user-agent']
});
```

### 4.3 Best Practices

#### 4.3.1 Token Expiry
- **Access tokens:** 15-60 minutes
- **Refresh tokens:** 7-30 days
- **Session tokens:** 1-24 hours
- **API keys:** 90-365 days (with rotation)

#### 4.3.2 Secure Credential Storage
```typescript
import crypto from 'crypto';

/**
 * Hash API keys before storage (never store plaintext)
 */
function hashApiKey(apiKey: string): string {
  return crypto
    .createHash('sha256')
    .update(apiKey)
    .digest('hex');
}

/**
 * Generate secure API keys
 */
function generateApiKey(): string {
  const prefix = 'ak';
  const env = process.env.NODE_ENV === 'production' ? 'live' : 'test';
  const random = crypto.randomBytes(32).toString('hex');
  
  return `${prefix}_${env}_${random}`;
}
```

#### 4.3.3 HTTPS Enforcement
```typescript
/**
 * Redirect HTTP to HTTPS in production
 */
function enforceHTTPS(request: Request): Response | null {
  if (process.env.NODE_ENV === 'production' &&
      request.url.startsWith('http://')) {
    const httpsUrl = request.url.replace('http://', 'https://');
    return Response.redirect(httpsUrl, 301);
  }
  return null;
}
```

---

## 5. Testing Requirements

### 5.1 Required Test Cases for Authentication

#### 5.1.1 Unit Tests

**Token Validation Tests:**
```typescript
describe('JWT Validation', () => {
  test('should accept valid JWT', async () => {
    const token = generateValidJWT({ sub: 'user_123' });
    const result = await validateJWT(token);
    
    expect(result.valid).toBe(true);
    expect(result.userId).toBe('user_123');
  });
  
  test('should reject expired JWT', async () => {
    const token = generateExpiredJWT();
    const result = await validateJWT(token);
    
    expect(result.valid).toBe(false);
    expect(result.error).toContain('expired');
  });
  
  test('should reject tampered JWT', async () => {
    const token = generateTamperedJWT();
    const result = await validateJWT(token);
    
    expect(result.valid).toBe(false);
    expect(result.error).toContain('signature');
  });
  
  test('should reject JWT from wrong issuer', async () => {
    const token = generateJWT({ iss: 'evil.com' });
    const result = await validateJWT(token);
    
    expect(result.valid).toBe(false);
  });
});

describe('API Key Validation', () => {
  test('should accept valid API key', async () => {
    const apiKey = await createTestApiKey('user_123');
    const result = await validateApiKey(apiKey);
    
    expect(result.valid).toBe(true);
    expect(result.userId).toBe('user_123');
  });
  
  test('should reject invalid API key', async () => {
    const result = await validateApiKey('ak_live_invalid');
    
    expect(result.valid).toBe(false);
  });
  
  test('should reject expired API key', async () => {
    const apiKey = await createExpiredApiKey();
    const result = await validateApiKey(apiKey);
    
    expect(result.valid).toBe(false);
    expect(result.error).toContain('expired');
  });
});
```

**Capability Pattern Tests:**
```typescript
describe('Capability-Based Authorization', () => {
  test('should return authenticated stub after valid auth', async () => {
    const service = new A2AService();
    const credentials = { type: 'bearer', token: validToken };
    
    const authedStub = await service.authenticate(credentials);
    
    expect(authedStub).toBeInstanceOf(AuthenticatedA2AService);
  });
  
  test('should enforce user context in authenticated calls', async () => {
    const authedStub = await authenticateAs('user_123');
    const task = await authedStub.sendMessage(message);
    
    expect(task.metadata?.userId).toBe('user_123');
  });
  
  test('should reject access to other users tasks', async () => {
    const user1 = await authenticateAs('user_1');
    const user2 = await authenticateAs('user_2');
    
    const task = await user1.sendMessage(message);
    
    await expect(user2.getTask(task.id)).rejects.toThrow('FORBIDDEN');
  });
  
  test('should revoke access when stub disposed', async () => {
    const authedStub = await authenticateAs('user_123');
    const task = await authedStub.sendMessage(message);
    
    // Dispose stub
    authedStub[Symbol.dispose]();
    
    // Should no longer work
    await expect(authedStub.getTask(task.id)).rejects.toThrow();
  });
});
```

#### 5.1.2 Integration Tests

**Authentication Flow Tests:**
```typescript
describe('Authentication Flow', () => {
  test('should complete full auth flow', async () => {
    // 1. Discover auth requirements
    const agentCard = await client.getAgentCard();
    expect(agentCard.authentication).toContainEqual({
      type: 'bearer'
    });
    
    // 2. Authenticate
    const token = await getTestToken();
    const session = await client.authenticate({ type: 'bearer', token });
    expect(session).toBeDefined();
    
    // 3. Make authenticated request
    const task = await client.sendMessage(message);
    expect(task.id).toBeDefined();
  });
  
  test('should reject unauthenticated requests', async () => {
    const client = new A2AClient(serverUrl);
    
    // Don't authenticate
    await expect(client.sendMessage(message))
      .rejects.toThrow('UNAUTHORIZED');
  });
  
  test('should handle token expiry gracefully', async () => {
    const client = await authenticatedClient();
    
    // Fast-forward time to expire token
    jest.advanceTimersByTime(3600 * 1000);
    
    // Should get 401
    await expect(client.sendMessage(message))
      .rejects.toThrow('UNAUTHORIZED');
  });
});
```

**Browser WebSocket Auth Tests:**
```typescript
describe('Browser WebSocket Authentication', () => {
  test('should authenticate via first message', async () => {
    const ws = new WebSocket(serverUrl);
    
    await new Promise((resolve) => {
      ws.onopen = () => {
        // Send auth as first message
        ws.send(JSON.stringify({
          type: 'authenticate',
          token: validToken
        }));
      };
      
      ws.onmessage = (event) => {
        const response = JSON.parse(event.data);
        expect(response.type).toBe('authenticated');
        expect(response.userId).toBeDefined();
        resolve();
      };
    });
  });
  
  test('should reject connection with invalid token', async () => {
    const ws = new WebSocket(serverUrl);
    
    await new Promise((resolve) => {
      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: 'authenticate',
          token: 'invalid_token'
        }));
      };
      
      ws.onmessage = (event) => {
        const response = JSON.parse(event.data);
        expect(response.error).toBe('UNAUTHORIZED');
        resolve();
      };
    });
  });
});
```

#### 5.1.3 Security Test Scenarios

**Penetration Testing:**
```typescript
describe('Security Tests', () => {
  test('should prevent token replay attacks', async () => {
    const token = captureToken();
    
    // Use token once
    await client.authenticate({ type: 'bearer', token });
    
    // Try to replay (should fail if nonce checking enabled)
    // Note: Basic implementation may allow this
    // Production MUST implement nonce/timestamp validation
  });
  
  test('should enforce rate limiting', async () => {
    const client = await authenticatedClient();
    
    // Make 101 requests rapidly
    const promises = Array.from({ length: 101 }, () =>
      client.sendMessage(message)
    );
    
    // Should reject some requests with 429
    await expect(Promise.all(promises)).rejects.toThrow('RATE_LIMIT_EXCEEDED');
  });
  
  test('should prevent privilege escalation', async () => {
    const readOnlyUser = await authenticateAs('user_ro', ['read']);
    
    // Try to send message (write operation)
    await expect(readOnlyUser.sendMessage(message))
      .rejects.toThrow('FORBIDDEN');
  });
  
  test('should sanitize error messages', async () => {
    try {
      await client.authenticate({ type: 'bearer', token: 'invalid' });
    } catch (err: any) {
      // Should NOT reveal implementation details
      expect(err.message).not.toContain('database');
      expect(err.message).not.toContain('stack trace');
      expect(err.message).toBe('UNAUTHORIZED: Invalid credentials');
    }
  });
});
```

### 5.2 Test Coverage Goals

| Component | Target Coverage | Priority |
|-----------|----------------|----------|
| Token validation | 95% | HIGH |
| Authentication flow | 90% | HIGH |
| Capability creation | 85% | MEDIUM |
| Error handling | 90% | HIGH |
| Rate limiting | 80% | MEDIUM |
| Audit logging | 70% | LOW |

---

## 6. Implementation Roadmap

### Week 1: Core Authentication (Days 1-5)

**Day 1-2: Token Validation Infrastructure**
- [ ] Implement JWT validation with jsonwebtoken library
- [ ] Implement API key hashing and validation
- [ ] Add token revocation checking (in-memory cache for MVP)
- [ ] Create validation result types and error classes
- [ ] Write unit tests (target: 95% coverage)

**Day 3-4: HTTP Authentication Endpoint**
- [ ] Create `/a2a/auth` POST endpoint
- [ ] Implement session token generation
- [ ] Add session storage (Redis or in-memory for MVP)
- [ ] Implement WWW-Authenticate challenge headers
- [ ] Write integration tests

**Day 5: WebSocket First-Message Auth**
- [ ] Implement first-message authentication handler
- [ ] Add session validation for WebSocket connections
- [ ] Handle connection rejection for invalid auth
- [ ] Write WebSocket auth tests

### Week 2: Capability Integration (Days 6-10)

**Day 6-7: Capability-Secured Stubs**
- [ ] Implement AuthenticatedA2AService with user context
- [ ] Add permission-based capability mapping
- [ ] Implement ReadOnlyA2AService (attenuation)
- [ ] Create capability disposal logic
- [ ] Write capability pattern tests

**Day 8: User Authorization**
- [ ] Add userId filtering to TaskManager
- [ ] Implement task ownership validation
- [ ] Add permission checking to tool execution
- [ ] Write authorization tests

**Day 9-10: Advanced Patterns**
- [ ] Implement Membrane pattern (optional)
- [ ] Implement Swiss numbers for capability serialization
- [ ] Add rate limiting per user
- [ ] Write security scenario tests

### Week 3: Production Hardening (Days 11-15)

**Day 11-12: OAuth 2.0 Integration**
- [ ] Implement OAuth 2.0 token introspection
- [ ] Add OIDC discovery support
- [ ] Implement refresh token flow
- [ ] Write OAuth tests

**Day 13: mTLS Support**
- [ ] Configure TLS client certificate validation
- [ ] Extract certificate info from requests
- [ ] Add certificate-based authentication
- [ ] Write mTLS tests

**Day 14: Monitoring & Logging**
- [ ] Implement comprehensive audit logging
- [ ] Add authentication metrics (Prometheus)
- [ ] Set up alerts for auth failures
- [ ] Create auth dashboard

**Day 15: Documentation & Testing**
- [ ] Complete authentication documentation
- [ ] Run full security test suite
- [ ] Perform manual penetration testing
- [ ] Update AgentCard with auth schemes

### Week 4: Integration & Deployment (Days 16-20)

**Day 16-17: Client Updates**
- [ ] Update client library with auth support
- [ ] Add browser-specific auth flow
- [ ] Create authentication examples
- [ ] Write client auth guide

**Day 18: Performance Testing**
- [ ] Benchmark auth latency
- [ ] Test rate limiting under load
- [ ] Optimize token validation
- [ ] Load test with 1000+ concurrent auths

**Day 19: Security Review**
- [ ] Internal security audit
- [ ] Fix identified vulnerabilities
- [ ] Update threat model
- [ ] Document security considerations

**Day 20: Production Deployment**
- [ ] Deploy to staging environment
- [ ] Run full test suite in staging
- [ ] Monitor for issues
- [ ] Deploy to production (phased rollout)

---

## 7. References

### 7.1 Specifications

1. **A2A Protocol v0.4.0 Specification**
   - https://a2a-protocol.org/dev/specification/
   - Section 4: Authentication requirements

2. **OAuth 2.0 (RFC 6749)**
   - https://datatracker.ietf.org/doc/html/rfc6749

3. **JWT Standard (RFC 7519)**
   - https://datatracker.ietf.org/doc/html/rfc7519

4. **TLS 1.3 (RFC 8446)**
   - https://datatracker.ietf.org/doc/html/rfc8446

### 7.2 CapnWeb Documentation

5. **Cloudflare Cap'n Proto Web**
   - https://github.com/cloudflare/capnweb
   - Object-capability security model

6. **Cloudflare Workers RPC**
   - https://blog.cloudflare.com/javascript-native-rpc/

### 7.3 Security Research

7. **Mark S. Miller - Robust Composition**
   - Capability-based security foundations
   - PhD Thesis, Johns Hopkins University (2006)

8. **Capability Myths Demolished**
   - Mark Miller, 2003
   - Technical Report SRL2003-02

9. **OWASP Authentication Cheat Sheet**
   - https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html

### 7.4 Internal Documents

10. **docs/capnweb-a2a-security-analysis-formal.md**
    - Formal security analysis (this codebase)
    - Capability vs token-based auth comparison

11. **docs/capnweb-a2a-transport-satisfiability-analysis(1).md**
    - Transport layer mapping analysis

12. **docs/A2A-COMPLIANCE-REPORT.md**
    - Current implementation status

---

## Appendix A: Code Examples

### A.1 Complete Authentication Service

```typescript
// packages/server/src/authentication-service.ts
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { AuthCredentials, AuthResult } from '@a2a-webcap/shared';

export class AuthenticationService {
  constructor(
    private jwtSecret: string,
    private apiKeyStore: ApiKeyStore
  ) {}
  
  async authenticate(credentials: AuthCredentials): Promise<AuthResult> {
    switch (credentials.type) {
      case 'bearer':
        return this.validateBearerToken(credentials.token!);
      
      case 'apikey':
        return this.validateApiKey(credentials.apiKey!);
      
      case 'oauth2':
        return this.validateOAuthToken(credentials.token!);
      
      default:
        throw new Error(`Unsupported auth type: ${credentials.type}`);
    }
  }
  
  private async validateBearerToken(token: string): Promise<AuthResult> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      
      return {
        authenticated: true,
        userId: decoded.sub,
        permissions: decoded.permissions || [],
        expiresAt: new Date(decoded.exp * 1000).toISOString()
      };
    } catch (err: any) {
      return {
        authenticated: false,
        metadata: { error: err.message }
      };
    }
  }
  
  private async validateApiKey(apiKey: string): Promise<AuthResult> {
    const hashedKey = crypto
      .createHash('sha256')
      .update(apiKey)
      .digest('hex');
    
    const storedKey = await this.apiKeyStore.findByHash(hashedKey);
    
    if (!storedKey || (storedKey.expiresAt && storedKey.expiresAt < new Date())) {
      return { authenticated: false };
    }
    
    return {
      authenticated: true,
      userId: storedKey.userId,
      permissions: storedKey.permissions
    };
  }
  
  private async validateOAuthToken(token: string): Promise<AuthResult> {
    // Call OAuth introspection endpoint
    const response = await fetch(process.env.OAUTH_INTROSPECTION_URL!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ token })
    });
    
    const result = await response.json();
    
    if (!result.active) {
      return { authenticated: false };
    }
    
    return {
      authenticated: true,
      userId: result.sub,
      permissions: result.scope?.split(' ') || []
    };
  }
}
```

### A.2 HTTP Auth Endpoint

```typescript
// packages/server/src/http-auth-endpoint.ts
import { Request, Response } from 'express';
import { AuthenticationService } from './authentication-service';
import { SessionManager } from './session-manager';

export async function handleAuthRequest(
  req: Request,
  res: Response,
  authService: AuthenticationService,
  sessionManager: SessionManager
): Promise<void> {
  // Extract credentials from Authorization header
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Missing Authorization header'
    });
    res.setHeader('WWW-Authenticate', 'Bearer realm="a2a"');
    return;
  }
  
  const [scheme, token] = authHeader.split(' ');
  
  if (scheme.toLowerCase() !== 'bearer') {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Only Bearer authentication supported'
    });
    return;
  }
  
  // Validate token
  const authResult = await authService.authenticate({
    type: 'bearer',
    token
  });
  
  if (!authResult.authenticated) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Invalid or expired token'
    });
    return;
  }
  
  // Create session
  const session = await sessionManager.createSession({
    userId: authResult.userId!,
    permissions: authResult.permissions!,
    expiresAt: new Date(Date.now() + 3600 * 1000) // 1 hour
  });
  
  res.status(200).json({
    sessionId: session.id,
    expiresIn: 3600,
    userId: authResult.userId,
    permissions: authResult.permissions
  });
}
```

---

## Appendix B: Configuration Templates

### B.1 Environment Variables

```bash
# Authentication Configuration
JWT_SECRET=your-secret-key-change-in-production
JWT_ISSUER=https://your-domain.com
JWT_AUDIENCE=a2a-api
JWT_ALGORITHM=HS256

# OAuth 2.0
OAUTH_AUTHORIZATION_URL=https://oauth.provider.com/authorize
OAUTH_TOKEN_URL=https://oauth.provider.com/token
OAUTH_INTROSPECTION_URL=https://oauth.provider.com/introspect
OAUTH_CLIENT_ID=your-client-id
OAUTH_CLIENT_SECRET=your-client-secret

# Session Management
SESSION_SECRET=your-session-secret
SESSION_TIMEOUT_SECONDS=3600

# Rate Limiting
RATE_LIMIT_WINDOW_SECONDS=60
RATE_LIMIT_MAX_REQUESTS=100

# Security
ENFORCE_HTTPS=true
ALLOWED_ORIGINS=https://your-app.com
```

### B.2 AgentCard with Auth

```json
{
  "protocolVersion": "0.4.0",
  "name": "Production A2A Agent",
  "description": "Secure A2A agent with full authentication",
  "url": "https://agent.example.com",
  "preferredTransport": "CAPNWEB",
  "capabilities": {
    "streaming": true,
    "bidirectional": true,
    "taskManagement": true,
    "toolExecution": true
  },
  "authentication": [
    {
      "type": "bearer",
      "description": "OAuth 2.0 Bearer token authentication",
      "parameters": {
        "authorizationUrl": "https://auth.example.com/oauth/authorize",
        "tokenUrl": "https://auth.example.com/oauth/token",
        "scopes": ["read", "write", "execute"]
      }
    },
    {
      "type": "apikey",
      "description": "API key for service-to-service authentication",
      "parameters": {
        "headerName": "X-API-Key",
        "format": "ak_{env}_{key}"
      }
    }
  ],
  "security": {
    "tls": {
      "version": "1.3",
      "requireClientCert": false
    },
    "rateLimit": {
      "requests": 100,
      "window": "60s"
    }
  }
}
```

---

**Document Status:** DRAFT v1.0  
**Next Review:** After Week 1 implementation  
**Approvers:** Security Team, A2A Core Team  

---
