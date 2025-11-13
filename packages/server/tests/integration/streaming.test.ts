/**
 * Streaming Integration Tests
 *
 * Tests the streaming functionality with StreamingTask and callbacks
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { A2AService } from '../../src/a2a-service';
import { TaskUpdateCallback } from '../../src/task-update-callback';
import { createTestMessage, wait } from '../utils';
import type { StatusUpdateEvent, ArtifactUpdateEvent } from '@a2a-webcap/shared';

/**
 * Test callback that collects events
 */
class TestCallback extends TaskUpdateCallback {
  public statusUpdates: StatusUpdateEvent[] = [];
  public artifactUpdates: ArtifactUpdateEvent[] = [];

  async onStatusUpdate(event: StatusUpdateEvent): Promise<void> {
    this.statusUpdates.push(event);
  }

  async onArtifactUpdate(event: ArtifactUpdateEvent): Promise<void> {
    this.artifactUpdates.push(event);
  }

  reset(): void {
    this.statusUpdates = [];
    this.artifactUpdates = [];
  }

  waitForFinal(timeoutMs: number = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      const checkInterval = 100;
      let elapsed = 0;

      const interval = setInterval(() => {
        const hasFinal = this.statusUpdates.some(e => e.final === true);
        if (hasFinal) {
          clearInterval(interval);
          resolve();
          return;
        }

        elapsed += checkInterval;
        if (elapsed >= timeoutMs) {
          clearInterval(interval);
          reject(new Error('Timeout waiting for final event'));
        }
      }, checkInterval);
    });
  }
}

describe('Streaming Integration', () => {
  let service: A2AService;
  let callback: TestCallback;

  beforeEach(() => {
    service = new A2AService({
      agentName: 'Test Streaming Agent',
      agentUrl: 'http://localhost:8080'
    });
    callback = new TestCallback();
  });

  describe('sendMessageStreaming', () => {
    it('should create streaming task and receive updates', async () => {
      const message = createTestMessage('Hello, streaming!');

      const streamingTask = await service.sendMessageStreaming(message, undefined, callback);

      expect(streamingTask).toBeDefined();

      // Wait for final event
      await callback.waitForFinal();

      // Verify we received status updates
      expect(callback.statusUpdates.length).toBeGreaterThan(0);

      // Verify we got working state (submitted happens before callback subscription)
      const states = callback.statusUpdates.map(e => e.status.state);
      expect(states).toContain('working');

      // Verify final event
      const finalEvents = callback.statusUpdates.filter(e => e.final === true);
      expect(finalEvents.length).toBe(1);
      expect(finalEvents[0].status.state).toBe('completed');
    });

    it('should send updates to multiple callbacks', async () => {
      const message = createTestMessage('Test multiple callbacks');
      const callback2 = new TestCallback();

      const streamingTask = await service.sendMessageStreaming(message, undefined, callback);

      // Subscribe second callback
      await streamingTask.subscribe(callback2);

      // Wait for completion
      await callback.waitForFinal();
      await callback2.waitForFinal();

      // Both callbacks should receive updates
      expect(callback.statusUpdates.length).toBeGreaterThan(0);
      expect(callback2.statusUpdates.length).toBeGreaterThan(0);

      // Both should have final events
      expect(callback.statusUpdates.some(e => e.final)).toBe(true);
      expect(callback2.statusUpdates.some(e => e.final)).toBe(true);
    });

    it('should work without callback', async () => {
      const message = createTestMessage('No callback test');

      const streamingTask = await service.sendMessageStreaming(message);

      expect(streamingTask).toBeDefined();

      // Wait for processing
      await wait(200);

      // Should be able to get task state
      const task = await streamingTask.getTask();
      expect(task).toBeDefined();
      expect(task.status.state).toBe('completed');
    });

    it('should handle task state transitions correctly', async () => {
      const message = createTestMessage('State transitions test');

      await service.sendMessageStreaming(message, undefined, callback);

      await callback.waitForFinal();

      // Verify we received updates
      expect(callback.statusUpdates.length).toBeGreaterThan(0);

      // First event callback sees is working (submitted happens before subscription)
      const states = callback.statusUpdates.map(e => e.status.state);
      expect(states[0]).toBe('working');

      // Final state should be last
      const finalEvent = callback.statusUpdates[callback.statusUpdates.length - 1];
      expect(finalEvent.final).toBe(true);
      expect(['completed', 'failed', 'canceled']).toContain(finalEvent.status.state);
    });

    it('should propagate context and task IDs correctly', async () => {
      const contextId = 'test-context-123';
      const message = createTestMessage('Context test', { contextId });

      await service.sendMessageStreaming(message, undefined, callback);

      await callback.waitForFinal();

      // All events should have the same contextId
      for (const event of callback.statusUpdates) {
        expect(event.contextId).toBe(contextId);
      }

      // All events should have the same taskId
      const taskIds = callback.statusUpdates.map(e => e.taskId);
      const uniqueTaskIds = [...new Set(taskIds)];
      expect(uniqueTaskIds.length).toBe(1);
    });

    it('should get current task from streaming task', async () => {
      const message = createTestMessage('Get task test');

      const streamingTask = await service.sendMessageStreaming(message);

      // Get task - may be 'submitted' or 'working' due to async processing
      // Retry until we see 'working' state
      let task1 = await streamingTask.getTask();
      const maxRetries = 10;
      let retries = 0;
      while (task1.status.state === 'submitted' && retries < maxRetries) {
        await wait(20);
        task1 = await streamingTask.getTask();
        retries++;
      }
      expect(task1.status.state).toBe('working');

      // Wait for completion
      await wait(200);

      // Get task again
      const task2 = await streamingTask.getTask();
      expect(task2.status.state).toBe('completed');
    });

    it('should handle callback errors gracefully', async () => {
      // Create a callback that throws
      class ErrorCallback extends TaskUpdateCallback {
        async onStatusUpdate(event: StatusUpdateEvent): Promise<void> {
          throw new Error('Intentional test error');
        }

        async onArtifactUpdate(event: ArtifactUpdateEvent): Promise<void> {
          throw new Error('Intentional test error');
        }
      }

      const errorCallback = new ErrorCallback();
      const message = createTestMessage('Error callback test');

      // Should not throw even though callback errors
      const streamingTask = await service.sendMessageStreaming(message, undefined, errorCallback);

      expect(streamingTask).toBeDefined();

      // Wait for processing
      await wait(200);

      // Task should still complete
      const task = await streamingTask.getTask();
      expect(task.status.state).toBe('completed');
    });

    it('should support unsubscribing callbacks', async () => {
      const message = createTestMessage('Unsubscribe test');

      const streamingTask = await service.sendMessageStreaming(message);

      // Subscribe callback
      await streamingTask.subscribe(callback);

      // Wait a bit to get some updates
      await wait(50);

      const updateCount1 = callback.statusUpdates.length;

      // Unsubscribe
      streamingTask.unsubscribeCallback(callback);

      // Wait more
      await wait(200);

      const updateCount2 = callback.statusUpdates.length;

      // Should not have received more updates after unsubscribe
      expect(updateCount2).toBe(updateCount1);
    });

    it('should report final state correctly', async () => {
      const message = createTestMessage('Final state test');

      const streamingTask = await service.sendMessageStreaming(message, undefined, callback);

      // Initially not final
      expect(streamingTask.isFinalState()).toBe(false);

      // Wait for completion
      await callback.waitForFinal();

      // Now should be final
      expect(streamingTask.isFinalState()).toBe(true);
    });
  });

  describe('Protocol Invariants', () => {
    it('should enforce streaming starts from working state', async () => {
      const message = createTestMessage('Streaming state test');

      await service.sendMessageStreaming(message, undefined, callback);

      await callback.waitForFinal();

      // Callback subscribes after task creation, so first state it sees is working
      expect(callback.statusUpdates.length).toBeGreaterThan(0);
      expect(callback.statusUpdates[0].status.state).toBe('working');
    });

    it('should progress from working to final state', async () => {
      const message = createTestMessage('State progression test');

      await service.sendMessageStreaming(message, undefined, callback);

      await callback.waitForFinal();

      // Should have at least working and final state
      expect(callback.statusUpdates.length).toBeGreaterThanOrEqual(2);

      const states = callback.statusUpdates.map(e => e.status.state);
      expect(states[0]).toBe('working');

      const lastState = states[states.length - 1];
      expect(['completed', 'failed', 'canceled', 'rejected']).toContain(lastState);
    });

    it('should enforce Invariant 3: Exactly one final event', async () => {
      const message = createTestMessage('Invariant 3 test');

      await service.sendMessageStreaming(message, undefined, callback);

      await callback.waitForFinal();

      const finalEvents = callback.statusUpdates.filter(e => e.final === true);
      expect(finalEvents.length).toBe(1);
    });

    it('should enforce Invariant 4: Final event is last', async () => {
      const message = createTestMessage('Invariant 4 test');

      await service.sendMessageStreaming(message, undefined, callback);

      await callback.waitForFinal();

      const lastEvent = callback.statusUpdates[callback.statusUpdates.length - 1];
      expect(lastEvent.final).toBe(true);
    });

    it('should enforce Invariant 5: Consistent ID propagation', async () => {
      const message = createTestMessage('Invariant 5 test');

      await service.sendMessageStreaming(message, undefined, callback);

      await callback.waitForFinal();

      // All events should have same taskId and contextId
      const taskIds = new Set(callback.statusUpdates.map(e => e.taskId));
      const contextIds = new Set(callback.statusUpdates.map(e => e.contextId));

      expect(taskIds.size).toBe(1);
      expect(contextIds.size).toBe(1);
    });
  });
});
