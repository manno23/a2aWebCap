# CapnWeb DSL Language Reference

**Version:** 1.0  
**Date:** December 29, 2025  
**CapnWeb Version:** v0.2.0

## Table of Contents

1. [Introduction](#introduction)
2. [Language Concepts](#language-concepts)
3. [Type System and Transformations](#type-system-and-transformations)
4. [Serialization Format](#serialization-format)
5. [Wire Protocol](#wire-protocol)
6. [Practical Examples](#practical-examples)
7. [Comparison with Other RPC Systems](#comparison-with-other-rpc-systems)

---

## Introduction

CapnWeb is a JavaScript-native RPC (Remote Procedure Call) system developed by Cloudflare that brings Cap'n Proto's capability-based security model to web applications. Unlike traditional RPC systems, CapnWeb does not require separate schema files or code generation steps. Instead, it uses TypeScript classes and interfaces directly as the DSL (Domain Specific Language).

**Key Characteristics:**
- **Schema-less**: No `.capnp` or `.proto` files needed
- **TypeScript-native**: Your TypeScript classes ARE the schema
- **Runtime-based**: Serialization happens at runtime using JavaScript semantics
- **JSON-based**: Data serialization uses JSON with type extensions
- **Capability-oriented**: Security through object capabilities, not ambient authority

### Why CapnWeb for A2A?

This implementation uses CapnWeb as the transport layer for the Agent-to-Agent (A2A) protocol because it provides:
- Native bidirectional communication (superior to SSE)
- Promise pipelining for reduced latency
- Capability-based security (finer-grained than bearer tokens)
- No webhook infrastructure needed (callbacks are first-class)
- Seamless integration with Cloudflare Workers and Durable Objects

---

## Language Concepts

### 1. RpcTarget (Service Classes)

An `RpcTarget` is a class that defines RPC methods. It represents a service that can be called remotely.

**DSL Concept:**
```typescript
// TypeScript class definition
class MyService extends RpcTarget {
  async myMethod(param1: string, param2: number): Promise<Result> {
    // Implementation
    return { value: param1.repeat(param2) };
  }
}
```

**Transformation:**
- Each public `async` method becomes a callable RPC method
- Method names are preserved as-is
- Parameters are serialized according to the JSON serialization rules
- Return values must be Promise-wrapped or directly serializable

**Characteristics:**
- Stateful: `RpcTarget` instances can maintain internal state
- Lifecycle-managed: Can be disposed to revoke access
- Composable: Can return other `RpcTarget` instances as capabilities

### 2. RpcStub (Client Proxy)

An `RpcStub` is a client-side proxy that represents a remote `RpcTarget`.

**DSL Concept:**
```typescript
// Client obtains a stub
const stub: RpcStub<MyService> = await connect('https://service.example.com');

// Calling methods looks like local calls
const result = await stub.myMethod('hello', 3);
// result = { value: 'hellohellohello' }
```

**Transformation:**
- Method calls on the stub are converted to RPC requests
- The stub appears to have the same interface as the target class
- TypeScript provides compile-time type safety
- At runtime, method calls serialize parameters and deserialize responses

### 3. Endpoint

An `Endpoint` is the connection point that handles the HTTP/WebSocket transport.

**DSL Concept:**
```typescript
interface Endpoint {
  fetch(request: Request): Promise<Response>;
}
```

**Transformation:**
- `Endpoint.fetch()` is the low-level transport handler
- Receives HTTP Request objects containing serialized RPC calls
- Returns HTTP Response objects containing serialized results
- Can be implemented over HTTP batch requests or WebSocket connections

### 4. Capabilities (Returned RpcTargets)

Capabilities are `RpcTarget` instances returned from method calls, representing delegated access.

**DSL Concept:**
```typescript
class AuthService extends RpcTarget {
  async authenticate(credentials: Credentials): Promise<UserSession> {
    // Verify credentials
    if (valid) {
      // Return a capability-secured session
      return new UserSession(userId, permissions);
    }
    throw new Error('Authentication failed');
  }
}

class UserSession extends RpcTarget {
  constructor(
    private userId: string,
    private permissions: string[]
  ) {
    super();
  }

  async getProfile(): Promise<Profile> {
    // Automatically has user context - no auth token needed!
    return loadProfile(this.userId);
  }
  
  async updateProfile(data: ProfileUpdate): Promise<void> {
    // Permissions checked implicitly by capability possession
    if (!this.permissions.includes('profile:write')) {
      throw new Error('Insufficient permissions');
    }
    saveProfile(this.userId, data);
  }
}
```

**Transformation:**
- Initial call: `authService.authenticate(creds)` returns a `UserSession` stub
- Subsequent calls: `userSession.getProfile()` automatically include user context
- No bearer tokens needed in subsequent requests
- Disposing the session stub immediately revokes access

**Security Model:**
- **Ambient Authority Elimination**: You can only call methods on stubs you possess
- **Least Privilege**: Each stub grants access only to specific methods
- **Time-Limited**: Disposing a stub revokes access
- **Transitive**: Stubs can be passed to third parties

### 5. Streaming and Callbacks

CapnWeb supports bidirectional streaming through callback `RpcTarget` instances.

**DSL Concept:**
```typescript
// Callback interface defined as RpcTarget
abstract class TaskUpdateCallback extends RpcTarget {
  abstract onStatusUpdate(event: StatusUpdateEvent): Promise<void>;
  abstract onArtifactUpdate(event: ArtifactUpdateEvent): Promise<void>;
}

// Service method that accepts callback
class A2AService extends RpcTarget {
  async sendMessageStreaming(
    message: Message,
    config?: MessageSendConfig,
    callback?: TaskUpdateCallback
  ): Promise<StreamingTask> {
    const task = await this.createTask(message);
    const streamingTask = new StreamingTask(task);
    
    if (callback) {
      streamingTask.subscribe(callback);
    }
    
    return streamingTask;
  }
}

// Client implementation of callback
class ClientCallback extends TaskUpdateCallback {
  async onStatusUpdate(event: StatusUpdateEvent): Promise<void> {
    console.log('Status:', event.status.state);
  }
  
  async onArtifactUpdate(event: ArtifactUpdateEvent): Promise<void> {
    console.log('Artifact:', event.artifact);
  }
}

// Usage
const callback = new ClientCallback();
const stream = await service.sendMessageStreaming(message, config, callback);
// Server can now call callback methods directly!
```

**Transformation:**
- Client passes callback stub to server
- Server holds reference to callback stub
- Server makes RPC calls back to client's callback methods
- Bidirectional communication without webhooks

**Advantages over SSE/Webhooks:**
- No webhook URL management
- Native backpressure handling
- Type-safe callbacks
- Immediate delivery (no polling)
- Connection reuse

### 6. Promise Pipelining

CapnWeb supports promise pipelining, allowing dependent calls in a single round trip.

**DSL Concept:**
```typescript
// Without pipelining (3 round trips):
const auth = await authService.authenticate(creds);  // RTT 1
const user = await auth.getUser();                    // RTT 2
const profile = await user.getProfile();              // RTT 3

// With pipelining (1 round trip):
const auth = authService.authenticate(creds);         // Don't await yet
const user = auth.getUser();                          // Chain immediately
const profile = await user.getProfile();              // Await at the end
// All three calls sent in one batch!
```

**Transformation:**
- Promises can be chained before awaiting
- The runtime batches all calls into a single network request
- Server processes calls in dependency order
- Single response contains all results

---

## Type System and Transformations

### Primitive Types

CapnWeb uses JavaScript's native type system with JSON serialization.

| TypeScript Type | Wire Format | Example |
|----------------|-------------|---------|
| `string` | JSON string | `"hello"` |
| `number` | JSON number | `42` or `3.14` |
| `boolean` | JSON boolean | `true` or `false` |
| `null` | JSON null | `null` |
| `undefined` | Omitted or `null` | `null` |

### Extended Types

CapnWeb extends JSON with support for additional JavaScript types:

| TypeScript Type | Wire Format | Transformation |
|----------------|-------------|----------------|
| `Date` | ISO 8601 string | `{ "$type": "Date", "value": "2025-12-29T09:00:00.000Z" }` |
| `Uint8Array` | Base64 string | `{ "$type": "Uint8Array", "value": "SGVsbG8=" }` |
| `bigint` | String | `{ "$type": "bigint", "value": "9007199254740991" }` |
| `Error` | Object | `{ "$type": "Error", "message": "...", "stack": "..." }` |
| `RpcTarget` | Stub reference | `{ "$type": "stub", "$id": "stub-123" }` |

### Complex Types

**Objects:**
```typescript
// TypeScript
interface Profile {
  name: string;
  age: number;
  joined: Date;
}

// Wire format
{
  "name": "Alice",
  "age": 30,
  "joined": { "$type": "Date", "value": "2023-01-15T10:00:00.000Z" }
}
```

**Arrays:**
```typescript
// TypeScript
const items: string[] = ['a', 'b', 'c'];

// Wire format
["a", "b", "c"]
```

**Nested Objects:**
```typescript
// TypeScript
interface Task {
  id: string;
  metadata: Record<string, any>;
  parts: Part[];
}

// Wire format
{
  "id": "task-123",
  "metadata": {
    "priority": "high",
    "tags": ["urgent", "customer-facing"]
  },
  "parts": [
    { "kind": "text", "text": "Hello" }
  ]
}
```

### Method Signatures

Method signature transformation rules:

**Input Parameters:**
```typescript
// TypeScript method
async sendMessage(
  message: Message,
  config?: MessageSendConfig
): Promise<Task>

// Wire format (POST request body)
{
  "method": "sendMessage",
  "params": {
    "message": { /* Message object */ },
    "config": { /* MessageSendConfig object or omitted */ }
  },
  "id": "call-456"
}
```

**Return Values:**
```typescript
// TypeScript return
return {
  id: 'task-789',
  status: { state: 'working' }
};

// Wire format (Response body)
{
  "id": "call-456",
  "result": {
    "id": "task-789",
    "status": { "state": "working" }
  }
}
```

**Errors:**
```typescript
// TypeScript throw
throw new A2AError('Task not found', 'TASK_NOT_FOUND');

// Wire format (Response body)
{
  "id": "call-456",
  "error": {
    "$type": "Error",
    "name": "A2AError",
    "message": "Task not found",
    "code": "TASK_NOT_FOUND"
  }
}
```

### Capability References

When an `RpcTarget` is returned, it becomes a capability reference:

**TypeScript:**
```typescript
class AuthService extends RpcTarget {
  async authenticate(creds: Credentials): Promise<UserSession> {
    return new UserSession(userId);
  }
}
```

**Wire format (first response):**
```json
{
  "id": "call-100",
  "result": {
    "$type": "stub",
    "$id": "session-abc-123",
    "$interface": "UserSession"
  }
}
```

**Subsequent client calls:**
```json
{
  "method": "getProfile",
  "params": {},
  "id": "call-101",
  "$target": "session-abc-123"
}
```

The server maintains a mapping of stub IDs to `RpcTarget` instances, routing calls to the correct object.

---

## Serialization Format

### JSON-RPC Style Envelope

CapnWeb uses a JSON-RPC-inspired message format:

**Request:**
```json
{
  "method": "methodName",
  "params": {
    "arg1": "value1",
    "arg2": 42
  },
  "id": "unique-call-id",
  "$target": "optional-stub-id"
}
```

**Success Response:**
```json
{
  "id": "unique-call-id",
  "result": {
    /* Return value */
  }
}
```

**Error Response:**
```json
{
  "id": "unique-call-id",
  "error": {
    "$type": "Error",
    "name": "ErrorClassName",
    "message": "Error description",
    "code": "ERROR_CODE",
    "stack": "..."
  }
}
```

### Type Encoding Details

**1. Regular Objects:**
Plain JavaScript objects serialize as JSON objects directly:
```json
{ "name": "Alice", "age": 30 }
```

**2. Date Objects:**
```json
{
  "$type": "Date",
  "value": "2025-12-29T09:29:18.814Z"
}
```

**3. Binary Data (Uint8Array):**
```json
{
  "$type": "Uint8Array",
  "value": "SGVsbG8gV29ybGQ="
}
```
Base64 encoding is used for binary data.

**4. BigInt:**
```json
{
  "$type": "bigint",
  "value": "9007199254740992"
}
```

**5. Error Objects:**
```json
{
  "$type": "Error",
  "name": "A2AError",
  "message": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "stack": "A2AError: Rate limit exceeded\n    at ..."
}
```

**6. Stub References (Capabilities):**
```json
{
  "$type": "stub",
  "$id": "stub-unique-id",
  "$interface": "ClassName"
}
```

### Example: Complete A2A Message Exchange

**Client Request (sendMessage):**
```json
{
  "method": "sendMessage",
  "params": {
    "message": {
      "messageId": "msg-001",
      "role": "user",
      "parts": [
        {
          "kind": "text",
          "text": "Write a blog post about AI"
        }
      ]
    },
    "config": {
      "pushNotification": {
        "callback": {
          "$type": "stub",
          "$id": "callback-client-789",
          "$interface": "TaskUpdateCallback"
        }
      }
    }
  },
  "id": "call-001"
}
```

**Server Response:**
```json
{
  "id": "call-001",
  "result": {
    "id": "task-abc-123",
    "contextId": "ctx-456",
    "status": {
      "state": "submitted",
      "timestamp": {
        "$type": "Date",
        "value": "2025-12-29T09:30:00.000Z"
      }
    },
    "kind": "task"
  }
}
```

**Server Callback (pushed to client):**
```json
{
  "method": "onStatusUpdate",
  "params": {
    "event": {
      "type": "status",
      "taskId": "task-abc-123",
      "contextId": "ctx-456",
      "status": {
        "state": "working",
        "timestamp": {
          "$type": "Date",
          "value": "2025-12-29T09:30:05.000Z"
        }
      }
    }
  },
  "id": "callback-001",
  "$target": "callback-client-789"
}
```

---

## Wire Protocol

### Transport Mechanisms

CapnWeb supports two transport modes:

#### 1. HTTP Batch Mode

**Use Case:** Stateless requests, simple request-response patterns

**Mechanism:**
1. Client serializes one or more RPC calls into JSON
2. Client sends POST request to endpoint URL
3. Server deserializes, executes methods, serializes responses
4. Server sends response(s) in single HTTP response
5. Client deserializes responses

**HTTP Request:**
```http
POST /a2a/capnweb HTTP/1.1
Host: agent.example.com
Content-Type: application/json
Authorization: Bearer token-xyz

{
  "method": "getTask",
  "params": { "taskId": "task-123" },
  "id": "call-001"
}
```

**HTTP Response:**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": "call-001",
  "result": {
    "id": "task-123",
    "status": { "state": "completed" }
  }
}
```

**Batching Multiple Calls:**
```http
POST /a2a/capnweb HTTP/1.1

[
  {
    "method": "getTask",
    "params": { "taskId": "task-123" },
    "id": "call-001"
  },
  {
    "method": "listTasks",
    "params": { "limit": 10 },
    "id": "call-002"
  }
]
```

Response:
```http
HTTP/1.1 200 OK

[
  { "id": "call-001", "result": { /* task */ } },
  { "id": "call-002", "result": { "tasks": [ /* ... */ ] } }
]
```

#### 2. WebSocket Mode

**Use Case:** Long-lived connections, bidirectional communication, streaming

**Mechanism:**
1. Client establishes WebSocket connection
2. Both client and server can send RPC calls as JSON messages
3. Responses are matched to requests by `id` field
4. Connection stays open for multiple calls

**WebSocket Connection:**
```javascript
// Client connects
const ws = new WebSocket('wss://agent.example.com/a2a/capnweb');

ws.onopen = () => {
  // Send RPC call
  ws.send(JSON.stringify({
    method: 'authenticate',
    params: { credentials: { type: 'bearer', token: 'xyz' } },
    id: 'call-001'
  }));
};

ws.onmessage = (event) => {
  const response = JSON.parse(event.data);
  if (response.id === 'call-001') {
    // Handle authentication response
    const session = response.result;
  }
};
```

**Message Flow:**
```
Client → Server: { method: 'sendMessageStreaming', id: '001' }
Server → Client: { id: '001', result: { $type: 'stub', $id: 'stream-123' } }
Server → Client: { method: 'onStatusUpdate', $target: 'callback-456', id: '002' }
Client → Server: { id: '002', result: null }
```

### Connection Lifecycle

**HTTP Batch:**
- Stateless per-request
- No persistent connection
- Stubs are session-based (server maintains mapping)

**WebSocket:**
- Stateful connection
- Server and client maintain session state
- Stub references remain valid for connection lifetime
- Automatic cleanup on disconnect

### Authentication

Authentication can happen at multiple levels:

**1. Transport-level (HTTP headers):**
```http
Authorization: Bearer eyJhbGc...
X-API-Key: api-key-123
```

**2. RPC-level (authenticate method):**
```json
{
  "method": "authenticate",
  "params": {
    "credentials": {
      "type": "bearer",
      "token": "user-token-xyz"
    }
  }
}
```

Returns authenticated stub:
```json
{
  "result": {
    "$type": "stub",
    "$id": "authenticated-session-abc",
    "$interface": "AuthenticatedA2AService"
  }
}
```

**3. Capability-based (implicit in stub):**
Once you have an authenticated session stub, all calls through it are automatically authenticated.

---

## Practical Examples

### Example 1: Simple Request-Response

**TypeScript Service:**
```typescript
class MathService extends RpcTarget {
  async add(a: number, b: number): Promise<number> {
    return a + b;
  }
}
```

**Client Code:**
```typescript
const math = await connect<MathService>('https://api.example.com/math');
const result = await math.add(5, 3);
console.log(result); // 8
```

**Wire Protocol:**
```
→ Client sends:
{
  "method": "add",
  "params": { "a": 5, "b": 3 },
  "id": "call-001"
}

← Server responds:
{
  "id": "call-001",
  "result": 8
}
```

### Example 2: Returning Capabilities

**TypeScript Service:**
```typescript
class FileService extends RpcTarget {
  async openFile(path: string): Promise<FileHandle> {
    // Return capability to specific file
    return new FileHandle(path);
  }
}

class FileHandle extends RpcTarget {
  constructor(private path: string) {
    super();
  }
  
  async read(): Promise<string> {
    return fs.readFileSync(this.path, 'utf-8');
  }
  
  async write(content: string): Promise<void> {
    fs.writeFileSync(this.path, content);
  }
}
```

**Client Code:**
```typescript
const fileService = await connect<FileService>('https://api.example.com/files');
const handle = await fileService.openFile('/data/notes.txt');
const content = await handle.read();
console.log(content);
await handle.write('Updated content');
```

**Wire Protocol:**
```
→ Client: { method: 'openFile', params: { path: '/data/notes.txt' }, id: '001' }
← Server: { id: '001', result: { $type: 'stub', $id: 'file-handle-xyz' } }

→ Client: { method: 'read', params: {}, id: '002', $target: 'file-handle-xyz' }
← Server: { id: '002', result: 'File contents here...' }

→ Client: { method: 'write', params: { content: 'Updated' }, id: '003', $target: 'file-handle-xyz' }
← Server: { id: '003', result: null }
```

### Example 3: Bidirectional Streaming (A2A Use Case)

**TypeScript Service & Callback:**
```typescript
abstract class TaskUpdateCallback extends RpcTarget {
  abstract onStatusUpdate(event: StatusUpdateEvent): Promise<void>;
}

class A2AService extends RpcTarget {
  async sendMessageStreaming(
    message: Message,
    callback: TaskUpdateCallback
  ): Promise<Task> {
    const task = this.createTask(message);
    
    // Server will call back to client
    setTimeout(async () => {
      await callback.onStatusUpdate({
        type: 'status',
        taskId: task.id,
        status: { state: 'working' }
      });
    }, 1000);
    
    return task;
  }
}
```

**Client Code:**
```typescript
class MyCallback extends TaskUpdateCallback {
  async onStatusUpdate(event: StatusUpdateEvent): Promise<void> {
    console.log('Task status:', event.status.state);
  }
}

const service = await connect<A2AService>('wss://agent.example.com');
const callback = new MyCallback();
const task = await service.sendMessageStreaming(message, callback);
// Later, server calls: callback.onStatusUpdate(event)
```

**Wire Protocol (WebSocket):**
```
→ Client: 
{
  method: 'sendMessageStreaming',
  params: {
    message: { /* ... */ },
    callback: { $type: 'stub', $id: 'callback-client-123' }
  },
  id: '001'
}

← Server:
{
  id: '001',
  result: { id: 'task-456', status: { state: 'submitted' } }
}

← Server (callback, pushed later):
{
  method: 'onStatusUpdate',
  params: {
    event: { type: 'status', taskId: 'task-456', status: { state: 'working' } }
  },
  id: 'server-callback-001',
  $target: 'callback-client-123'
}

→ Client (ack):
{
  id: 'server-callback-001',
  result: null
}
```

### Example 4: Promise Pipelining

**TypeScript Service:**
```typescript
class AuthService extends RpcTarget {
  async login(username: string, password: string): Promise<UserSession> {
    if (validate(username, password)) {
      return new UserSession(username);
    }
    throw new Error('Invalid credentials');
  }
}

class UserSession extends RpcTarget {
  constructor(private username: string) {
    super();
  }
  
  async getProfile(): Promise<Profile> {
    return loadProfile(this.username);
  }
}
```

**Client Code (without pipelining - 2 RTT):**
```typescript
const session = await auth.login('alice', 'password');
const profile = await session.getProfile();
```

**Client Code (with pipelining - 1 RTT):**
```typescript
const session = auth.login('alice', 'password'); // Don't await
const profile = await session.getProfile(); // Pipeline both calls
```

**Wire Protocol (pipelined):**
```
→ Client sends batch:
[
  {
    method: 'login',
    params: { username: 'alice', password: 'password' },
    id: '001'
  },
  {
    method: 'getProfile',
    params: {},
    id: '002',
    $target: '001' // Reference previous call's result
  }
]

← Server responds batch:
[
  {
    id: '001',
    result: { $type: 'stub', $id: 'session-xyz' }
  },
  {
    id: '002',
    result: { name: 'Alice', email: 'alice@example.com' }
  }
]
```

---

## Comparison with Other RPC Systems

### CapnWeb vs. gRPC

| Feature | gRPC | CapnWeb |
|---------|------|---------|
| **Schema Language** | Protocol Buffers (.proto files) | TypeScript classes |
| **Code Generation** | Required (protoc) | Not needed |
| **Serialization** | Binary (Protobuf) | JSON with extensions |
| **Browser Support** | Limited (needs grpc-web) | Native (HTTP/WebSocket) |
| **Streaming** | Server streaming, client streaming, bidirectional | Bidirectional via callbacks |
| **Type Safety** | Yes | Yes (TypeScript) |
| **Human Readable** | No (binary) | Yes (JSON) |
| **Promise Pipelining** | No | Yes |
| **Capabilities** | No | Yes |

### CapnWeb vs. JSON-RPC

| Feature | JSON-RPC | CapnWeb |
|---------|----------|---------|
| **Schema Definition** | None (ad-hoc) | TypeScript interfaces |
| **Type Safety** | No | Yes |
| **Bidirectional** | No (needs webhooks) | Yes (native) |
| **Callbacks** | Not supported | First-class RpcTargets |
| **Promise Pipelining** | No | Yes |
| **Capabilities** | No | Yes |
| **Browser Support** | Yes | Yes |

### CapnWeb vs. REST

| Feature | REST | CapnWeb |
|---------|------|---------|
| **API Style** | Resource-oriented | Method-oriented |
| **Type Safety** | No | Yes |
| **Streaming** | SSE (unidirectional) | Bidirectional callbacks |
| **Batching** | Manual | Native |
| **Promise Pipelining** | No | Yes |
| **State Management** | Stateless | Can be stateful |
| **Capabilities** | No | Yes |

### Why CapnWeb for This Project?

The A2A protocol implementation benefits specifically from:

1. **No Webhook Infrastructure**: Traditional A2A requires servers to POST to client webhooks. CapnWeb's callback RpcTargets eliminate this complexity.

2. **Promise Pipelining**: Reduces latency for common patterns like authenticate → getUser → performAction.

3. **Capability Security**: After authentication, returned session stubs automatically carry authorization context.

4. **Bidirectional Streaming**: Native support for server-to-client updates without SSE complexity.

5. **TypeScript-Native**: The entire stack is TypeScript, eliminating schema synchronization issues.

6. **Cloudflare Integration**: Seamless integration with Cloudflare Workers and Durable Objects.

---

## References

- **CapnWeb GitHub**: https://github.com/cloudflare/capnweb
- **CapnWeb Blog Post**: https://blog.cloudflare.com/javascript-native-rpc/
- **A2A Protocol Spec**: https://a2a-protocol.org/latest/specification/
- **Cap'n Proto**: https://capnproto.org/
- **Object Capability Security**: http://erights.org/

---

## Appendix: Implementation in a2aWebCap

This project implements the A2A protocol using CapnWeb transport. Key files:

**Service Definition:**
- `packages/types/src/a2a-types.ts` - TypeScript interfaces for A2A types
- `src/server/a2a-service.ts` - Main A2AService RpcTarget implementation

**Streaming:**
- `src/server/streaming-task.ts` - StreamingTask RpcTarget for bidirectional updates
- `src/server/task-update-callback.ts` - TaskUpdateCallback interface

**Client:**
- `src/client/index.ts` - A2AClient that uses RpcStub

**Transport:**
- `packages/capnwebrpc/src/capnweb-endpoint.ts` - CapnWebEndpoint wrapper
- `packages/capnwebrpc/src/sturdy-ref.ts` - SturdyRef abstraction for Durable Objects

**Testing:**
- `tests/e2e/basic-flow.test.ts` - End-to-end example of DSL usage
- `packages/capnwebrpc/tests/` - Unit tests showing transformations

---

*Document Version: 1.0*  
*Last Updated: December 29, 2025*
