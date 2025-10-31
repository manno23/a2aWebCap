# Testing Quick Reference Card

**For:** a2aWebCap Developers  
**Updated:** October 31, 2025

---

## 🎯 Five Core Protocol Invariants

Every test MUST verify these:

```typescript
// 1. Task creation is always first event
events[0].status.state === 'submitted'

// 2. Immediate transition to working
events[1].status.state === 'working'

// 3. Exactly one final event
events.filter(e => e.final).length === 1

// 4. Final event is always last
events[events.length - 1].final === true

// 5. Consistent IDs throughout
∀ event: event.taskId === taskId && event.contextId === contextId
```

---

## 🧪 Basic Test Template

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { newWebSocketRpcSession, RpcStub } from 'capnweb';
import { A2AService, EventCollector } from '../utils';

describe('Feature Name', () => {
  let server: RpcStub<A2AService>;
  let collector: EventCollector;
  
  beforeEach(async () => {
    server = newWebSocketRpcSession('ws://localhost:8080');
    collector = new EventCollector();
  });
  
  afterEach(() => {
    server[Symbol.dispose]();
  });
  
  it('should do something', async () => {
    // Arrange
    const message = createTestMessage('test');
    
    // Act
    await server.sendMessageStreaming(message, undefined, collector);
    await collector.waitForFinal();
    
    // Assert
    assertTaskCreationAndWorkingStatus(collector.events);
    assertUniqueFinalEventIsLast(collector.events);
  });
});
```

---

## 📦 EventCollector Usage

```typescript
// Create collector
const collector = new EventCollector();

// Pass to streaming method
await server.sendMessageStreaming(message, undefined, collector);

// Wait for completion
await collector.waitForFinal(5000); // 5s timeout

// Access events
const events = collector.events;
const statusUpdates = collector.statusUpdates;
const artifactUpdates = collector.artifactUpdates;

// Check state
if (collector.finalReceived) {
  // All events received
}
```

---

## ✅ Common Assertions

```typescript
// Protocol invariants
assertTaskCreationAndWorkingStatus(events);
assertUniqueFinalEventIsLast(events);
assertContextPropagation(events, taskId, contextId);

// Tool lifecycle
assertToolLifecycle(events, toolCallId, [
  'validating',
  'scheduled',
  'executing',
  'success'
]);

// Event structure
expect(event.kind).toBe('status-update');
expect(event.status.state).toBe('working');
expect(event.status.message?.parts).toMatchObject([
  { kind: 'text', text: 'Expected text' }
]);

// Error handling
await expect(server.getTask('invalid-id'))
  .rejects.toThrow('Task not found');
```

---

## 🔧 Mock Factories

```typescript
// Mock message
const message = createTestMessage('Hello, world!');

// Mock config
const config = createMockConfig({
  model: 'test-model',
  approvalMode: ApprovalMode.YOLO
});

// Mock tool
const tool = createMockTool('test-tool', {
  execute: async (args) => ({ result: 'success' })
});

// Mock tool registry
const registry = createMockToolRegistry([tool1, tool2]);

// Mock LLM response
mockLLM.mockImplementation(async function* () {
  yield { type: 'content', value: 'Response' };
  yield { type: 'tool-call', value: { name: 'test-tool' } };
});
```

---

## 🧩 Test Categories

### Unit Tests (`packages/server/tests/unit/`)
- Test isolated components
- Mock all dependencies
- Fast execution (<10ms per test)

```typescript
it('should transition from submitted to working', () => {
  const task = new Task('id', 'contextId', mockConfig);
  task.setState('working');
  expect(task.state).toBe('working');
});
```

### Integration Tests (`packages/server/tests/integration/`)
- Test RPC methods via RpcStub
- Mock external services (LLM, tools)
- Moderate execution (~100ms per test)

```typescript
it('should send message via RPC', async () => {
  const task = await server.sendMessage(message);
  expect(task.id).toBeDefined();
});
```

### E2E Tests (`packages/server/tests/e2e/`)
- Test full protocol behavior
- Real WebSocket connections
- Slow execution (~1s per test)

```typescript
it('should complete full task lifecycle', async () => {
  const collector = new EventCollector();
  await server.sendMessageStreaming(message, undefined, collector);
  await collector.waitForFinal();
  // Verify all protocol invariants
});
```

---

## 🎭 Mocking Patterns

### Mock LLM Responses
```typescript
const mockLLM = vi.fn().mockImplementation(async function* () {
  yield { type: 'content', value: 'Hello' };
  yield { type: 'thought', value: { subject: 'Thinking' } };
});
```

### Mock Tool Execution
```typescript
const mockTool = {
  name: 'test-tool',
  execute: vi.fn().mockResolvedValue({
    llmContent: 'Tool executed',
    returnDisplay: 'Success'
  })
};
```

### Mock Callbacks
```typescript
class MockCallback extends RpcTarget implements TaskUpdateCallback {
  calls: any[] = [];
  
  async onStatusUpdate(event: StatusUpdateEvent) {
    this.calls.push({ type: 'status', event });
  }
  
  async onArtifactUpdate(event: ArtifactUpdateEvent) {
    this.calls.push({ type: 'artifact', event });
  }
}
```

---

## 🐛 Debugging Tests

### Enable Logging
```typescript
// In test file
import { logger } from '../utils/logger';

beforeEach(() => {
  logger.level = 'debug'; // Show all logs
});
```

### Inspect Events
```typescript
// Print all events
console.log(JSON.stringify(collector.events, null, 2));

// Print specific event
console.log('Event 3:', collector.events[3]);

// Filter events
const toolEvents = collector.events.filter(e => 
  e.metadata?.coderAgent?.kind === 'tool-call-update'
);
```

### Timeout Issues
```typescript
// Increase timeout for slow tests
it('slow test', async () => {
  await collector.waitForFinal(10000); // 10s timeout
}, 15000); // 15s test timeout
```

---

## 📊 Coverage Commands

```bash
# Run all tests
bun test

# Run with coverage
bun test --coverage

# Run specific test file
bun test packages/server/tests/unit/task.test.ts

# Run tests matching pattern
bun test --grep "streaming"

# Watch mode
bun test --watch

# UI mode
bun test --ui
```

---

## 🚀 Test-Driven Development Workflow

```
1. Write failing test
   └─ it('should do X', async () => { ... })

2. Run test (should fail)
   └─ bun test

3. Implement feature
   └─ Update src/

4. Run test (should pass)
   └─ bun test

5. Refactor if needed
   └─ Keep tests green

6. Verify coverage
   └─ bun test --coverage
```

---

## 🔍 Common Test Scenarios

### Text Content Streaming
```typescript
it('should stream text content', async () => {
  mockLLM.mockImplementation(async function* () {
    yield { type: 'content', value: 'Hello' };
  });
  
  await server.sendMessageStreaming(message, undefined, collector);
  await collector.waitForFinal();
  
  const textEvent = collector.events[2];
  expect(textEvent.status.message?.parts).toMatchObject([
    { kind: 'text', text: 'Hello' }
  ]);
});
```

### Tool Execution (Approval Required)
```typescript
it('should request approval for tool', async () => {
  mockLLM.mockImplementation(async function* () {
    yield {
      type: 'tool-call',
      value: { callId: 'call-1', name: 'dangerous-tool' }
    };
  });
  
  await server.sendMessageStreaming(message, undefined, collector);
  await collector.waitForFinal();
  
  const approvalEvent = collector.events.find(e =>
    e.metadata?.coderAgent?.kind === 'tool-call-confirmation'
  );
  expect(approvalEvent).toBeDefined();
  expect(approvalEvent.status.state).toBe('input-required');
});
```

### Tool Execution (Auto-Approve)
```typescript
it('should auto-approve in YOLO mode', async () => {
  const config = createMockConfig({ approvalMode: ApprovalMode.YOLO });
  
  mockLLM.mockImplementation(async function* () {
    yield {
      type: 'tool-call',
      value: { callId: 'call-1', name: 'test-tool' }
    };
  });
  
  await server.sendMessageStreaming(message, undefined, collector);
  await collector.waitForFinal();
  
  assertToolLifecycle(collector.events, 'call-1', [
    'validating',
    'scheduled',
    'executing',
    'success'
  ]);
});
```

### Error Handling
```typescript
it('should handle tool execution error', async () => {
  const mockTool = createMockTool('error-tool', {
    execute: async () => {
      throw new Error('Tool failed');
    }
  });
  
  await server.sendMessageStreaming(message, undefined, collector);
  await collector.waitForFinal();
  
  const errorEvent = collector.events.find(e =>
    e.status.message?.parts.some(p =>
      p.data?.status === 'error'
    )
  );
  expect(errorEvent).toBeDefined();
});
```

---

## 📚 Related Documents

- **Full Research:** [testing-strategy-research.md](./testing-strategy-research.md)
- **Visual Guide:** [testing-strategy-visual.md](./testing-strategy-visual.md)
- **Summary:** [TESTING-SUMMARY.md](./TESTING-SUMMARY.md)
- **Design:** [design.md](./design.md)

---

**Version:** 1.0  
**Maintained by:** a2aWebCap Team  
**Last Updated:** October 31, 2025
