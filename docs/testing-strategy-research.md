# Testing Strategy Research: Gemini A2A Server Analysis

**Date:** October 31, 2025  
**Subject:** Analysis of Testing Approaches in Google's Gemini A2A Server Implementation  
**Purpose:** Inform our testing strategy for a2aWebCap (A2A over Cap'n Proto Web)

---

## Executive Summary

This document analyzes the testing approach used in Google's reference implementation of the A2A protocol ([gemini-cli/packages/a2a-server](https://github.com/google-gemini/gemini-cli/tree/main/packages/a2a-server)) to extract key insights for our own testing strategy. The Gemini implementation uses **Vitest** with **Supertest** for HTTP-based integration testing, focusing heavily on protocol behavior verification rather than transport-layer details.

**Key Finding:** The tests are **protocol-centric, not transport-centric**. They verify A2A protocol invariants (task lifecycle, streaming semantics, tool execution) independent of the underlying HTTP/SSE transport, making them highly relevant for our capnweb-based implementation.

---

## 1. Testing Framework & Architecture

### 1.1 Technology Stack

```
┌─────────────────────────────────────────────────────┐
│              Testing Infrastructure                  │
├─────────────────────────────────────────────────────┤
│  Framework:    Vitest (v3.1.1)                      │
│  HTTP Testing: Supertest (v7.1.4)                   │
│  Mocking:      Vitest's built-in vi.mock()          │
│  Coverage:     V8 provider with multiple reporters   │
├─────────────────────────────────────────────────────┤
│              Test Organization                       │
├─────────────────────────────────────────────────────┤
│  • Co-located: *.test.ts files next to source       │
│  • E2E tests: Full app lifecycle simulation         │
│  • Unit tests: Isolated component testing           │
└─────────────────────────────────────────────────────┘
```

### 1.2 Test File Structure

```
packages/a2a-server/src/
├── http/
│   ├── app.ts                    # Express app setup
│   ├── app.test.ts              # E2E integration tests (27,642 bytes!)
│   └── endpoints.test.ts        # Endpoint-specific tests
├── agent/
│   ├── task.ts                  # Core task logic
│   └── task.test.ts             # Task behavior unit tests
└── vitest.config.ts             # Test configuration
```

**Observation:** The `app.test.ts` file is substantial (~27KB), indicating comprehensive protocol behavior coverage.

---

## 2. Key Testing Patterns & Invariants

### 2.1 Protocol Invariants Being Tested

The tests verify these critical A2A protocol invariants:

#### **Invariant 1: Task Lifecycle State Machine**
```
submitted → working → (input-required | completed | failed)
```

**Test Pattern:**
```typescript
function assertTaskCreationAndWorkingStatus(events) {
  // Event 0: Task created with 'submitted' state
  expect(events[0].result.status.state).toBe('submitted');
  
  // Event 1: Immediately transitions to 'working'
  expect(events[1].result.status.state).toBe('working');
}
```

**Relevance to capnweb:** This state machine is **transport-agnostic**. We must preserve these transitions regardless of using SSE or RpcTarget callbacks.

---

#### **Invariant 2: Streaming Event Ordering**
```
TaskCreated → StatusUpdate(working) → ContentUpdate* → StatusUpdate(final=true)
```

**Test Pattern:**
```typescript
const events = streamToSSEEvents(res.text);

// Verify order
assertTaskCreationAndWorkingStatus(events);  // First 2 events
expect(events[2].kind).toBe('status-update'); // Content
expect(events[3].final).toBe(true);           // Final event last
```

**Key Insight:** Tests use a helper `streamToSSEEvents()` to parse SSE stream into discrete events, then verify ordering and structure. For capnweb, we need equivalent parsing of callback invocations.

---

#### **Invariant 3: Exactly One Final Event**
```typescript
function assertUniqueFinalEventIsLast(events) {
  const finalEvents = events.filter(e => e.result.final === true);
  expect(finalEvents.length).toBe(1);
  expect(events[events.length - 1].result.final).toBe(true);
}
```

**Why This Matters:** The protocol guarantees that:
1. There is exactly ONE final event per task
2. It is ALWAYS the last event
3. It signals the client can stop listening

**capnweb Implication:** Our callback-based streaming must enforce this invariant by ensuring the final callback sets `final: true` and no further callbacks occur.

---

#### **Invariant 4: Tool Call Lifecycle**
```
validating → scheduled → executing → (success | error | cancelled)
```

**Test Coverage:**
```typescript
// Test validates full lifecycle for each tool
expect(toolUpdate.status).toBe('validating');   // Step 1
expect(toolUpdate.status).toBe('scheduled');    // Step 2
expect(toolUpdate.status).toBe('executing');    // Step 3
expect(toolUpdate.status).toBe('success');      // Step 4 (terminal)
```

**Special Cases Tested:**
- **Approval Required:** `validating → awaiting_approval → (user action) → scheduled → ...`
- **YOLO Mode:** Automatic approval, skips `awaiting_approval`
- **Concurrent Tools:** Multiple tools executing, one awaiting approval
- **Tool Failure:** `validating → scheduled → executing → error`

---

#### **Invariant 5: Context and Task ID Propagation**
```typescript
// All events must carry consistent IDs
expect(event.taskId).toBe(expectedTaskId);
expect(event.contextId).toBe(expectedContextId);
```

**capnweb Mapping:** These IDs must be carried in:
- RPC method parameters
- Callback event payloads
- RpcTarget instance state

---

### 2.2 Metadata and Tracing

**Invariant 6: Trace ID Propagation**
```typescript
it('should include traceId in status updates when available', async () => {
  const traceId = 'test-trace-id';
  sendMessageStreamSpy.mockImplementation(async function* () {
    yield* [
      { type: 'content', value: 'Hello', traceId },
    ];
  });
  
  const events = streamToSSEEvents(res.text);
  expect(events[2].result.metadata?.['traceId']).toBe(traceId);
});
```

**Why This Matters:** Trace IDs enable distributed tracing across agent → LLM → tool execution. Our capnweb implementation must preserve them through the RPC boundary.

---

## 3. Testing Strategies by Component

### 3.1 HTTP/Transport Layer Tests (`app.test.ts`)

**Approach:** Full E2E tests that:
1. Create an Express app
2. Start an HTTP server
3. Use Supertest to make requests
4. Parse SSE responses
5. Verify protocol behavior

**Example Pattern:**
```typescript
describe('E2E Tests', () => {
  let app: express.Express;
  let server: Server;

  beforeAll(async () => {
    app = await createApp();
    server = app.listen(0); // Random port
  });

  it('should create a new task and stream status updates', async () => {
    const agent = request.agent(app);
    const res = await agent
      .post('/')
      .send(createStreamMessageRequest('hello', 'test-id'))
      .set('Content-Type', 'application/json')
      .expect(200);

    const events = streamToSSEEvents(res.text);
    // Verify events...
  });
});
```

**Key Utilities:**
- `streamToSSEEvents()`: Parses `data: {...}\n\n` format into JSON objects
- `createStreamMessageRequest()`: Helper to build valid A2A messages
- `createMockConfig()`: Provides test configuration

---

### 3.2 Task Logic Tests (`task.test.ts`)

**Approach:** Unit tests that:
1. Bypass the constructor (using `@ts-expect-error`)
2. Mock the `EventBus`
3. Test specific methods in isolation

**Example:**
```typescript
it('should set state to input-required when a tool is awaiting approval', () => {
  const task = new Task(...); // @ts-expect-error - private constructor
  const toolCalls = [
    { request: { callId: '1' }, status: 'awaiting_approval' }
  ];
  
  task._schedulerToolCallsUpdate(toolCalls);
  
  expect(setTaskStateAndPublishUpdateSpy).toHaveBeenLastCalledWith(
    'input-required',
    { kind: 'state-change' },
    undefined,
    undefined,
    true, // final: true
  );
});
```

**Key Insight:** Tests focus on **internal state transitions** and **event publishing**, not transport mechanics.

---

### 3.3 Endpoint Tests (`endpoints.test.ts`)

**Approach:** REST API endpoint verification:
```typescript
it('should create a new task via POST /tasks', async () => {
  const response = await createTask('test-context');
  expect(response.status).toBe(201);
  expect(response.body).toBeTypeOf('string'); // Task ID
});

it('should get metadata for a specific task', async () => {
  const createResponse = await createTask('test-context-2');
  const taskId = createResponse.body;
  
  const response = await request(app).get(`/tasks/${taskId}/metadata`);
  expect(response.status).toBe(200);
  expect(response.body.metadata.id).toBe(taskId);
});
```

**Relevance:** These test the RESTful endpoints. For capnweb, we need equivalent tests for RPC methods like `getTask()`, `listTasks()`, etc.

---

## 4. Mocking Strategy

### 4.1 What Gets Mocked

The Gemini tests mock:

1. **Logger** (to avoid test output pollution)
   ```typescript
   vi.mock('../utils/logger.js', () => ({
     logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
   }));
   ```

2. **Configuration Loading**
   ```typescript
   vi.mock('../config/config.js', async () => ({
     loadConfig: vi.fn().mockImplementation(async () => createMockConfig())
   }));
   ```

3. **Gemini Client** (to avoid real API calls)
   ```typescript
   const sendMessageStreamSpy = vi.fn();
   vi.mock('@google/gemini-cli-core', async () => ({
     ...actual,
     GeminiClient: vi.fn().mockImplementation(() => ({
       sendMessageStream: sendMessageStreamSpy,
       getUserTier: vi.fn().mockReturnValue('free'),
     }))
   }));
   ```

4. **Tool Registry** (to control tool behavior)
   ```typescript
   const mockTool = new MockTool({
     name: 'test-tool',
     shouldConfirmExecute: vi.fn(),
     execute: vi.fn().mockResolvedValue({ llmContent: 'result' })
   });
   ```

### 4.2 What Doesn't Get Mocked

- **Task state machine logic** - Real implementation tested
- **Event bus publishing** - Real EventBus used, assertions made on published events
- **HTTP server** - Real Express app and server started
- **SSE streaming** - Real stream parsing

**Principle:** Mock external dependencies (LLM, config), test actual protocol logic.

---

## 5. Transport-Relevant Testing Insights

### 5.1 SSE Stream Parsing

The tests parse SSE streams into structured events:

```typescript
const streamToSSEEvents = (stream: string): SendStreamingMessageSuccessResponse[] =>
  stream
    .split('\n\n')
    .filter(Boolean)
    .map((chunk) => {
      const dataLine = chunk
        .split('\n')
        .find((line) => line.startsWith('data: '));
      if (!dataLine) {
        throw new Error(`Invalid SSE chunk found: "${chunk}"`);
      }
      return JSON.parse(dataLine.substring(6));
    });
```

**capnweb Equivalent:**
For our callback-based streaming, we need to:
1. Capture all callback invocations
2. Collect them into an array
3. Verify order, structure, and invariants

**Proposed Pattern:**
```typescript
class TestTaskUpdateCallback extends RpcTarget {
  events: TaskUpdateEvent[] = [];
  
  async onStatusUpdate(event: StatusUpdateEvent) {
    this.events.push(event);
  }
  
  async onArtifactUpdate(event: ArtifactUpdateEvent) {
    this.events.push(event);
  }
}

// In test:
const callback = new TestTaskUpdateCallback();
await client.sendMessageStreaming(message, callback);
await waitForFinalEvent(callback);
assertTaskCreationAndWorkingStatus(callback.events);
```

---

### 5.2 Testing Bidirectional Communication

**Current A2A (Webhooks):** Not explicitly tested in the Gemini implementation, as it's an optional feature.

**capnweb Advantage:** Native bidirectional RPC means we can test:
```typescript
it('should receive callback from server', async () => {
  const callback = new TestCallback();
  const streamingTask = await server.sendMessageStreaming(message, callback);
  
  // Wait for server to invoke callback
  await new Promise(resolve => setTimeout(resolve, 100));
  
  expect(callback.statusUpdates.length).toBeGreaterThan(0);
});
```

**This is a NEW test category** not present in HTTP-based A2A implementations!

---

### 5.3 Error Handling Tests

The Gemini tests verify error scenarios:

```typescript
it('should return 404 for a non-existent task', async () => {
  const response = await request(app).get('/tasks/fake-task/metadata');
  expect(response.status).toBe(404);
});
```

**capnweb Equivalent:**
```typescript
it('should throw error for non-existent task', async () => {
  await expect(server.getTask('fake-task-id'))
    .rejects.toThrow('Task not found');
});
```

---

## 6. Test Organization & Coverage

### 6.1 Coverage Configuration

```typescript
// vitest.config.ts
coverage: {
  enabled: true,
  provider: 'v8',
  include: ['src/**/*'],
  reporter: [
    ['text', { file: 'full-text-summary.txt' }],
    'html',
    'json',
    'lcov',
    'cobertura',
    ['json-summary', { outputFile: 'coverage-summary.json' }],
  ],
}
```

**Insight:** Multiple reporters for different use cases (CI, local dev, visualization).

### 6.2 Test Execution

```json
{
  "scripts": {
    "test": "vitest run",
    "test:ci": "vitest run --coverage"
  }
}
```

**Parallelization:**
```typescript
poolOptions: {
  threads: {
    minThreads: 8,
    maxThreads: 16,
  },
}
```

---

## 7. Critical Test Scenarios for capnweb Implementation

Based on the Gemini analysis, we MUST test:

### 7.1 Core Protocol Tests (Transport-Agnostic)

```
✓ Task Creation & State Transitions
  ├─ submitted → working → input-required
  ├─ submitted → working → completed
  └─ submitted → working → failed

✓ Streaming Event Order
  ├─ TaskCreated always first
  ├─ Final event always last
  └─ Exactly one final event

✓ Tool Execution Lifecycle
  ├─ validating → scheduled → executing → success
  ├─ validating → awaiting_approval → (user action)
  ├─ Multiple concurrent tools
  └─ Tool failure scenarios

✓ Content Streaming
  ├─ Text content events
  ├─ Thought events
  ├─ Citation events
  └─ Artifact updates

✓ Context Propagation
  ├─ Task ID consistency
  ├─ Context ID consistency
  └─ Trace ID propagation
```

### 7.2 capnweb-Specific Tests (NEW)

```
✓ RPC Method Coverage
  ├─ sendMessage() → Task | Message
  ├─ sendMessageStreaming() → StreamingTask
  ├─ getTask(taskId) → Task
  ├─ listTasks(params) → ListTasksResult
  ├─ cancelTask(taskId) → Task
  └─ getAgentCard() → AgentCard

✓ Callback-Based Streaming
  ├─ Server → Client callback invocation
  ├─ Callback error handling
  ├─ Client disconnection handling
  └─ Backpressure handling

✓ Capability-Based Security
  ├─ authenticate() returns authorized stub
  ├─ Authorized stub has user context
  ├─ Unauthorized operations rejected
  └─ Stub disposal revokes access

✓ Promise Pipelining
  ├─ Chained dependent calls
  ├─ Latency reduction verification
  └─ Error propagation in chains

✓ Connection Management
  ├─ WebSocket reconnection
  ├─ HTTP batch mode
  ├─ Session disposal
  └─ Resource cleanup
```

### 7.3 Compatibility Tests

```
✓ Protocol Equivalence
  ├─ capnweb sendMessage() ≡ HTTP POST /message/send
  ├─ capnweb streaming ≡ HTTP SSE
  ├─ capnweb callbacks ⊃ HTTP webhooks (superior)
  └─ Error codes match HTTP status codes

✓ AgentCard Compatibility
  ├─ preferredTransport: "CAPNWEB"
  ├─ additionalInterfaces includes capnweb
  └─ Capabilities accurately reported
```

---

## 8. Recommended Testing Architecture for a2aWebCap

```
tests/
├── unit/
│   ├── task.test.ts              # Task state machine logic
│   ├── streaming-task.test.ts    # StreamingTask RpcTarget
│   └── callback.test.ts          # Callback interface
│
├── integration/
│   ├── rpc-methods.test.ts       # All RPC method coverage
│   ├── streaming.test.ts         # Callback-based streaming
│   ├── authentication.test.ts    # Capability security
│   └── error-handling.test.ts    # Error scenarios
│
├── e2e/
│   ├── protocol-compliance.test.ts  # A2A protocol invariants
│   ├── tool-execution.test.ts       # Full tool lifecycle
│   └── agent-card.test.ts           # AgentCard serving
│
├── compatibility/
│   ├── http-comparison.test.ts   # Compare with HTTP transport
│   └── gemini-reference.test.ts  # Verify against Gemini tests
│
└── utils/
    ├── test-helpers.ts           # Shared utilities
    ├── mock-callbacks.ts         # Mock RpcTarget callbacks
    └── event-assertions.ts       # Protocol invariant assertions
```

---

## 9. Key Utilities to Build

### 9.1 Callback Event Collector

```typescript
export class EventCollector extends RpcTarget implements TaskUpdateCallback {
  events: Array<StatusUpdateEvent | ArtifactUpdateEvent> = [];
  finalReceived = false;
  
  async onStatusUpdate(event: StatusUpdateEvent): Promise<void> {
    this.events.push(event);
    if (event.final) {
      this.finalReceived = true;
    }
  }
  
  async onArtifactUpdate(event: ArtifactUpdateEvent): Promise<void> {
    this.events.push(event);
  }
  
  waitForFinal(timeoutMs = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        if (this.finalReceived) {
          resolve();
        } else if (Date.now() - start > timeoutMs) {
          reject(new Error('Timeout waiting for final event'));
        } else {
          setTimeout(check, 50);
        }
      };
      check();
    });
  }
}
```

### 9.2 Protocol Invariant Assertions

```typescript
export function assertTaskCreationAndWorkingStatus(events: Event[]) {
  expect(events.length).toBeGreaterThanOrEqual(2);
  expect(events[0].kind).toBe('status-update');
  expect((events[0] as StatusUpdateEvent).status.state).toBe('submitted');
  expect(events[1].kind).toBe('status-update');
  expect((events[1] as StatusUpdateEvent).status.state).toBe('working');
}

export function assertUniqueFinalEventIsLast(events: Event[]) {
  const finalEvents = events.filter(e => 
    'final' in e && e.final === true
  );
  expect(finalEvents.length).toBe(1);
  expect(events[events.length - 1]).toHaveProperty('final', true);
}

export function assertToolLifecycle(
  events: Event[],
  toolCallId: string,
  expectedStates: ToolStatus[]
) {
  const toolEvents = events
    .filter(e => e.kind === 'status-update')
    .filter(e => {
      const parts = (e as StatusUpdateEvent).status.message?.parts || [];
      return parts.some(p => 
        p.kind === 'data' && 
        p.data?.request?.callId === toolCallId
      );
    });
  
  const actualStates = toolEvents.map(e => {
    const part = (e as StatusUpdateEvent).status.message!.parts[0];
    return (part as any).data.status;
  });
  
  expect(actualStates).toEqual(expectedStates);
}
```

### 9.3 Mock Tool Implementation

```typescript
export class MockTool {
  constructor(
    public name: string,
    public execute: (args: any) => Promise<ToolResult>,
    public shouldConfirmExecute?: () => Promise<ToolCallConfirmationDetails>
  ) {}
}

export function createMockToolRegistry(tools: MockTool[]) {
  return {
    getAllTools: () => tools,
    getToolsByServer: (server: string) => 
      tools.filter(t => t.server === server),
    getTool: (name: string) => 
      tools.find(t => t.name === name),
  };
}
```

---

## 10. Testing Priorities (Recommended Order)

### Phase 1: Foundation (Week 1)
1. **RPC Method Tests** - Verify all A2A methods work via capnweb
2. **Basic Streaming** - Callback invocation and event collection
3. **Task State Machine** - Core state transitions

### Phase 2: Protocol Compliance (Week 2)
4. **Event Ordering** - Verify streaming invariants
5. **Tool Execution** - Full tool lifecycle
6. **Error Handling** - All error scenarios

### Phase 3: Advanced Features (Week 3)
7. **Authentication** - Capability-based security
8. **Promise Pipelining** - Latency optimization
9. **Connection Management** - Reconnection, disposal

### Phase 4: Validation (Week 4)
10. **Compatibility Tests** - Compare with HTTP implementation
11. **Performance Tests** - Latency, throughput
12. **Stress Tests** - Load, concurrent connections

---

## 11. Comparison: HTTP vs. capnweb Testing

| Aspect | HTTP (Gemini) | capnweb (Our Impl) |
|--------|---------------|-------------------|
| **Transport Testing** | Supertest HTTP requests | RpcStub method calls |
| **Streaming Verification** | Parse SSE text stream | Collect callback invocations |
| **Event Ordering** | Parse `data: {...}\n\n` | Array of callback events |
| **Error Testing** | HTTP status codes | JavaScript exceptions |
| **Bidirectional** | Not tested (webhooks optional) | **NEW: Test callbacks** |
| **Authentication** | Mock Bearer tokens | **NEW: Test capability stubs** |
| **Connection Lifecycle** | HTTP request/response | **NEW: Test WebSocket reconnect** |

---

## 12. Key Takeaways

### 12.1 What We Can Reuse

✅ **Protocol invariant assertions** - State machines, event ordering, tool lifecycle  
✅ **Test scenarios** - Tool approval, YOLO mode, concurrent tools, errors  
✅ **Mocking strategy** - Mock external deps (LLM, config), test real logic  
✅ **Coverage goals** - Comprehensive protocol behavior coverage  

### 12.2 What We Must Adapt

🔄 **Transport layer testing** - Replace Supertest with RpcStub calls  
🔄 **Streaming verification** - Replace SSE parsing with callback collection  
🔄 **Event collection** - Build EventCollector utility  
🔄 **Error assertions** - Replace HTTP status checks with exception checks  

### 12.3 What Is New to capnweb

🆕 **Bidirectional callback testing** - Server → Client RPC calls  
🆕 **Capability security testing** - Authenticated stub behavior  
🆕 **Promise pipelining tests** - Latency reduction verification  
🆕 **Connection management** - WebSocket lifecycle, disposal  

---

## 13. Architectural Diagram: Test Layers

```
┌──────────────────────────────────────────────────────────────┐
│                   Test Pyramid (capnweb)                      │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│   ┌─────────────────────────────────────────────┐            │
│   │         E2E Protocol Compliance             │  ← Fewest  │
│   │  - Full A2A protocol behavior               │            │
│   │  - Multi-tool scenarios                     │            │
│   │  - Real WebSocket connections               │            │
│   └─────────────────────────────────────────────┘            │
│                        ▲                                      │
│                        │                                      │
│          ┌─────────────────────────────────┐                 │
│          │   Integration Tests              │                │
│          │  - RPC method coverage           │                │
│          │  - Streaming with callbacks      │                │
│          │  - Error propagation             │                │
│          └─────────────────────────────────┘                 │
│                        ▲                                      │
│                        │                                      │
│      ┌─────────────────────────────────────────┐             │
│      │          Unit Tests                     │             │
│      │  - Task state machine                   │             │
│      │  - StreamingTask logic                  │             │
│      │  - Callback interfaces                  │             │
│      │  - Event publishing                     │  ← Most     │
│      └─────────────────────────────────────────┘             │
│                                                               │
└──────────────────────────────────────────────────────────────┘

           ┌────────────────────────────────┐
           │    Shared Test Utilities       │
           ├────────────────────────────────┤
           │  • EventCollector              │
           │  • Protocol assertions         │
           │  • Mock tools & callbacks      │
           │  • Helper factories            │
           └────────────────────────────────┘
```

---

## 14. Example Test: capnweb Streaming

Based on Gemini's test structure, here's how we'd test streaming in capnweb:

```typescript
describe('capnweb Streaming', () => {
  let server: RpcStub<A2AService>;
  let collector: EventCollector;
  
  beforeEach(async () => {
    server = newWebSocketRpcSession<A2AService>('ws://localhost:8080');
    collector = new EventCollector();
  });
  
  afterEach(() => {
    server[Symbol.dispose]();
  });
  
  it('should create task and stream status updates (text content)', async () => {
    // Mock LLM to return text content
    mockLLM.mockImplementation(async function* () {
      yield { type: 'content', value: 'Hello how are you?' };
    });
    
    // Send streaming message with callback
    const streamingTask = await server.sendMessageStreaming(
      createTestMessage('hello'),
      undefined,
      collector
    );
    
    // Wait for final event
    await collector.waitForFinal();
    
    // Verify event order and structure
    assertTaskCreationAndWorkingStatus(collector.events);
    
    // Verify text content event
    const textEvent = collector.events[2] as StatusUpdateEvent;
    expect(textEvent.kind).toBe('status-update');
    expect(textEvent.status.state).toBe('working');
    expect(textEvent.status.message?.parts).toMatchObject([
      { kind: 'text', text: 'Hello how are you?' }
    ]);
    
    // Verify final event
    const finalEvent = collector.events[3] as StatusUpdateEvent;
    expect(finalEvent.status.state).toBe('input-required');
    expect(finalEvent.final).toBe(true);
    
    // Verify invariants
    assertUniqueFinalEventIsLast(collector.events);
    expect(collector.events.length).toBe(4);
  });
});
```

---

## 15. Conclusion & Next Steps

### 15.1 Research Findings Summary

The Gemini A2A server tests provide an **excellent blueprint** for protocol behavior verification that is **largely transport-independent**. The key insight is that A2A protocol invariants (task states, event ordering, tool lifecycle) can be tested the same way regardless of whether the transport is HTTP+SSE or capnweb RPC+callbacks.

**What makes this possible:**
- Protocol semantics are defined at a higher level than transport
- State machines and event ordering are transport-agnostic
- The tests focus on *what* happens, not *how* it's transmitted

### 15.2 Our Advantages with capnweb

1. **Simpler Testing** - No need to parse SSE text streams, just collect callback invocations
2. **Better Errors** - JavaScript exceptions vs. HTTP status codes
3. **New Capabilities** - Can test bidirectional RPC, promise pipelining, capability security
4. **Type Safety** - TypeScript types for RPC methods and callbacks

### 15.3 Immediate Action Items

**Priority 1: Build Test Infrastructure**
- [ ] Create `EventCollector` utility class
- [ ] Port protocol assertion helpers from Gemini
- [ ] Set up Vitest configuration
- [ ] Create mock tool and callback factories

**Priority 2: Core Protocol Tests**
- [ ] Port task lifecycle tests (adapted for RPC)
- [ ] Port streaming event order tests (adapted for callbacks)
- [ ] Port tool execution tests
- [ ] Port error handling tests

**Priority 3: capnweb-Specific Tests**
- [ ] Test bidirectional callbacks (new)
- [ ] Test capability-based authentication (new)
- [ ] Test promise pipelining (new)
- [ ] Test WebSocket reconnection (new)

**Priority 4: Validation**
- [ ] Run compatibility tests against Gemini reference
- [ ] Verify all A2A protocol invariants hold
- [ ] Performance benchmarking (capnweb vs HTTP)

---

## Appendix A: Gemini Test File Statistics

| File | Size | Lines | Tests | Focus |
|------|------|-------|-------|-------|
| `app.test.ts` | 27,642 bytes | ~800 | ~10 E2E | Full protocol behavior |
| `task.test.ts` | 8,123 bytes | ~250 | ~5 unit | Task state machine |
| `endpoints.test.ts` | 5,020 bytes | ~150 | ~4 integration | REST endpoints |

**Total Test Coverage:** ~19 tests covering protocol behavior, state management, and HTTP endpoints.

---

## Appendix B: Key Code Patterns

### Pattern 1: Event Stream Parsing
```typescript
// Gemini (HTTP/SSE)
const events = streamToSSEEvents(res.text);

// capnweb (Callbacks)
const collector = new EventCollector();
await client.sendMessageStreaming(msg, collector);
await collector.waitForFinal();
const events = collector.events;
```

### Pattern 2: Mocking LLM Responses
```typescript
// Gemini
sendMessageStreamSpy.mockImplementation(async function* () {
  yield { type: 'content', value: 'Response' };
});

// capnweb (same approach, different mock target)
mockLLMStream.mockImplementation(async function* () {
  yield { type: 'content', value: 'Response' };
});
```

### Pattern 3: Tool Lifecycle Verification
```typescript
// Both use same assertion logic
assertToolLifecycle(events, 'tool-call-id', [
  'validating',
  'scheduled',
  'executing',
  'success'
]);
```

---

**Document Version:** 1.0  
**Author:** AI Research Assistant  
**Last Updated:** October 31, 2025  
**Next Review:** After Phase 1 implementation
