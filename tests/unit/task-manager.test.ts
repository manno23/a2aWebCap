/**
 * TaskManager Unit Tests
 *
 * Tests all task CRUD operations and state management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TaskManager } from '../../src/server/task-manager';
import { createTestMessage, waitFor } from '../utils';
import type { TaskState } from '@a2a-webcap/shared';

describe('TaskManager', () => {
  let taskManager: TaskManager;

  beforeEach(() => {
    taskManager = new TaskManager();
  });

  describe('createTask', () => {
    it('should create a task with submitted then working state', async () => {
      const message = createTestMessage('Hello, world!');
      const events: any[] = [];

      // Listen to task updates
      taskManager.on('task:update', (event) => {
        events.push(event);
      });

      const task = await taskManager.createTask(message);

      // Verify task structure
      expect(task.id).toBeDefined();
      expect(task.contextId).toBeDefined();
      expect(task.kind).toBe('task');
      expect(task.status.state).toBe('working');
      expect(task.history).toHaveLength(1);
      expect(task.history![0]).toEqual(message);

      // Verify events (submitted + working)
      await waitFor(() => events.length >= 2, { timeout: 1000 });
      expect(events).toHaveLength(2);
      expect(events[0].status.state).toBe('submitted');
      expect(events[1].status.state).toBe('working');
    });

    it('should use contextId from message if provided', async () => {
      const contextId = 'test-context-123';
      const message = createTestMessage('Test', { contextId });

      const task = await taskManager.createTask(message);

      expect(task.contextId).toBe(contextId);
    });

    it('should include metadata if provided', async () => {
      const message = createTestMessage('Test');
      const metadata = { custom: 'data' };

      const task = await taskManager.createTask(message, metadata);

      expect(task.metadata).toEqual(metadata);
    });
  });

  describe('getTask', () => {
    it('should retrieve a task by ID', async () => {
      const message = createTestMessage('Test');
      const created = await taskManager.createTask(message);

      const retrieved = await taskManager.getTask(created.id);

      expect(retrieved.id).toBe(created.id);
      expect(retrieved.contextId).toBe(created.contextId);
    });

    it('should throw error for non-existent task', async () => {
      await expect(
        taskManager.getTask('non-existent-id')
      ).rejects.toThrow('Task not found');
    });

    it('should limit history length if requested', async () => {
      const message = createTestMessage('Test');
      const task = await taskManager.createTask(message);

      // Add more messages to history
      for (let i = 0; i < 5; i++) {
        await taskManager.addMessageToHistory(
          task.id,
          createTestMessage(`Message ${i}`)
        );
      }

      const retrieved = await taskManager.getTask(task.id, 3);

      expect(retrieved.history).toHaveLength(3);
    });
  });

  describe('listTasks', () => {
    it('should list all tasks', async () => {
      // Create multiple tasks
      await taskManager.createTask(createTestMessage('Task 1'));
      await taskManager.createTask(createTestMessage('Task 2'));
      await taskManager.createTask(createTestMessage('Task 3'));

      const result = await taskManager.listTasks({});

      expect(result.tasks).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.hasMore).toBe(false);
    });

    it('should filter by contextId', async () => {
      const contextId = 'test-context';
      await taskManager.createTask(createTestMessage('Task 1', { contextId }));
      await taskManager.createTask(createTestMessage('Task 2', { contextId: 'other' }));
      await taskManager.createTask(createTestMessage('Task 3', { contextId }));

      const result = await taskManager.listTasks({ contextId });

      expect(result.tasks).toHaveLength(2);
      expect(result.tasks.every(t => t.contextId === contextId)).toBe(true);
    });

    it('should filter by task state', async () => {
      const task1 = await taskManager.createTask(createTestMessage('Task 1'));
      await taskManager.createTask(createTestMessage('Task 2'));
      await taskManager.updateTaskStatus(task1.id, 'completed');

      const result = await taskManager.listTasks({
        filter: { states: ['completed'] }
      });

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].status.state).toBe('completed');
    });

    it('should support pagination', async () => {
      // Create 10 tasks
      for (let i = 0; i < 10; i++) {
        await taskManager.createTask(createTestMessage(`Task ${i}`));
      }

      const page1 = await taskManager.listTasks({ limit: 5, offset: 0 });
      const page2 = await taskManager.listTasks({ limit: 5, offset: 5 });

      expect(page1.tasks).toHaveLength(5);
      expect(page1.hasMore).toBe(true);
      expect(page2.tasks).toHaveLength(5);
      expect(page2.hasMore).toBe(false);
    });
  });

  describe('cancelTask', () => {
    it('should cancel a working task', async () => {
      const message = createTestMessage('Test');
      const task = await taskManager.createTask(message);

      const canceled = await taskManager.cancelTask(task.id);

      expect(canceled.status.state).toBe('canceled');
    });

    it('should throw error when canceling completed task', async () => {
      const task = await taskManager.createTask(createTestMessage('Test'));
      await taskManager.updateTaskStatus(task.id, 'completed');

      await expect(
        taskManager.cancelTask(task.id)
      ).rejects.toThrow('Cannot cancel task');
    });

    it('should throw error for non-existent task', async () => {
      await expect(
        taskManager.cancelTask('non-existent-id')
      ).rejects.toThrow('Task not found');
    });
  });

  describe('updateTaskStatus', () => {
    it('should update task status', async () => {
      const task = await taskManager.createTask(createTestMessage('Test'));
      const states: TaskState[] = ['working', 'completed'];

      for (const state of states) {
        await taskManager.updateTaskStatus(task.id, state);
        const updated = await taskManager.getTask(task.id);
        expect(updated.status.state).toBe(state);
      }
    });

    it('should emit update event', async () => {
      const task = await taskManager.createTask(createTestMessage('Test'));
      let updateReceived = false;

      taskManager.on('task:update', (event) => {
        if (event.status.state === 'completed') {
          updateReceived = true;
        }
      });

      await taskManager.updateTaskStatus(task.id, 'completed');

      await waitFor(() => updateReceived, { timeout: 1000 });
      expect(updateReceived).toBe(true);
    });
  });

  describe('addArtifact', () => {
    it('should add artifact to task', async () => {
      const task = await taskManager.createTask(createTestMessage('Test'));
      const artifact = {
        artifactId: 'test-artifact',
        name: 'Test Artifact',
        parts: [{ kind: 'text' as const, text: 'Artifact content' }]
      };

      await taskManager.addArtifact(task.id, artifact);

      const updated = await taskManager.getTask(task.id);
      expect(updated.artifacts).toHaveLength(1);
      expect(updated.artifacts![0]).toEqual(artifact);
    });

    it('should emit artifact update event', async () => {
      const task = await taskManager.createTask(createTestMessage('Test'));
      const artifact = {
        artifactId: 'test-artifact',
        parts: [{ kind: 'text' as const, text: 'Content' }]
      };

      let artifactReceived = false;
      taskManager.on('task:update', (event) => {
        if (event.artifact) {
          artifactReceived = true;
        }
      });

      await taskManager.addArtifact(task.id, artifact);

      await waitFor(() => artifactReceived, { timeout: 1000 });
      expect(artifactReceived).toBe(true);
    });
  });

  describe('onTaskUpdate', () => {
    it('should subscribe to specific task updates', async () => {
      const task = await taskManager.createTask(createTestMessage('Test'));
      const updates: any[] = [];

      const unsubscribe = taskManager.onTaskUpdate(task.id, (event) => {
        updates.push(event);
      });

      await taskManager.updateTaskStatus(task.id, 'completed');

      await waitFor(() => updates.length > 0, { timeout: 1000 });
      expect(updates.length).toBeGreaterThan(0);
      expect(updates[0].taskId).toBe(task.id);

      // Test unsubscribe
      unsubscribe();
      const updateCount = updates.length;
      await taskManager.updateTaskStatus(task.id, 'working');

      // Should not receive new updates after unsubscribe
      expect(updates.length).toBe(updateCount);
    });
  });

  describe('getTaskCount', () => {
    it('should return correct task count', async () => {
      expect(taskManager.getTaskCount()).toBe(0);

      await taskManager.createTask(createTestMessage('Task 1'));
      expect(taskManager.getTaskCount()).toBe(1);

      await taskManager.createTask(createTestMessage('Task 2'));
      expect(taskManager.getTaskCount()).toBe(2);
    });
  });

  describe('clearAllTasks', () => {
    it('should remove all tasks', async () => {
      await taskManager.createTask(createTestMessage('Task 1'));
      await taskManager.createTask(createTestMessage('Task 2'));

      taskManager.clearAllTasks();

      expect(taskManager.getTaskCount()).toBe(0);
    });
  });
});
