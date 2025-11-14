# TypeScript Best Practices for a2aWebCap

**Version:** 1.0
**Last Updated:** 2025-11-14
**Based on:** 2025 TypeScript industry standards and research

This document outlines comprehensive best practices for TypeScript development in the a2aWebCap project, focusing on reliability, maintainability, and type safety.

---

## Table of Contents

1. [SOLID Principles](#solid-principles)
2. [Error Handling Patterns](#error-handling-patterns)
3. [Defensive Programming](#defensive-programming)
4. [Async/Await Best Practices](#asyncawait-best-practices)
5. [Design Patterns](#design-patterns)
6. [Type Safety Guidelines](#type-safety-guidelines)
7. [Testing Practices](#testing-practices)
8. [Project-Specific Guidelines](#project-specific-guidelines)

---

## SOLID Principles

### Single Responsibility Principle (SRP)

**Rule:** Each class/module should have one reason to change.

**✅ Good Example:**
```typescript
// Separate concerns
class TaskManager {
  createTask(message: Message): Task { /* ... */ }
  getTask(id: string): Task { /* ... */ }
}

class TaskValidator {
  validate(task: Task): ValidationResult { /* ... */ }
}

class TaskPersistence {
  save(task: Task): Promise<void> { /* ... */ }
}
```

**❌ Bad Example:**
```typescript
// Too many responsibilities
class TaskManager {
  createTask() { /* ... */ }
  validateTask() { /* ... */ }
  saveToDatabase() { /* ... */ }
  sendNotification() { /* ... */ }
  logActivity() { /* ... */ }
}
```

### Open/Closed Principle (OCP)

**Rule:** Open for extension, closed for modification.

**✅ Good Example:**
```typescript
interface Reporter {
  report(results: TestResults): void;
}

class EnhancedReporter implements Reporter {
  report(results: TestResults): void { /* ... */ }
}

class JSONReporter implements Reporter {
  report(results: TestResults): void { /* ... */ }
}

// Easy to add new reporters without modifying existing code
```

### Liskov Substitution Principle (LSP)

**Rule:** Subtypes must be substitutable for their base types.

**✅ Good Example:**
```typescript
interface TaskUpdateCallback {
  onStatusUpdate(event: StatusUpdateEvent): Promise<void>;
  onArtifactUpdate(event: ArtifactUpdateEvent): Promise<void>;
}

class TestCallback implements TaskUpdateCallback {
  async onStatusUpdate(event: StatusUpdateEvent): Promise<void> {
    // Always returns Promise<void> as expected
  }

  async onArtifactUpdate(event: ArtifactUpdateEvent): Promise<void> {
    // Always returns Promise<void> as expected
  }
}
```

### Interface Segregation Principle (ISP)

**Rule:** Clients shouldn't depend on interfaces they don't use.

**✅ Good Example:**
```typescript
interface Readable {
  read(id: string): Promise<Task>;
}

interface Writable {
  write(task: Task): Promise<void>;
}

interface Deletable {
  delete(id: string): Promise<void>;
}

// Clients only implement what they need
class ReadOnlyTaskManager implements Readable {
  async read(id: string): Promise<Task> { /* ... */ }
}
```

**❌ Bad Example:**
```typescript
interface TaskRepository {
  read(id: string): Promise<Task>;
  write(task: Task): Promise<void>;
  delete(id: string): Promise<void>;
  // Forces read-only implementations to implement write/delete
}
```

### Dependency Inversion Principle (DIP)

**Rule:** Depend on abstractions, not concretions.

**✅ Good Example:**
```typescript
interface Logger {
  log(message: string): void;
}

class A2AService {
  constructor(private logger: Logger) {} // Depends on abstraction

  processMessage(msg: Message) {
    this.logger.log('Processing message');
  }
}

// Easy to swap implementations
class ConsoleLogger implements Logger {
  log(message: string): void { console.log(message); }
}

class PinoLogger implements Logger {
  log(message: string): void { /* pino logging */ }
}
```

---

## Error Handling Patterns

### Result Type Pattern

**Recommendation:** Use Result<T, E> for operations that can fail predictably.

**Implementation:**
```typescript
type Result<T, E = Error> =
  | { success: true; value: T }
  | { success: false; error: E };

// Usage in functions
function parseTaskId(id: string): Result<string, ValidationError> {
  if (!id || id.trim().length === 0) {
    return {
      success: false,
      error: new ValidationError('Task ID cannot be empty')
    };
  }

  if (!id.match(/^task-[a-f0-9-]+$/)) {
    return {
      success: false,
      error: new ValidationError('Invalid task ID format')
    };
  }

  return { success: true, value: id };
}

// Client code
const result = parseTaskId(taskId);
if (result.success) {
  const task = await taskManager.getTask(result.value);
} else {
  logger.error('Invalid task ID', result.error);
}
```

**Benefits:**
- Forces explicit error handling
- Type-safe error paths
- Self-documenting code (return type shows function can fail)
- Composable (can chain Results together)

### Option Type Pattern

**Use for:** Handling nullable values explicitly.

```typescript
type Option<T> =
  | { kind: 'some'; value: T }
  | { kind: 'none' };

function getTask(id: string): Option<Task> {
  const task = taskMap.get(id);
  return task
    ? { kind: 'some', value: task }
    : { kind: 'none' };
}

// Usage with exhaustive checking
const taskOption = getTask(taskId);
switch (taskOption.kind) {
  case 'some':
    console.log('Task found:', taskOption.value);
    break;
  case 'none':
    console.log('Task not found');
    break;
}
```

### Custom Error Classes

```typescript
// Base error class
abstract class A2AError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;

  constructor(message: string, public readonly context?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      context: this.context
    };
  }
}

// Specific errors
class TaskNotFoundError extends A2AError {
  readonly code = 'TASK_NOT_FOUND';
  readonly statusCode = 404;

  constructor(taskId: string) {
    super(`Task not found: ${taskId}`, { taskId });
  }
}

class TaskValidationError extends A2AError {
  readonly code = 'TASK_VALIDATION_ERROR';
  readonly statusCode = 400;

  constructor(message: string, public readonly validationErrors: string[]) {
    super(message, { validationErrors });
  }
}

class TaskStateError extends A2AError {
  readonly code = 'TASK_STATE_ERROR';
  readonly statusCode = 409;

  constructor(message: string, currentState: TaskState, expectedState?: TaskState) {
    super(message, { currentState, expectedState });
  }
}
```

### Error Handling in Async Functions

```typescript
// ✅ Good: Explicit error handling with Result
async function createTask(message: Message): Promise<Result<Task, A2AError>> {
  try {
    // Validate input
    const validationResult = validateMessage(message);
    if (!validationResult.success) {
      return {
        success: false,
        error: new TaskValidationError('Invalid message', validationResult.errors)
      };
    }

    // Create task
    const task = await taskManager.createTask(message);
    return { success: true, value: task };

  } catch (error) {
    // Handle unexpected errors
    if (error instanceof A2AError) {
      return { success: false, error };
    }

    // Wrap unknown errors
    return {
      success: false,
      error: new A2AError('Unexpected error creating task', { originalError: error })
    };
  }
}
```

---

## Defensive Programming

### Input Validation

**Rule:** Validate all inputs at boundaries (API, constructors, public methods).

```typescript
class TaskManager {
  async createTask(message: Message, metadata?: Record<string, unknown>): Promise<Task> {
    // 1. Guard against null/undefined
    if (!message) {
      throw new TaskValidationError('Message cannot be null or undefined');
    }

    // 2. Validate structure
    if (!message.messageId || typeof message.messageId !== 'string') {
      throw new TaskValidationError('Message must have a valid messageId');
    }

    if (!message.role || !['user', 'agent', 'system'].includes(message.role)) {
      throw new TaskValidationError('Message must have a valid role');
    }

    if (!Array.isArray(message.parts) || message.parts.length === 0) {
      throw new TaskValidationError('Message must have at least one part');
    }

    // 3. Validate metadata if provided
    if (metadata !== undefined) {
      if (typeof metadata !== 'object' || metadata === null) {
        throw new TaskValidationError('Metadata must be an object');
      }
    }

    // 4. Proceed with validated inputs
    return await this.internalCreateTask(message, metadata);
  }

  private async internalCreateTask(message: Message, metadata?: Record<string, unknown>): Promise<Task> {
    // Internal method can assume inputs are valid
    // ...
  }
}
```

### Type Guards

```typescript
// Type guard functions
function isMessage(value: unknown): value is Message {
  return (
    typeof value === 'object' &&
    value !== null &&
    'messageId' in value &&
    'role' in value &&
    'parts' in value &&
    typeof (value as Message).messageId === 'string' &&
    ['user', 'agent', 'system'].includes((value as Message).role) &&
    Array.isArray((value as Message).parts)
  );
}

function isTaskState(value: string): value is TaskState {
  return [
    'submitted',
    'working',
    'input-required',
    'auth-required',
    'completed',
    'canceled',
    'failed',
    'rejected'
  ].includes(value);
}

// Usage
function processUnknownData(data: unknown): void {
  if (!isMessage(data)) {
    throw new TaskValidationError('Data is not a valid Message');
  }

  // TypeScript now knows 'data' is Message
  const task = taskManager.createTask(data);
}
```

### Assertion Functions

```typescript
function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${value}`);
}

// Usage for exhaustive checks
function handleTaskState(state: TaskState): string {
  switch (state) {
    case 'submitted':
      return 'Task submitted';
    case 'working':
      return 'Task processing';
    case 'completed':
      return 'Task complete';
    case 'failed':
      return 'Task failed';
    case 'canceled':
      return 'Task canceled';
    case 'rejected':
      return 'Task rejected';
    case 'input-required':
      return 'Input required';
    case 'auth-required':
      return 'Auth required';
    default:
      // Compiler will error if we miss a case
      return assertNever(state);
  }
}
```

### Runtime Validation Libraries

**Recommended:** Use Zod or io-ts for runtime validation.

```typescript
import { z } from 'zod';

// Define schema
const MessageSchema = z.object({
  messageId: z.string().uuid(),
  contextId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
  role: z.enum(['user', 'agent', 'system']),
  parts: z.array(z.object({
    kind: z.enum(['text', 'file', 'data']),
    // ... more fields
  })).min(1),
  metadata: z.record(z.unknown()).optional()
});

type Message = z.infer<typeof MessageSchema>;

// Validate with automatic type inference
function validateMessage(data: unknown): Result<Message, ValidationError> {
  const result = MessageSchema.safeParse(data);

  if (!result.success) {
    return {
      success: false,
      error: new ValidationError('Message validation failed', result.error.errors)
    };
  }

  return { success: true, value: result.data };
}
```

---

## Async/Await Best Practices

### Always Type Async Function Returns

```typescript
// ✅ Good: Explicit return type
async function getTask(id: string): Promise<Task> {
  return await taskManager.getTask(id);
}

// ❌ Bad: Implicit return type
async function getTask(id: string) {
  return await taskManager.getTask(id);
}
```

### Error Handling in Async Functions

```typescript
// ✅ Good: Proper error handling
async function processMessage(taskId: string, message: Message): Promise<Result<void, A2AError>> {
  try {
    const task = await taskManager.getTask(taskId);
    if (!task) {
      return {
        success: false,
        error: new TaskNotFoundError(taskId)
      };
    }

    await taskManager.addMessageToHistory(taskId, message);
    return { success: true, value: undefined };

  } catch (error) {
    if (error instanceof A2AError) {
      return { success: false, error };
    }

    return {
      success: false,
      error: new A2AError('Unexpected error', { originalError: error })
    };
  }
}
```

### Promise Combinators

```typescript
// Use Promise.all for parallel operations
async function loadMultipleTasks(ids: string[]): Promise<Task[]> {
  const tasks = await Promise.all(
    ids.map(id => taskManager.getTask(id))
  );
  return tasks;
}

// Use Promise.allSettled when some failures are acceptable
async function loadMultipleTasksSafely(ids: string[]): Promise<Result<Task[], TaskError[]>> {
  const results = await Promise.allSettled(
    ids.map(id => taskManager.getTask(id))
  );

  const tasks: Task[] = [];
  const errors: TaskError[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      tasks.push(result.value);
    } else {
      errors.push(new TaskError('Failed to load task', { error: result.reason }));
    }
  }

  if (errors.length > 0) {
    return { success: false, error: errors };
  }

  return { success: true, value: tasks };
}
```

### Avoid Mixing Promises and Callbacks

```typescript
// ❌ Bad: Mixing patterns
function doSomething(callback: (err: Error | null, result?: Task) => void) {
  taskManager.getTask('123')
    .then(task => callback(null, task))
    .catch(err => callback(err));
}

// ✅ Good: Use promises consistently
async function doSomething(): Promise<Task> {
  return await taskManager.getTask('123');
}
```

---

## Design Patterns

### Observer Pattern (for Test Reporter)

```typescript
interface Observer<T> {
  update(data: T): void;
}

interface Subject<T> {
  attach(observer: Observer<T>): void;
  detach(observer: Observer<T>): void;
  notify(data: T): void;
}

class TestResultsSubject implements Subject<TestResults> {
  private observers = new Set<Observer<TestResults>>();

  attach(observer: Observer<TestResults>): void {
    this.observers.add(observer);
  }

  detach(observer: Observer<TestResults>): void {
    this.observers.delete(observer);
  }

  notify(data: TestResults): void {
    for (const observer of this.observers) {
      try {
        observer.update(data);
      } catch (error) {
        console.error('Observer error:', error);
        // Don't let one observer failure stop others
      }
    }
  }
}

class EnhancedReporter implements Observer<TestResults> {
  update(data: TestResults): void {
    // Handle test results
  }
}
```

### Builder Pattern (for Complex Objects)

```typescript
class TaskBuilder {
  private task: Partial<Task> = {};

  withId(id: string): this {
    this.task.id = id;
    return this;
  }

  withContextId(contextId: string): this {
    this.task.contextId = contextId;
    return this;
  }

  withState(state: TaskState): this {
    this.task.status = { state, timestamp: new Date().toISOString() };
    return this;
  }

  withMessage(message: Message): this {
    this.task.history = [message];
    return this;
  }

  build(): Task {
    // Validate required fields
    if (!this.task.id) throw new Error('Task ID is required');
    if (!this.task.contextId) throw new Error('Context ID is required');
    if (!this.task.status) throw new Error('Task status is required');
    if (!this.task.history) throw new Error('Task history is required');

    return this.task as Task;
  }
}

// Usage
const task = new TaskBuilder()
  .withId('task-123')
  .withContextId('ctx-456')
  .withState('submitted')
  .withMessage(message)
  .build();
```

---

## Type Safety Guidelines

### Use Strict Mode

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitAny": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "useUnknownInCatchVariables": true
  }
}
```

### Prefer `unknown` over `any`

```typescript
// ✅ Good: Forces type checking
function processData(data: unknown): void {
  if (typeof data === 'string') {
    console.log(data.toUpperCase());
  } else if (isMessage(data)) {
    processMessage(data);
  }
}

// ❌ Bad: Bypasses type checking
function processData(data: any): void {
  console.log(data.toUpperCase()); // No error, might crash
}
```

### Use Branded Types for IDs

```typescript
type TaskId = string & { readonly __brand: 'TaskId' };
type ContextId = string & { readonly __brand: 'ContextId' };

function createTaskId(id: string): TaskId {
  // Validate ID format
  if (!id.match(/^task-[a-f0-9-]+$/)) {
    throw new Error('Invalid task ID format');
  }
  return id as TaskId;
}

// Now these are not interchangeable
function getTask(id: TaskId): Task { /* ... */ }

const taskId = createTaskId('task-123');
const contextId = 'ctx-456' as ContextId;

getTask(taskId); // ✅ OK
getTask(contextId); // ❌ Type error!
```

---

## Testing Practices

### Test Structure

```typescript
describe('TaskManager', () => {
  let taskManager: TaskManager;

  beforeEach(() => {
    taskManager = new TaskManager();
  });

  describe('createTask', () => {
    it('should create a task with submitted then working state', async () => {
      // Arrange
      const message = createTestMessage('Hello');
      const events: TaskUpdateEvent[] = [];
      taskManager.on('task:update', (event) => events.push(event));

      // Act
      const task = await taskManager.createTask(message);

      // Assert
      expect(task.id).toBeDefined();
      expect(task.status.state).toBe('working');
      expect(events).toHaveLength(2);
      expect(events[0].status.state).toBe('submitted');
      expect(events[1].status.state).toBe('working');
    });

    it('should throw TaskValidationError for invalid message', async () => {
      // Arrange
      const invalidMessage = { invalid: 'data' } as unknown as Message;

      // Act & Assert
      await expect(taskManager.createTask(invalidMessage))
        .rejects
        .toThrow(TaskValidationError);
    });
  });
});
```

### Test Helpers

```typescript
// Create reusable test utilities
export function createTestMessage(text: string, options?: Partial<Message>): Message {
  return {
    messageId: randomUUID(),
    role: 'user',
    parts: [{ kind: 'text', text }],
    ...options
  };
}

export async function waitFor(
  condition: () => boolean,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const timeout = options.timeout || 5000;
  const interval = options.interval || 100;
  const start = Date.now();

  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error('Timeout waiting for condition');
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
}
```

---

## Project-Specific Guidelines

### A2A Service Layer

- All public methods should return `Result<T, A2AError>` for operations that can fail
- Use event emitters for state changes (TaskManager)
- Always validate messages at entry points
- Use branded types for IDs (TaskId, ContextId, MessageId)

### Test Reporter Implementation

- Implement Observer pattern for test event handling
- Use Strategy pattern for different output formats
- Separate concerns: formatting, coloring, layout
- Make it easy to test (dependency injection for output streams)

### Error Handling Strategy

1. **At Boundaries:** Validate all inputs, return Result types
2. **Internal Methods:** Can throw exceptions, caught at boundary
3. **Async Operations:** Always wrap in try-catch, return Result
4. **Third-party Libraries:** Wrap errors in custom error types

### Performance Considerations

- Use `Set` for observer collections (O(1) lookups)
- Debounce expensive operations (like notifying observers)
- Use `Promise.all` for parallel operations
- Cache expensive computations

---

## Quick Reference Checklist

### Before Committing Code

- [ ] All public methods have explicit return types
- [ ] Error handling implemented (Result types or try-catch)
- [ ] Input validation at boundaries
- [ ] Tests written for new functionality
- [ ] No `any` types (use `unknown` instead)
- [ ] Async functions return `Promise<T>`
- [ ] Custom errors extend A2AError
- [ ] Documentation comments for public APIs
- [ ] No unused imports or variables
- [ ] Follows SOLID principles

### Code Review Checklist

- [ ] Error paths are tested
- [ ] Edge cases are handled
- [ ] No memory leaks (observers unsubscribed)
- [ ] Type guards used for runtime checks
- [ ] Branded types used for IDs
- [ ] Consistent with project patterns
- [ ] Performance considerations addressed

---

## References

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [SOLID Principles in TypeScript](https://blog.logrocket.com/applying-solid-principles-typescript/)
- [TypeScript Error Handling with Result Types](https://typescript.tv/best-practices/error-handling-with-result-types/)
- [Defensive Programming in TypeScript](https://claritydev.net/blog/typescript-error-handling-and-defensive-programming)
- [Observer Pattern in TypeScript](https://refactoring.guru/design-patterns/observer/typescript/example)

---

**Document Status:** Living document - update as patterns evolve
**Maintainers:** Development team
**Last Review:** 2025-11-14
