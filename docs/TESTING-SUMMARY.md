# Testing Strategy Research: Executive Summary

**Date:** October 31, 2025  
**Research Focus:** Gemini A2A Server Testing Approach  
**Application:** a2aWebCap Testing Strategy

---

## Research Objective

Analyze Google's reference A2A server implementation to understand:
1. What protocol invariants and properties are being tested
2. How tests are structured and organized
3. Which tests are transport-agnostic vs. transport-specific
4. What we can reuse for our capnweb-based implementation

---

## Key Findings

### 1. **Protocol-Centric, Not Transport-Centric**

The Gemini tests focus on **A2A protocol behavior**, not HTTP/SSE mechanics. This means:

✅ **~80% of test logic is reusable** for our capnweb implementation  
✅ Protocol invariants are transport-independent  
✅ Only the "how" (transport layer) changes, not the "what" (protocol semantics)

**Implication:** We can port most test scenarios directly, just adapting the transport layer.

---

### 2. **Five Critical Protocol Invariants**

All A2A implementations MUST verify these invariants:

```typescript
// Invariant 1: Task creation is always first
events[0].status.state === 'submitted'

// Invariant 2: Immediate transition to working
events[1].status.state === 'working'

// Invariant 3: Exactly one final event
events.filter(e => e.final === true).length === 1

// Invariant 4: Final event is always last
events[events.length - 1].final === true

// Invariant 5: Consistent ID propagation
∀ event: event.taskId === expectedTaskId && event.contextId === expectedContextId
```

**Action Item:** Implement these as reusable assertion functions in our test utils.

---

### 3. **Tool Execution Lifecycle Testing**

The most comprehensive test coverage is around tool execution:

```
validating → scheduled → executing → (success | error)
         ↓
   awaiting_approval (if needed)
         ↓
   (user decision)
```

**Test Coverage Includes:**
- Tools requiring approval
- Auto-approval (YOLO mode)
- Multiple concurrent tools
- Tool failures
- User rejecting tools

**Relevance:** Tool execution is transport-agnostic. We test the same lifecycle, just via RPC instead of HTTP.

---

### 4. **Testing Stack**

**Gemini Uses:**
- **Framework:** Vitest (modern, fast, TypeScript-first)
- **HTTP Testing:** Supertest (Express app testing)
- **Mocking:** Vitest's built-in `vi.mock()`
- **Coverage:** V8 provider with multiple reporters

**We Should Use:**
- **Framework:** Vitest ✅ (same choice)
- **RPC Testing:** Direct RpcStub calls (simpler than Supertest)
- **Mocking:** Vitest `vi.mock()` ✅ (same approach)
- **Coverage:** V8 provider ✅ (same tooling)

**Advantage:** We can reuse the exact same testing infrastructure!

---

### 5. **Test Organization Pattern**

Gemini uses co-located tests:

```
src/
├── http/
│   ├── app.ts
│   ├── app.test.ts        ← E2E integration tests
│   └── endpoints.test.ts  ← Endpoint-specific tests
└── agent/
    ├── task.ts
    └── task.test.ts       ← Unit tests for task logic
```

**Our Adaptation:**
```
packages/server/
├── src/
│   ├── index.ts
│   ├── streaming-task.ts
│   └── task-manager.ts
└── tests/
    ├── unit/              ← Isolated component tests
    ├── integration/       ← RPC method tests
    ├── e2e/              ← Full protocol compliance
    └── utils/            ← Shared test utilities
```

---

## What We Can Reuse (Direct Ports)

### ✅ Protocol Invariant Assertions

```typescript
// From Gemini tests - works for ANY transport
function assertTaskCreationAndWorkingStatus(events) {
  expect(events[0].status.state).toBe('submitted');
  expect(events[1].status.state).toBe('working');
}

function assertUniqueFinalEventIsLast(events) {
  const finalEvents = events.filter(e => e.final === true);
  expect(finalEvents.length).toBe(1);
  expect(events[events.length - 1].final).toBe(true);
}
```

**Usage in capnweb:**
```typescript
const collector = new EventCollector();
await server.sendMessageStreaming(message, collector);
await collector.waitForFinal();

// Same assertions work!
assertTaskCreationAndWorkingStatus(collector.events);
assertUniqueFinalEventIsLast(collector.events);
```

---

### ✅ Test Scenarios

All these scenarios are directly portable:

1. **Text content streaming** - Agent sends text response
2. **Tool execution (approval required)** - User must approve tool
3. **Tool execution (auto-approve)** - YOLO mode, no approval
4. **Multiple concurrent tools** - Parallel tool execution
5. **Tool failure handling** - Tool execution errors
6. **Trace ID propagation** - Distributed tracing support

---

### ✅ Mocking Strategy

Mock external dependencies, test real protocol logic:

```typescript
// Mock LLM (same approach)
const mockLLM = vi.fn().mockImplementation(async function* () {
  yield { type: 'content', value: 'Response' };
});

// Mock tool registry (same approach)
const mockTool = new MockTool({
  name: 'test-tool',
  execute: vi.fn().mockResolvedValue({ result: 'success' })
});

// Mock config (same approach)
const mockConfig = createMockConfig({ model: 'test-model' });
```

---

## What We Must Adapt (Transport Layer)

### 🔄 HTTP → RPC Method Calls

**Gemini (HTTP):**
```typescript
const res = await request(app)
  .post('/')
  .send(createStreamMessageRequest('hello'))
  .expect(200);
```

**capnweb (RPC):**
```typescript
const streamingTask = await server.sendMessageStreaming(
  createTestMessage('hello'),
  undefined,
  callback
);
```

---

### 🔄 SSE Parsing → Callback Collection

**Gemini (SSE):**
```typescript
const events = streamToSSEEvents(res.text);
// Parses "data: {...}\n\n" into JSON array
```

**capnweb (Callbacks):**
```typescript
const collector = new EventCollector();
// Collects callback invocations into array
await collector.waitForFinal();
const events = collector.events;
```

---

### 🔄 HTTP Status Codes → JavaScript Exceptions

**Gemini (HTTP):**
```typescript
const res = await request(app).get('/tasks/fake-id');
expect(res.status).toBe(404);
```

**capnweb (Exceptions):**
```typescript
await expect(server.getTask('fake-id'))
  .rejects.toThrow('Task not found');
```

---

## What Is New to capnweb (Novel Tests)

### 🆕 Bidirectional RPC Callbacks

**New Test Category:**
```typescript
it('should receive server-initiated callback', async () => {
  const callback = new TestCallback();
  const task = await server.sendMessageStreaming(message, callback);
  
  // Wait for server to invoke callback
  await waitForCallback(callback, 1000);
  
  expect(callback.invocations.length).toBeGreaterThan(0);
});
```

**Why This Matters:** HTTP A2A uses webhooks (client provides URL, server POSTs). capnweb has **native bidirectional RPC**, which is simpler and faster but needs new test patterns.

---

### 🆕 Capability-Based Security

**New Test Category:**
```typescript
it('should return authorized stub after authentication', async () => {
  const authStub = await server.authenticate({ token: 'valid' });
  
  // Authorized stub has user context
  const task = await authStub.sendMessage(message);
  expect(task.userId).toBe('test-user');
  
  // Disposing stub revokes access
  authStub[Symbol.dispose]();
  await expect(authStub.sendMessage(message))
    .rejects.toThrow('Stub disposed');
});
```

**Why This Matters:** capnweb's capability model is more secure than HTTP bearer tokens. We need to test stub lifecycle and access control.

---

### 🆕 Promise Pipelining

**New Test Category:**
```typescript
it('should pipeline dependent calls in one RTT', async () => {
  const start = Date.now();
  
  const authPromise = server.authenticate(credentials);
  const userPromise = authPromise.then(stub => stub.getUser());
  const profilePromise = userPromise.then(user => user.getProfile());
  
  const profile = await profilePromise;
  const elapsed = Date.now() - start;
  
  // Should complete in ~1 RTT, not 3
  expect(elapsed).toBeLessThan(RTT * 1.5);
});
```

**Why This Matters:** Promise pipelining is a unique capnweb feature that reduces latency. We should test and benchmark it.

---

### 🆕 WebSocket Connection Management

**New Test Category:**
```typescript
it('should reconnect after disconnection', async () => {
  const server = newWebSocketRpcSession('ws://localhost:8080');
  
  // Simulate disconnection
  simulateNetworkFailure();
  
  // Should auto-reconnect
  await waitForReconnection();
  
  // RPC calls should still work
  const task = await server.sendMessage(message);
  expect(task).toBeDefined();
});
```

**Why This Matters:** WebSocket lifecycle management (connect, disconnect, reconnect, dispose) needs testing. HTTP doesn't have persistent connections.

---

## Test Infrastructure We Need to Build

### 1. **EventCollector Utility**

```typescript
export class EventCollector extends RpcTarget implements TaskUpdateCallback {
  events: Event[] = [];
  finalReceived = false;
  
  async onStatusUpdate(event: StatusUpdateEvent) {
    this.events.push(event);
    if (event.final) this.finalReceived = true;
  }
  
  async onArtifactUpdate(event: ArtifactUpdateEvent) {
    this.events.push(event);
  }
  
  waitForFinal(timeoutMs = 5000): Promise<void> {
    // Wait for final event or timeout
  }
}
```

**Usage:**
```typescript
const collector = new EventCollector();
await server.sendMessageStreaming(message, collector);
await collector.waitForFinal();
// Now collector.events has all events in order
```

---

### 2. **Protocol Assertion Helpers**

Port from Gemini and adapt:

```typescript
export function assertTaskCreationAndWorkingStatus(events: Event[]) { ... }
export function assertUniqueFinalEventIsLast(events: Event[]) { ... }
export function assertToolLifecycle(events: Event[], toolId: string, states: string[]) { ... }
export function assertContextPropagation(events: Event[], taskId: string, contextId: string) { ... }
```

---

### 3. **Mock Factories**

```typescript
export function createMockConfig(overrides?: Partial<Config>): Config { ... }
export function createMockTool(name: string, behavior: ToolBehavior): MockTool { ... }
export function createMockToolRegistry(tools: MockTool[]): ToolRegistry { ... }
export function createTestMessage(text: string): Message { ... }
```

---

## Recommended Test Priorities

### **Phase 1: Foundation (Week 1)**
1. Set up Vitest configuration
2. Build EventCollector utility
3. Port protocol assertion helpers
4. Write first RPC method test (sendMessage)
5. Write first streaming test (basic text content)

### **Phase 2: Protocol Compliance (Week 2)**
6. Port all Gemini test scenarios
7. Test task lifecycle state machine
8. Test tool execution lifecycle
9. Test error handling
10. Verify all 5 protocol invariants

### **Phase 3: capnweb Features (Week 3)**
11. Test bidirectional callbacks
12. Test capability-based authentication
13. Test promise pipelining
14. Test WebSocket connection management
15. Test stub disposal and resource cleanup

### **Phase 4: Validation (Week 4)**
16. Compatibility tests (compare with HTTP A2A)
17. Performance benchmarks (latency, throughput)
18. Stress tests (load, concurrent connections)
19. Integration with real LLM (if available)
20. Documentation and examples

---

## Success Metrics

### **Coverage Goals**
- [ ] **Unit Tests:** >90% code coverage
- [ ] **Integration Tests:** All RPC methods covered
- [ ] **E2E Tests:** All protocol invariants verified
- [ ] **Performance:** Latency < HTTP A2A implementation

### **Protocol Compliance**
- [ ] All 5 core invariants hold
- [ ] Tool lifecycle matches Gemini behavior
- [ ] Event ordering matches spec
- [ ] Error handling matches spec
- [ ] AgentCard served correctly

### **capnweb-Specific**
- [ ] Bidirectional callbacks work
- [ ] Capability security enforced
- [ ] Promise pipelining reduces latency
- [ ] WebSocket reconnection works
- [ ] Resource cleanup on disposal

---

## Next Steps

### **Immediate Actions**
1. ✅ Complete this research document
2. ⏭️ Set up Vitest in the project
3. ⏭️ Create `packages/server/tests/utils/` directory
4. ⏭️ Implement EventCollector utility
5. ⏭️ Port first assertion helper

### **This Week**
6. ⏭️ Write first unit test (task state machine)
7. ⏭️ Write first integration test (sendMessage RPC)
8. ⏭️ Write first E2E test (basic streaming)

### **This Month**
9. ⏭️ Complete Phase 1 & 2 (foundation + protocol compliance)
10. ⏭️ Begin Phase 3 (capnweb-specific features)

---

## Conclusion

The Gemini A2A server tests provide an **excellent foundation** for our testing strategy. The key insight is that **protocol behavior is transport-independent**, allowing us to reuse ~80% of the test logic.

**Our advantages with capnweb:**
- ✅ Simpler test setup (no SSE parsing)
- ✅ Better error handling (exceptions vs HTTP codes)
- ✅ New capabilities to test (bidirectional RPC, capability security, promise pipelining)
- ✅ Same testing infrastructure (Vitest)

**Our challenges:**
- 🔧 Need to build EventCollector utility
- 🔧 Need to adapt transport layer (HTTP → RPC)
- 🔧 Need to test new capnweb features (no reference implementation)

**Overall Assessment:** The research validates that our testing approach is sound and that we have a clear path forward with concrete, actionable next steps.

---

**Related Documents:**
- [Full Research Document](./testing-strategy-research.md) - Detailed analysis
- [Visual Reference](./testing-strategy-visual.md) - Diagrams and charts
- [Design Document](./design.md) - Architecture and protocol mapping

**Version:** 1.0  
**Last Updated:** October 31, 2025
