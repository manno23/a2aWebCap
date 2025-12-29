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
6. [Record and Replay Pattern](#record-and-replay-pattern)
7. [Practical Examples](#practical-examples)
8. [Comparison with Other RPC Systems](#comparison-with-other-rpc-systems)

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
// Callback interface for streaming updates
interface TaskUpdateCallback {
  onStatusUpdate(event: StatusUpdateEvent): Promise<void>;
  onArtifactUpdate(event: ArtifactUpdateEvent): Promise<void>;
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
class ClientCallback implements TaskUpdateCallback {
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

## Record and Replay Pattern

The CapnWeb DSL supports a powerful **record and replay** pattern for testing, debugging, and development. This pattern allows you to capture RPC interactions and replay them deterministically without requiring a live runtime.

### Concept Overview

The record and replay pattern in CapnWeb operates at two distinct levels:

1. **Testing Level**: Record RPC interactions for unit testing (EventCollector, InMemorySturdyRef)
2. **Code Mobility Level**: Serialize TypeScript functions for remote execution (Ghost Objects, IL Compilation)

Both levels use the same fundamental concept: **record operations locally, replay them remotely**.

#### Two Applications of Record-Replay

**1. Test Recording (Covered in sections below)**
- Records RPC calls and responses during testing
- Replays interactions without external dependencies
- Used for deterministic testing and debugging

**2. Function Serialization (The `.map()` Mechanism)**
- Records operations on "ghost" proxy objects
- Compiles recorded trace into an Intermediate Language (IL)
- Replays operations on real data server-side
- Enables code mobility without transmitting bytecode

The record and replay pattern consists of key transformations:

1. **Recording Phase**: Capture operations or interactions during execution
2. **Compilation Phase**: Transform recorded trace into transmittable format
3. **Transmission Phase**: Send compiled plan over the wire
4. **Replay Phase**: Re-execute operations on real data/services

This pattern is essential for:
- **Unit Testing**: Test RPC logic without external dependencies
- **Integration Testing**: Verify complex interaction sequences
- **Debugging**: Reproduce bugs deterministically
- **Development**: Work offline with recorded production data
- **Code Mobility**: Execute client functions on server data without data transfer

---

### Function Serialization: The `.map()` Mechanism

One of CapnWeb's most powerful features is the ability to "serialize" TypeScript functions for remote execution. This is most vividly illustrated by operations like `remoteArray.map(callback)`, where you want to transform remote data without fetching it to the client.

#### The Problem: Remote Data Transformation

Consider transforming a large array stored on the server:

**Traditional RPC Approaches:**
```typescript
// Option 1: Fetch all data (bandwidth heavy)
const users = await remoteUsers.getAll(); // 10MB download
const names = users.map(u => u.getProfile().name);

// Option 2: Server-side method (requires deploying new code)
const names = await remoteUsers.extractNames(); // Need server update
```

**CapnWeb's Solution: Function Serialization**
```typescript
// Transform data server-side without fetching or deploying
const names = await remoteUsers.map(u => u.getProfile().name);
// Server applies function to each element, returns only results
```

#### The Mechanism: "Ghost" Objects and Trace Recording

CapnWeb achieves this through a **record-replay pattern** that doesn't send bytecode. Instead, it uses **Ghost Objects** to record a trace of operations.

**Step 1: The "Ghost" Placeholder**

When you call `.map(fn)` on a remote promise, the library creates a special **Ghost Object** (a recording Proxy). This object:
- Has no real data
- Acts as a variable `x` in a lambda expression `λx.expr`
- Records every operation performed on it

```typescript
// Conceptual representation
class GhostObject extends Proxy {
  private trace: Operation[] = [];
  
  get(target, prop) {
    // Record property access
    this.trace.push({ op: 'GET_PROPERTY', prop });
    return new GhostObject(); // Return new ghost for chaining
  }
  
  apply(target, thisArg, args) {
    // Record method call
    this.trace.push({ op: 'CALL', method: target.name, args });
    return new GhostObject(); // Return new ghost for result
  }
}
```

**Step 2: Local Simulation**

The library calls your provided function **synchronously**, passing the Ghost Object as the argument:

```typescript
// Your code
remoteUsers.map(u => u.getProfile().name)

// What CapnWeb does internally
const ghost = new GhostObject('u');
const result = fn(ghost); // fn is: u => u.getProfile().name
// Function executes locally on ghost, recording operations
```

**Important Constraint**: Your function must be:
- **Synchronous**: No `await` inside the function
- **Referentially transparent**: Cannot branch on data values (`if (x.id > 5)`) because `x.id` has no actual value yet

**Step 3: Trace Capture**

As your function executes on the Ghost Object, the Proxy intercepts every operation:

```typescript
// User code: u.getProfile().name
// 
// Operation 1: u.getProfile()
//   Proxy intercepts: apply('getProfile', [])
//   Records: { op: 'CALL', method: 'getProfile', target: 'u' }
//   Returns: Ghost_Profile (linked to Operation 1)
//
// Operation 2: .name
//   Proxy intercepts: get(Ghost_Profile, 'name')
//   Records: { op: 'GET_PROPERTY', prop: 'name', target: Ghost_Profile }
//   Returns: Ghost_Name (linked to Operation 2)
```

**Step 4: Plan Generation (The DSL)**

Once the function returns, the library analyzes the graph of Ghost Objects and operations. It compiles this trace into an **Intermediate Language (IL)** plan. This plan is the "serialized function".

```typescript
// Trace compilation result
const plan = {
  type: 'MAP',
  operations: [
    { op: 'CALL', method: 'getProfile' },
    { op: 'GET', prop: 'name' }
  ]
};
```

#### The Intermediate Language (IL) Structure

The "serialized function" is a JSON structure representing a sequence of operations in a domain-specific language. This DSL is **non-Turing-complete**, preventing infinite loops or arbitrary code execution on the server.

**IL Instruction Set:**

| Opcode | Arguments | Description |
|--------|-----------|-------------|
| `GET_PROPERTY` | `String` (property name) | Access a field on the current context object |
| `CALL` | Method name, Arguments | Invoke a method. Arguments can be literals or ghost references |
| `PIPELINE` | Promise ID | Reference the result of a previous operation in the chain |
| `RETURN` | Value / ID | Defines the final output of the map function for a single element |
| `LITERAL` | Any JSON value | Represents a constant value in the expression |
| `BINARY_OP` | Operator, Left, Right | Arithmetic or comparison operations (+, -, *, /, ==, etc.) |

**Example IL Plans:**

```json
// Simple property access: u => u.name
{
  "op": "MAP",
  "il": [
    { "op": "GET_PROPERTY", "prop": "name" }
  ]
}

// Method call and property: u => u.getProfile().name
{
  "op": "MAP",
  "il": [
    { "op": "CALL", "method": "getProfile", "args": [] },
    { "op": "GET_PROPERTY", "prop": "name" }
  ]
}

// With literal argument: u => u.calculateAge(2025)
{
  "op": "MAP",
  "il": [
    { "op": "CALL", "method": "calculateAge", "args": [
      { "op": "LITERAL", "value": 2025 }
    ]}
  ]
}

// Property chain: u => u.profile.address.city
{
  "op": "MAP",
  "il": [
    { "op": "GET_PROPERTY", "prop": "profile" },
    { "op": "GET_PROPERTY", "prop": "address" },
    { "op": "GET_PROPERTY", "prop": "city" }
  ]
}
```

#### State Diagram: The Record-Replay Cycle

Here's how a TypeScript arrow function transforms into wire instructions:

```typescript
// User Code
remoteUsers.map(u => u.getProfile().name)
```

**State 1: Recording Start**
- **Input**: Callback function `u => u.getProfile().name`
- **Action**: Instantiate `Ghost_Root` (represents parameter `u`)
- **Stack**: Empty
- **Status**: Recording mode enabled

**State 2: Execution - `u.getProfile()`**
- **Action**: Callback invokes `getProfile` on `Ghost_Root`
- **Proxy Trap**: Intercepts `apply` handler
- **Record**: `Instr_1 = { op: 'CALL', target: Ghost_Root, method: 'getProfile' }`
- **Output**: Returns `Ghost_Profile` (linked to `Instr_1`)

**State 3: Execution - `.name`**
- **Action**: Callback accesses `.name` on `Ghost_Profile`
- **Proxy Trap**: Intercepts `get` handler
- **Record**: `Instr_2 = { op: 'GET', target: Ghost_Profile, prop: 'name' }`
- **Output**: Returns `Ghost_Name` (linked to `Instr_2`)

**State 4: Compilation**
- **Action**: Callback returns `Ghost_Name`
- **Compiler**: Backtraces from `Ghost_Name` to `Ghost_Root`
- **Result (IL)**: 
  ```json
  [
    { "op": "call", "method": "getProfile" },
    { "op": "get", "prop": "name" }
  ]
  ```

**State 5: Transmission**
- **Action**: Send MAP opcode to server with the compiled IL Plan
- **Wire Format**:
  ```json
  {
    "method": "map",
    "params": {
      "arrayId": "users-collection-123",
      "plan": {
        "il": [
          { "op": "call", "method": "getProfile" },
          { "op": "get", "prop": "name" }
        ]
      }
    },
    "id": "call-456"
  }
  ```

**State 6: Server Replay**
- **Action**: Server iterates over the real array
- **Loop**: For each item `real_u`:
  1. Execute `Instr_1` on `real_u` → `real_profile`
  2. Execute `Instr_2` on `real_profile` → `real_name`
- **Result**: Vector of strings `["Alice", "Bob", "Carol", ...]`
- **Response**:
  ```json
  {
    "id": "call-456",
    "result": ["Alice", "Bob", "Carol"]
  }
  ```

#### Transformation Diagram

```
TypeScript Function          Ghost Recording              IL Plan                Server Execution
─────────────────────────────────────────────────────────────────────────────────────────────────

u => u.getProfile().name  →  Ghost_Root                → [CALL getProfile]  →  for each user:
                             ↓                             [GET name]           user.getProfile()
                             u.getProfile()                                       .name
                             ↓
                             Ghost_Profile
                             ↓
                             .name
                             ↓
                             Ghost_Name
                             
                             Record: [
                               getProfile(),
                               .name
                             ]
```

#### Wire Protocol Example

**Client to Server:**
```json
{
  "method": "arrayMap",
  "params": {
    "$target": "users-array-stub-123",
    "plan": {
      "type": "transform",
      "operations": [
        { "op": "CALL", "method": "getProfile", "args": [] },
        { "op": "GET_PROPERTY", "prop": "name" }
      ]
    }
  },
  "id": "map-001"
}
```

**Server to Client:**
```json
{
  "id": "map-001",
  "result": [
    "Alice Smith",
    "Bob Jones",
    "Carol White"
  ]
}
```

#### Limitations and Constraints

The Ghost Object pattern has important constraints due to the non-Turing-complete IL:

**❌ Not Allowed:**
```typescript
// Branching on data (ghost has no value)
remoteUsers.map(u => u.age > 18 ? u.name : null) // ❌ Cannot branch

// Async operations
remoteUsers.map(async u => await u.fetch()) // ❌ Must be synchronous

// Closures over external state
const threshold = 18;
remoteUsers.map(u => u.age > threshold) // ❌ External variable

// Complex logic
remoteUsers.map(u => {
  for (let i = 0; i < 10; i++) { /* ... */ } // ❌ No loops
  return u.name;
})
```

**✅ Allowed:**
```typescript
// Property access chains
remoteUsers.map(u => u.profile.address.city) // ✅

// Method calls with literals
remoteUsers.map(u => u.calculateAge(2025)) // ✅

// Multiple operations
remoteUsers.map(u => u.getProfile().getName()) // ✅

// Simple transformations
remoteUsers.map(u => ({ name: u.name, id: u.id })) // ✅
```

#### Practical Example: Complete Flow

```typescript
// ===== CLIENT SIDE =====
import { remoteArray } from 'capnweb';

// Get reference to remote array (doesn't fetch data)
const users = await service.getUsers(); // Returns stub/promise

// Apply transformation (records operations)
const names = await users.map(u => u.getProfile().name);
// At this point:
// 1. Ghost object created
// 2. Function executed with ghost
// 3. Operations recorded: [CALL getProfile, GET name]
// 4. IL plan compiled and sent to server

console.log(names); // ["Alice", "Bob", "Carol"]

// ===== SERVER SIDE =====
class UsersArray {
  private data: User[] = [/* ... */];
  
  // Server receives MAP request with IL plan
  async map(plan: ILPlan): Promise<any[]> {
    const results = [];
    
    for (const user of this.data) {
      // Replay operations from plan
      let current = user;
      
      for (const instr of plan.operations) {
        if (instr.op === 'CALL') {
          // Execute method call
          current = await current[instr.method](...instr.args);
        } else if (instr.op === 'GET_PROPERTY') {
          // Access property
          current = current[instr.prop];
        }
      }
      
      results.push(current);
    }
    
    return results;
  }
}
```

#### Benefits of Function Serialization

1. **Bandwidth Efficiency**: Only results are transmitted, not entire datasets
2. **Latency Reduction**: Single round trip instead of fetch + transform
3. **Security**: Non-Turing-complete IL prevents arbitrary code execution
4. **Type Safety**: TypeScript provides compile-time checking of operations
5. **Expressiveness**: Write natural transformations as if data were local
6. **Server Optimization**: Server can optimize IL execution (parallel, indexed access, etc.)

#### Comparison with Other Approaches

| Approach | Bandwidth | Round Trips | Security | Expressiveness |
|----------|-----------|-------------|----------|----------------|
| **Fetch All** | High (O(n)) | 1 | Safe | High |
| **Server Methods** | Low (O(m)) | 1 | Safe | Low (need deployment) |
| **SQL/Query DSL** | Low (O(m)) | 1 | Safe | Medium (limited to query ops) |
| **Send Bytecode** | Low (O(m)) | 1 | Dangerous | High |
| **CapnWeb Ghost/IL** | Low (O(m)) | 1 | Safe | High |

Where `n` = size of input data, `m` = size of results

---

### Testing with Record and Replay

#### 1. InMemorySturdyRef - Replay Without Runtime

The `InMemorySturdyRef` is a lightweight implementation that replays RPC interactions without requiring a Cloudflare Workers runtime or Durable Objects.

**DSL Concept:**
```typescript
import { InMemorySturdyRefFactory } from '@a2a/capnwebrpc';
import type { SturdyRefDescriptor } from '@a2a/capnwebrpc';

// Create in-memory factory for testing
const factory = new InMemorySturdyRefFactory();

// Register a handler (this is what gets "replayed")
const descriptor: SturdyRefDescriptor = { ref: 'test-service' };
factory.register(descriptor, async (request: Request) => {
  const body = await request.json();
  
  // Simulate service logic
  return new Response(JSON.stringify({
    id: 'task-123',
    status: { state: 'completed' },
    result: `Processed: ${body.message}`
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
});

// Create endpoint - this behaves like a real SturdyRef
const endpoint = factory.createEndpoint(descriptor);

// Use it like a real endpoint (replay phase)
const response = await endpoint.fetch(
  new Request('https://test.local/rpc', {
    method: 'POST',
    body: JSON.stringify({ message: 'hello' })
  })
);
```

**Transformation:**
- **Real Runtime**: `DurableObjectStub.fetch(request)` → Network call → Durable Object execution
- **Replay**: `InMemorySturdyRef.fetch(request)` → In-memory handler → Immediate response

**Benefits:**
- No network latency
- No external dependencies
- Deterministic results
- Fast test execution
- Works in any JavaScript environment (Node.js, browser, Workers)

#### 2. EventCollector - Recording Streaming Interactions

The `EventCollector` implements the record phase for streaming RPC calls by capturing all events.

**DSL Concept:**
```typescript
import { EventCollector } from '@a2a/testing-utils';

// Create collector to record events
const collector = new EventCollector();

// Use collector as callback (recording phase)
await service.sendMessageStreaming(message, config, collector);

// Wait for completion
await collector.waitForFinal(5000); // 5 second timeout

// Access recorded events (replay/assertion phase)
const allEvents = collector.events;
const statusUpdates = collector.getStatusUpdates();
const artifactUpdates = collector.getArtifactUpdates();
const finalEvent = collector.getFinalEvent();

// Assert on recorded sequence
expect(collector.eventCount).toBeGreaterThan(0);
expect(collector.hasFinalEvent).toBe(true);
```

**EventCollector Implementation:**
```typescript
class EventCollector implements TaskUpdateCallback {
  public events: StreamEvent[] = [];
  private finalReceived = false;
  
  async onStatusUpdate(event: StatusUpdateEvent): Promise<void> {
    // Record status event
    this.events.push(event);
    if (event.final) {
      this.finalReceived = true;
    }
  }
  
  async onArtifactUpdate(event: ArtifactUpdateEvent): Promise<void> {
    // Record artifact event
    this.events.push(event);
  }
  
  async waitForFinal(timeoutMs: number = 5000): Promise<void> {
    // Wait for final event to be recorded
    if (this.finalReceived) return;
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Final event not received within ${timeoutMs}ms`));
      }, timeoutMs);
      
      // Resolve when final event is recorded
      this.resolveWaitForFinal = () => {
        clearTimeout(timeout);
        resolve();
      };
    });
  }
  
  reset(): void {
    // Clear recorded events for reuse
    this.events = [];
    this.finalReceived = false;
  }
}
```

**Transformation:**
- **Record Phase**: RPC callbacks → `EventCollector.onStatusUpdate()` → Append to `events` array
- **Replay Phase**: Iterate over `collector.events` → Assert expected sequence → Verify state transitions

#### 3. Complete Record and Replay Example

**Recording a Test Scenario:**
```typescript
import { describe, it, expect } from 'vitest';
import { InMemorySturdyRefFactory, EventCollector } from '@a2a/testing';
import { A2AService } from '../src/server';

describe('A2A Task Workflow - Record and Replay', () => {
  it('records and verifies complete task lifecycle', async () => {
    // ===== SETUP: Create in-memory service (replay infrastructure) =====
    const factory = new InMemorySturdyRefFactory();
    const service = new A2AService({ /* config */ });
    
    // Register service handler
    factory.register({ ref: 'a2a-service' }, async (request) => {
      // This handler will be "replayed" for each test call
      return await service.handleRequest(request);
    });
    
    // ===== RECORD PHASE: Execute and capture interactions =====
    const collector = new EventCollector();
    const message = {
      messageId: 'msg-001',
      role: 'user' as const,
      parts: [{ kind: 'text' as const, text: 'Generate report' }]
    };
    
    // Start streaming (recording begins)
    await service.sendMessageStreaming(message, undefined, collector);
    
    // Wait for completion (recording continues)
    await collector.waitForFinal();
    
    // ===== ASSERTION PHASE: Verify recorded sequence =====
    const events = collector.events;
    
    // Verify task creation
    expect(events[0].type).toBe('status');
    expect(events[0].status.state).toBe('submitted');
    
    // Verify working state
    expect(events[1].type).toBe('status');
    expect(events[1].status.state).toBe('working');
    
    // Verify artifacts were generated
    const artifacts = collector.getArtifactUpdates();
    expect(artifacts.length).toBeGreaterThan(0);
    
    // Verify final state
    const finalEvent = collector.getFinalEvent();
    expect(finalEvent).toBeDefined();
    expect(finalEvent?.status.state).toBe('completed');
    
    // ===== REPLAY PHASE: Verify idempotency =====
    collector.reset();
    
    // Replay the exact same interaction
    await service.sendMessageStreaming(message, undefined, collector);
    await collector.waitForFinal();
    
    // Verify same sequence (deterministic replay)
    const replayedEvents = collector.events;
    expect(replayedEvents.length).toBe(events.length);
    expect(replayedEvents[0].status.state).toBe(events[0].status.state);
  });
});
```

### Wire Format for Recorded Interactions

Recorded interactions can be serialized to JSON for storage and replay:

**Recorded Event Sequence:**
```json
{
  "scenario": "task-creation-with-artifacts",
  "timestamp": "2025-12-29T10:00:00.000Z",
  "interactions": [
    {
      "type": "request",
      "method": "sendMessageStreaming",
      "params": {
        "message": {
          "messageId": "msg-001",
          "role": "user",
          "parts": [{ "kind": "text", "text": "Generate report" }]
        }
      }
    },
    {
      "type": "callback",
      "method": "onStatusUpdate",
      "event": {
        "type": "status",
        "taskId": "task-123",
        "contextId": "ctx-456",
        "status": { "state": "submitted" }
      },
      "timestamp": "+0ms"
    },
    {
      "type": "callback",
      "method": "onStatusUpdate",
      "event": {
        "type": "status",
        "taskId": "task-123",
        "contextId": "ctx-456",
        "status": { "state": "working" }
      },
      "timestamp": "+50ms"
    },
    {
      "type": "callback",
      "method": "onArtifactUpdate",
      "event": {
        "type": "artifact",
        "taskId": "task-123",
        "artifact": {
          "artifactId": "art-001",
          "name": "report.pdf",
          "parts": [{ "kind": "file", "file": { "name": "report.pdf" } }]
        }
      },
      "timestamp": "+1500ms"
    },
    {
      "type": "callback",
      "method": "onStatusUpdate",
      "event": {
        "type": "status",
        "taskId": "task-123",
        "status": { "state": "completed" },
        "final": true
      },
      "timestamp": "+2000ms"
    }
  ]
}
```

### Replaying Recorded Interactions

**Replay Engine Pattern:**
```typescript
interface RecordedInteraction {
  type: 'request' | 'callback' | 'response';
  method: string;
  params?: any;
  event?: any;
  timestamp?: string;
}

class InteractionReplayer {
  constructor(private recording: RecordedInteraction[]) {}
  
  async replay(service: any, collector: EventCollector): Promise<void> {
    for (const interaction of this.recording) {
      if (interaction.type === 'request') {
        // Replay the initial request
        await service[interaction.method](
          interaction.params.message,
          interaction.params.config,
          collector
        );
      } else if (interaction.type === 'callback') {
        // Simulate callback (for testing timing-sensitive logic)
        await this.simulateDelay(interaction.timestamp);
        
        // Verify expected callback was made
        const actualEvent = collector.events.find(e => 
          e.type === interaction.event.type &&
          e.taskId === interaction.event.taskId
        );
        expect(actualEvent).toBeDefined();
      }
    }
  }
  
  private async simulateDelay(timestamp?: string): Promise<void> {
    if (!timestamp || !timestamp.startsWith('+')) return;
    const ms = parseInt(timestamp.slice(1, -2));
    await new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Usage
const recording = JSON.parse(fs.readFileSync('test-scenario.json', 'utf-8'));
const replayer = new InteractionReplayer(recording.interactions);
await replayer.replay(service, collector);
```

### Benefits of Record and Replay in CapnWeb DSL

1. **Deterministic Testing**
   - Same input always produces same output
   - No flaky tests due to network timing
   - Reproducible bug scenarios

2. **Fast Test Execution**
   - No network latency
   - No external service dependencies
   - Parallel test execution

3. **Offline Development**
   - Work without production access
   - Use recorded production interactions for debugging
   - Test against realistic data

4. **Time Travel Debugging**
   - Step through recorded interactions
   - Inspect state at any point in sequence
   - Compare different execution paths

5. **Regression Testing**
   - Capture real-world scenarios
   - Replay against new code versions
   - Detect behavioral changes

### Integration with A2A Protocol

The record and replay pattern is particularly valuable for A2A implementations:

**Recording A2A Workflows:**
```typescript
// Record a complete agent conversation
const conversation = new ConversationRecorder();

// User message
const task = await agent.sendMessage({
  messageId: 'msg-1',
  role: 'user',
  parts: [{ kind: 'text', text: 'Analyze sales data' }]
}, undefined, conversation.collector);

// Record all streaming updates
await conversation.collector.waitForFinal();

// Save recording for replay
const recording = conversation.serialize();
fs.writeFileSync('conversation-001.json', JSON.stringify(recording, null, 2));

// Later: Replay for regression testing
const saved = JSON.parse(fs.readFileSync('conversation-001.json', 'utf-8'));
const replayer = new ConversationReplayer(saved);
await replayer.verify(agent); // Ensures same behavior
```

### Best Practices

1. **Record Minimal Test Cases**: Only record what's necessary for the test
2. **Version Recordings**: Include schema version in recorded data
3. **Sanitize Sensitive Data**: Remove tokens, credentials from recordings
4. **Timestamp Relativity**: Use relative timestamps (`+100ms`) not absolute
5. **Event Ordering**: Maintain strict ordering in recordings
6. **Reset Between Tests**: Always reset collectors between test cases
7. **Timeout Handling**: Set appropriate timeouts for `waitForFinal()`

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
// Callback interface for streaming updates
interface TaskUpdateCallback {
  onStatusUpdate(event: StatusUpdateEvent): Promise<void>;
  onArtifactUpdate(event: ArtifactUpdateEvent): Promise<void>;
}

class A2AService {
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
class MyCallback implements TaskUpdateCallback {
  async onStatusUpdate(event: StatusUpdateEvent): Promise<void> {
    console.log('Task status:', event.status.state);
  }
  
  async onArtifactUpdate(event: ArtifactUpdateEvent): Promise<void> {
    console.log('Artifact:', event.artifact);
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
