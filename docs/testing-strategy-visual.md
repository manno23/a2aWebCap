# Testing Strategy: Visual Reference

## Test Coverage Comparison: Gemini vs. a2aWebCap

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    GEMINI A2A SERVER (HTTP/SSE)                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Test Layer          │  Coverage                │  Transport-Specific? │
│  ─────────────────────────────────────────────────────────────────────  │
│  Protocol Invariants │  ████████████ 95%        │  ✗ No               │
│  Task Lifecycle      │  ████████████ 100%       │  ✗ No               │
│  Tool Execution      │  ███████████░ 90%        │  ✗ No               │
│  Streaming (SSE)     │  ████████████ 100%       │  ✓ Yes (SSE parse)  │
│  HTTP Endpoints      │  ██████████░░ 80%        │  ✓ Yes (Supertest)  │
│  Webhooks            │  ░░░░░░░░░░░░ 0%         │  ✓ Yes (not impl)   │
│  Error Handling      │  █████████░░░ 75%        │  ✗ No               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                  A2AWEBCAP (CAPNWEB RPC)                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Test Layer          │  Coverage (Target)       │  Transport-Specific? │
│  ─────────────────────────────────────────────────────────────────────  │
│  Protocol Invariants │  ████████████ 95%        │  ✗ No (reuse!)      │
│  Task Lifecycle      │  ████████████ 100%       │  ✗ No (reuse!)      │
│  Tool Execution      │  ████████████ 100%       │  ✗ No (reuse!)      │
│  Streaming (RPC)     │  ████████████ 100%       │  ✓ Yes (callbacks)  │
│  RPC Methods         │  ████████████ 100%       │  ✓ Yes (RpcStub)    │
│  Callbacks (BiDir)   │  ████████████ 100%       │  ✓ Yes (NEW!)       │
│  Capability Auth     │  ████████████ 100%       │  ✓ Yes (NEW!)       │
│  Promise Pipeline    │  ████████████ 100%       │  ✓ Yes (NEW!)       │
│  Error Handling      │  ████████████ 100%       │  ✗ No (exceptions)  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Event Flow Testing: HTTP vs. capnweb

### HTTP/SSE Flow (Gemini)
```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ POST /message/stream
       │ {message: "hello"}
       ▼
┌──────────────┐         ┌──────────────┐
│  Express App │────────▶│  Task Engine │
└──────┬───────┘         └──────┬───────┘
       │                        │
       │ Open SSE stream        │ Generate events
       │◀───────────────────────┤
       │                        │
       │ data: {event1}         │
       │◀───────────────────────┤
       │                        │
       │ data: {event2}         │
       │◀───────────────────────┤
       │                        │
       │ data: {final}          │
       │◀───────────────────────┘
       │
       ▼
┌─────────────────┐
│ streamToSSEEvents│ ──▶ Parse text stream
└─────────────────┘      into JSON array
       │
       ▼
┌─────────────────┐
│  Test Assertions │ ──▶ Verify order, structure
└─────────────────┘

Test Code:
  const res = await request(app).post('/').send(message);
  const events = streamToSSEEvents(res.text);
  assertTaskCreationAndWorkingStatus(events);
```

### capnweb RPC Flow (Our Implementation)
```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ RPC: sendMessageStreaming(message, callback)
       │
       ▼
┌──────────────┐         ┌──────────────┐
│  RpcStub     │────────▶│ A2AService   │
└──────────────┘         └──────┬───────┘
                                │
                                ▼
                         ┌──────────────┐
                         │  Task Engine │
                         └──────┬───────┘
                                │
                                │ Generate events
                                │
       ┌────────────────────────┘
       │
       │ callback.onStatusUpdate({event1})
       │◀─────────────────────────────────────┐
       │                                      │
       │ callback.onStatusUpdate({event2})    │
       │◀─────────────────────────────────────┤
       │                                      │
       │ callback.onStatusUpdate({final})     │
       │◀─────────────────────────────────────┘
       │
       ▼
┌─────────────────┐
│ EventCollector  │ ──▶ Collect callbacks
└─────────────────┘      into array
       │
       ▼
┌─────────────────┐
│  Test Assertions │ ──▶ Verify order, structure
└─────────────────┘

Test Code:
  const collector = new EventCollector();
  await server.sendMessageStreaming(message, undefined, collector);
  await collector.waitForFinal();
  assertTaskCreationAndWorkingStatus(collector.events);
```

## Test Pyramid Architecture

```
                    ▲
                    │
                    │  Complexity & Runtime
                    │
    ┌───────────────────────────┐
    │   E2E Protocol Tests      │  ← ~5 tests, slow, comprehensive
    │   ─────────────────────   │
    │   • Full task lifecycle   │
    │   • Multi-tool scenarios  │
    │   • Real connections      │
    └───────────────────────────┘
              ▲
              │
      ┌───────────────────────────────┐
      │   Integration Tests           │  ← ~20 tests, moderate speed
      │   ───────────────────────────  │
      │   • RPC method coverage       │
      │   • Streaming with callbacks  │
      │   • Error propagation         │
      │   • Authentication flows      │
      └───────────────────────────────┘
                  ▲
                  │
        ┌─────────────────────────────────┐
        │   Unit Tests                    │  ← ~50 tests, fast
        │   ─────────────────────────────  │
        │   • Task state machine          │
        │   • StreamingTask logic         │
        │   • Callback interfaces         │
        │   • Event publishing            │
        │   • Helper utilities            │
        └─────────────────────────────────┘
                      ▲
                      │
                      │  Test Count & Speed
                      │
```

## Tool Execution Lifecycle State Machine

```
                    ┌──────────────┐
                    │   PENDING    │ ← Tool call requested
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  VALIDATING  │ ← Check if tool exists, parse args
                    └──────┬───────┘
                           │
                ┌──────────┴──────────┐
                │                     │
    Needs       ▼                     ▼      No approval
    approval  ┌─────────────┐    ┌──────────┐  needed
              │  AWAITING   │    │SCHEDULED │
              │  APPROVAL   │    └────┬─────┘
              └──────┬──────┘         │
                     │                │
        User         │                │
        responds     │                │
                     ▼                │
              ┌─────────────┐         │
              │  SCHEDULED  │◀────────┘
              └──────┬──────┘
                     │
                     ▼
              ┌─────────────┐
              │  EXECUTING  │ ← Tool runs
              └──────┬──────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
    ┌─────────┐            ┌─────────┐
    │ SUCCESS │            │  ERROR  │
    └─────────┘            └─────────┘

Test Coverage:
  ✓ All state transitions
  ✓ Approval required path
  ✓ Auto-approve (YOLO mode)
  ✓ Concurrent tools
  ✓ Error scenarios
```

## Streaming Event Invariants

```
Event Stream Invariants (MUST be true for all implementations):

┌─────────────────────────────────────────────────────────────┐
│  Invariant 1: Task Creation Always First                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  events[0].kind === 'status-update'                         │
│  events[0].status.state === 'submitted'                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Invariant 2: Immediate Transition to Working                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  events[1].kind === 'status-update'                         │
│  events[1].status.state === 'working'                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Invariant 3: Exactly One Final Event                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  events.filter(e => e.final === true).length === 1          │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Invariant 4: Final Event Is Last                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  events[events.length - 1].final === true                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Invariant 5: Context/Task ID Consistency                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ∀ event ∈ events:                                          │
│    event.taskId === expectedTaskId                          │
│    event.contextId === expectedContextId                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Test File Organization

```
a2aWebCap/
├── packages/
│   ├── server/
│   │   ├── src/
│   │   │   ├── index.ts              # A2AService implementation
│   │   │   ├── streaming-task.ts     # StreamingTask RpcTarget
│   │   │   ├── task-manager.ts       # Task state management
│   │   │   └── auth-service.ts       # Authentication
│   │   └── tests/
│   │       ├── unit/
│   │       │   ├── task.test.ts           # Task state machine
│   │       │   ├── streaming-task.test.ts # StreamingTask logic
│   │       │   └── callbacks.test.ts      # Callback interface
│   │       ├── integration/
│   │       │   ├── rpc-methods.test.ts    # All RPC methods
│   │       │   ├── streaming.test.ts      # Callback streaming
│   │       │   ├── auth.test.ts           # Authentication
│   │       │   └── errors.test.ts         # Error handling
│   │       ├── e2e/
│   │       │   ├── protocol.test.ts       # A2A protocol compliance
│   │       │   ├── tools.test.ts          # Tool execution lifecycle
│   │       │   └── agent-card.test.ts     # AgentCard serving
│   │       └── utils/
│   │           ├── event-collector.ts     # EventCollector utility
│   │           ├── assertions.ts          # Protocol assertions
│   │           ├── mocks.ts               # Mock factories
│   │           └── helpers.ts             # Test helpers
│   │
│   ├── client/
│   │   ├── src/
│   │   │   └── index.ts              # A2AClient implementation
│   │   └── tests/
│   │       ├── client.test.ts        # Client behavior
│   │       └── callbacks.test.ts     # Client-side callbacks
│   │
│   └── shared/
│       ├── src/
│       │   └── index.ts              # Shared types
│       └── tests/
│           └── types.test.ts         # Type definitions
│
└── vitest.config.ts                  # Shared test config
```

## Reusable vs. New Test Components

```
┌───────────────────────────────────────────────────────────────┐
│                  FROM GEMINI (Reusable)                        │
├───────────────────────────────────────────────────────────────┤
│                                                                │
│  ✓ Protocol Invariant Assertions                              │
│    └─ assertTaskCreationAndWorkingStatus()                    │
│    └─ assertUniqueFinalEventIsLast()                          │
│    └─ assertToolLifecycle()                                   │
│                                                                │
│  ✓ Test Scenarios                                             │
│    └─ Text content streaming                                  │
│    └─ Tool execution (approval required)                      │
│    └─ Tool execution (auto-approve)                           │
│    └─ Multiple concurrent tools                               │
│    └─ Tool failure handling                                   │
│    └─ Trace ID propagation                                    │
│                                                                │
│  ✓ Mocking Strategy                                           │
│    └─ Mock LLM responses                                      │
│    └─ Mock tool registry                                      │
│    └─ Mock configuration                                      │
│                                                                │
└───────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│                  NEW FOR CAPNWEB (Build)                       │
├───────────────────────────────────────────────────────────────┤
│                                                                │
│  ⚡ EventCollector Utility                                     │
│    └─ Captures RPC callback invocations                       │
│    └─ waitForFinal() helper                                   │
│    └─ Event array for assertions                              │
│                                                                │
│  ⚡ Bidirectional RPC Tests                                    │
│    └─ Server → Client callbacks                               │
│    └─ Callback error handling                                 │
│    └─ Client disconnection scenarios                          │
│                                                                │
│  ⚡ Capability Security Tests                                  │
│    └─ authenticate() returns authorized stub                  │
│    └─ Stub disposal revokes access                            │
│    └─ Unauthorized operation rejection                        │
│                                                                │
│  ⚡ Promise Pipelining Tests                                   │
│    └─ Chained dependent calls                                 │
│    └─ Latency reduction verification                          │
│    └─ Error propagation in chains                             │
│                                                                │
│  ⚡ WebSocket Lifecycle Tests                                  │
│    └─ Connection establishment                                │
│    └─ Reconnection logic                                      │
│    └─ Resource cleanup on disposal                            │
│                                                                │
└───────────────────────────────────────────────────────────────┘
```

## Testing Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    Development Workflow                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Write Implementation                                     │
│     └─ Implement A2AService method                          │
│                                                              │
│  2. Write Unit Test                                          │
│     └─ Test isolated logic                                  │
│     └─ Mock dependencies                                    │
│                                                              │
│  3. Write Integration Test                                   │
│     └─ Test method via RpcStub                              │
│     └─ Verify event publishing                              │
│                                                              │
│  4. Run Tests                                                │
│     └─ bun test                                             │
│                                                              │
│  5. Verify Coverage                                          │
│     └─ bun test --coverage                                  │
│     └─ Ensure > 90% coverage                                │
│                                                              │
│  6. Run E2E Tests                                            │
│     └─ Verify full protocol behavior                        │
│     └─ Test against real WebSocket                          │
│                                                              │
│  7. Compatibility Check                                      │
│     └─ Compare with HTTP A2A implementation                 │
│     └─ Verify all invariants hold                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

**Legend:**
- ✓ = Reusable from Gemini implementation
- ⚡ = New for capnweb
- ✗ = Not applicable / Not needed
- ░ = Low coverage
- █ = High coverage
