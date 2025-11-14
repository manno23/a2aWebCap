/**
 * Test Object Factories
 *
 * Utilities for creating test objects with sensible defaults
 */

import { randomUUID } from 'crypto';
import type {
  Message,
  Task,
  TaskState,
  Part,
  TextPart,
  FilePart,
  Artifact,
  AuthCredentials
} from '@a2a-webcap/shared';

/**
 * Create a test message with default values
 */
export function createTestMessage(
  text: string,
  overrides?: Partial<Message>
): Message {
  return {
    messageId: randomUUID(),
    role: 'user',
    parts: [{ kind: 'text', text }],
    ...overrides
  };
}

/**
 * Create a test message with multiple parts
 */
export function createTestMessageWithParts(
  parts: Part[],
  overrides?: Partial<Message>
): Message {
  return {
    messageId: randomUUID(),
    role: 'user',
    parts,
    ...overrides
  };
}

/**
 * Create a text part
 */
export function createTextPart(text: string): TextPart {
  return {
    kind: 'text',
    text
  };
}

/**
 * Create a file part
 */
export function createFilePart(
  name: string,
  content: string,
  mimeType: string = 'text/plain'
): FilePart {
  return {
    kind: 'file',
    file: {
      name,
      mimeType,
      bytes: Buffer.from(content).toString('base64')
    }
  };
}

/**
 * Create a test task with default values
 */
export function createTestTask(
  state: TaskState,
  overrides?: Partial<Task>
): Task {
  const taskId = randomUUID();
  const contextId = randomUUID();

  return {
    id: taskId,
    contextId,
    status: {
      state,
      timestamp: new Date().toISOString()
    },
    kind: 'task',
    ...overrides
  };
}

/**
 * Create a test artifact
 */
export function createTestArtifact(
  name: string,
  content: string,
  overrides?: Partial<Artifact>
): Artifact {
  return {
    artifactId: randomUUID(),
    name,
    parts: [createTextPart(content)],
    ...overrides
  };
}

/**
 * Create test auth credentials
 */
export function createTestAuthCredentials(
  type: 'bearer' | 'apikey' = 'bearer',
  token: string = 'test-token-123'
): AuthCredentials {
  return {
    type,
    token
  };
}

/**
 * Generate a random task ID
 */
export function randomTaskId(): string {
  return randomUUID();
}

/**
 * Generate a random context ID
 */
export function randomContextId(): string {
  return randomUUID();
}

/**
 * Create a batch of test messages
 */
export function createTestMessages(count: number, prefix: string = 'Test message'): Message[] {
  return Array.from({ length: count }, (_, i) =>
    createTestMessage(`${prefix} ${i + 1}`)
  );
}

/**
 * Wait helper for async tests
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: {
    timeout?: number;
    interval?: number;
    message?: string;
  } = {}
): Promise<void> {
  const { timeout = 5000, interval = 100, message = 'Condition not met' } = options;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await wait(interval);
  }

  throw new Error(`${message} (timeout: ${timeout}ms)`);
}
