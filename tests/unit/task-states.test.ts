/**
 * Comprehensive Task State Tests
 *
 * Tests all 8 task states and state transitions according to A2A Protocol v0.4.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TaskManager } from '../../src/server/task-manager';
import { TaskState } from '@a2a-webcap/shared';
import { createTestMessage, waitFor } from '../utils';

describe('Task States - Comprehensive Coverage', () => {
  let taskManager: TaskManager;

  beforeEach(() => {
    taskManager = new TaskManager();
  });

  describe('State: Submitted', () => {
    it('should start in submitted state', async () => {
      const message = createTestMessage('Test');
      const events: any[] = [];

      taskManager.on('task:update', (event) => {
        events.push(event);
      });

      await taskManager.createTask(message);

      // First event should be submitted
      await waitFor(() => events.length >= 1, { timeout: 1000 });
      expect(events[0].status.state).toBe(TaskState.Submitted);
    });

    it('should include timestamp in submitted state', async () => {
      const message = createTestMessage('Test');
      const events: any[] = [];

      taskManager.on('task:update', (event) => {
        events.push(event);
      });

      await taskManager.createTask(message);

      await waitFor(() => events.length >= 1, { timeout: 1000 });
      expect(events[0].status.timestamp).toBeDefined();
      expect(new Date(events[0].status.timestamp).getTime()).toBeGreaterThan(0);
    });
  });

  describe('State: Working', () => {
    it('should transition from submitted to working automatically', async () => {
      const message = createTestMessage('Test');
      const events: any[] = [];

      taskManager.on('task:update', (event) => {
        events.push(event);
      });

      const task = await taskManager.createTask(message);

      // Should have both submitted and working states
      await waitFor(() => events.length >= 2, { timeout: 1000 });
      expect(events[0].status.state).toBe('submitted');
      expect(events[1].status.state).toBe('working');
      expect(task.status.state).toBe('working');
    });

    it('should emit status update event when transitioning to working', async () => {
      const message = createTestMessage('Test');
      let workingEventReceived = false;

      taskManager.on('task:update', (event) => {
        if (event.status.state === 'working') {
          workingEventReceived = true;
        }
      });

      await taskManager.createTask(message);

      await waitFor(() => workingEventReceived, { timeout: 1000 });
      expect(workingEventReceived).toBe(true);
    });
  });

  describe('State: InputRequired', () => {
    it('should transition to input-required state', async () => {
      const message = createTestMessage('Test');
      const task = await taskManager.createTask(message);

      await taskManager.updateTaskStatus(task.id, 'input-required');

      const updated = await taskManager.getTask(task.id);
      expect(updated.status.state).toBe('input-required');
    });

    it('should emit update event for input-required', async () => {
      const message = createTestMessage('Test');
      const task = await taskManager.createTask(message);
      let inputRequiredReceived = false;

      taskManager.on('task:update', (event) => {
        if (event.status.state === 'input-required') {
          inputRequiredReceived = true;
        }
      });

      await taskManager.updateTaskStatus(task.id, TaskState.InputRequired);

      await waitFor(() => inputRequiredReceived, { timeout: 1000 });
      expect(inputRequiredReceived).toBe(true);
    });

    it('should allow message in input-required status', async () => {
      const message = createTestMessage('Test');
      const task = await taskManager.createTask(message);
      const statusMessage = createTestMessage('Please provide input', {
        role: 'agent'
      });

      await taskManager.updateTaskStatus(
        task.id,
        'input-required',
        statusMessage
      );

      const updated = await taskManager.getTask(task.id);
      expect(updated.status.message).toEqual(statusMessage);
    });
  });

  describe('State: AuthRequired', () => {
    it('should transition to auth-required state', async () => {
      const message = createTestMessage('Test');
      const task = await taskManager.createTask(message);

      await taskManager.updateTaskStatus(task.id, 'auth-required');

      const updated = await taskManager.getTask(task.id);
      expect(updated.status.state).toBe('auth-required');
    });

    it('should emit update event for auth-required', async () => {
      const message = createTestMessage('Test');
      const task = await taskManager.createTask(message);
      let authRequiredReceived = false;

      taskManager.on('task:update', (event) => {
        if (event.status.state === 'auth-required') {
          authRequiredReceived = true;
        }
      });

      await taskManager.updateTaskStatus(task.id, TaskState.AuthRequired);

      await waitFor(() => authRequiredReceived, { timeout: 1000 });
      expect(authRequiredReceived).toBe(true);
    });

    it('should allow returning to working from auth-required', async () => {
      const message = createTestMessage('Test');
      const task = await taskManager.createTask(message);

      await taskManager.updateTaskStatus(task.id, 'auth-required');
      await taskManager.updateTaskStatus(task.id, 'working');

      const updated = await taskManager.getTask(task.id);
      expect(updated.status.state).toBe('working');
    });
  });

  describe('State: Completed', () => {
    it('should transition to completed state', async () => {
      const message = createTestMessage('Test');
      const task = await taskManager.createTask(message);

      await taskManager.updateTaskStatus(task.id, 'completed');

      const updated = await taskManager.getTask(task.id);
      expect(updated.status.state).toBe('completed');
    });

    it('should emit update event for completed', async () => {
      const message = createTestMessage('Test');
      const task = await taskManager.createTask(message);
      let completedReceived = false;

      taskManager.on('task:update', (event) => {
        if (event.status.state === 'completed') {
          completedReceived = true;
        }
      });

      await taskManager.updateTaskStatus(task.id, TaskState.Completed);

      await waitFor(() => completedReceived, { timeout: 1000 });
      expect(completedReceived).toBe(true);
    });

    it('should be a final state (cannot cancel)', async () => {
      const message = createTestMessage('Test');
      const task = await taskManager.createTask(message);

      await taskManager.updateTaskStatus(task.id, TaskState.Completed);

      await expect(
        taskManager.cancelTask(task.id)
      ).rejects.toThrow('Cannot cancel task');
    });
  });

  describe('State: Canceled', () => {
    it('should transition to canceled state', async () => {
      const message = createTestMessage('Test');
      const task = await taskManager.createTask(message);

      const canceled = await taskManager.cancelTask(task.id);

      expect(canceled.status.state).toBe('canceled');
    });

    it('should emit update event for canceled', async () => {
      const message = createTestMessage('Test');
      const task = await taskManager.createTask(message);
      let canceledReceived = false;

      taskManager.on('task:update', (event) => {
        if (event.status.state === 'canceled') {
          canceledReceived = true;
        }
      });

      await taskManager.cancelTask(task.id);

      await waitFor(() => canceledReceived, { timeout: 1000 });
      expect(canceledReceived).toBe(true);
    });

    it('should be a final state', async () => {
      const message = createTestMessage('Test');
      const task = await taskManager.createTask(message);

      await taskManager.cancelTask(task.id);

      await expect(
        taskManager.cancelTask(task.id)
      ).rejects.toThrow('Cannot cancel task');
    });
  });

  describe('State: Failed', () => {
    it('should transition to failed state', async () => {
      const message = createTestMessage('Test');
      const task = await taskManager.createTask(message);

      await taskManager.updateTaskStatus(task.id, 'failed');

      const updated = await taskManager.getTask(task.id);
      expect(updated.status.state).toBe('failed');
    });

    it('should emit update event for failed', async () => {
      const message = createTestMessage('Test');
      const task = await taskManager.createTask(message);
      let failedReceived = false;

      taskManager.on('task:update', (event) => {
        if (event.status.state === 'failed') {
          failedReceived = true;
        }
      });

      await taskManager.updateTaskStatus(task.id, TaskState.Failed);

      await waitFor(() => failedReceived, { timeout: 1000 });
      expect(failedReceived).toBe(true);
    });

    it('should be a final state (cannot cancel)', async () => {
      const message = createTestMessage('Test');
      const task = await taskManager.createTask(message);

      await taskManager.updateTaskStatus(task.id, TaskState.Failed);

      await expect(
        taskManager.cancelTask(task.id)
      ).rejects.toThrow('Cannot cancel task');
    });

    it('should allow error message in failed status', async () => {
      const message = createTestMessage('Test');
      const task = await taskManager.createTask(message);
      const errorMessage = createTestMessage('Error occurred', {
        role: 'agent'
      });

      await taskManager.updateTaskStatus(
        task.id,
        'failed',
        errorMessage
      );

      const updated = await taskManager.getTask(task.id);
      expect(updated.status.message).toEqual(errorMessage);
    });
  });

  describe('State: Rejected', () => {
    it('should transition to rejected state', async () => {
      const message = createTestMessage('Test');
      const task = await taskManager.createTask(message);

      await taskManager.updateTaskStatus(task.id, 'rejected');

      const updated = await taskManager.getTask(task.id);
      expect(updated.status.state).toBe('rejected');
    });

    it('should emit update event for rejected', async () => {
      const message = createTestMessage('Test');
      const task = await taskManager.createTask(message);
      let rejectedReceived = false;

      taskManager.on('task:update', (event) => {
        if (event.status.state === 'rejected') {
          rejectedReceived = true;
        }
      });

      await taskManager.updateTaskStatus(task.id, TaskState.Rejected);

      await waitFor(() => rejectedReceived, { timeout: 1000 });
      expect(rejectedReceived).toBe(true);
    });

    it('should be a final state (cannot cancel)', async () => {
      const message = createTestMessage('Test');
      const task = await taskManager.createTask(message);

      await taskManager.updateTaskStatus(task.id, TaskState.Rejected);

      await expect(
        taskManager.cancelTask(task.id)
      ).rejects.toThrow('Cannot cancel task');
    });

    it('should allow rejection reason in rejected status', async () => {
      const message = createTestMessage('Test');
      const task = await taskManager.createTask(message);
      const rejectionMessage = createTestMessage('Request rejected: inappropriate content', {
        role: 'agent'
      });

      await taskManager.updateTaskStatus(
        task.id,
        'rejected',
        rejectionMessage
      );

      const updated = await taskManager.getTask(task.id);
      expect(updated.status.message).toEqual(rejectionMessage);
    });
  });

  describe('State Transitions', () => {
    it('should support valid state transitions', async () => {
      const message = createTestMessage('Test');
      const task = await taskManager.createTask(message);

      // Working -> InputRequired
      await taskManager.updateTaskStatus(task.id, 'input-required');
      let updated = await taskManager.getTask(task.id);
      expect(updated.status.state).toBe('input-required');

      // InputRequired -> Working
      await taskManager.updateTaskStatus(task.id, 'working');
      updated = await taskManager.getTask(task.id);
      expect(updated.status.state).toBe('working');

      // Working -> Completed
      await taskManager.updateTaskStatus(task.id, 'completed');
      updated = await taskManager.getTask(task.id);
      expect(updated.status.state).toBe('completed');
    });

    it('should track all state transitions via events', async () => {
      const message = createTestMessage('Test');
      const states: TaskState[] = [];

      // Start listening before creating task to catch all events
      taskManager.on('task:update', (event) => {
        states.push(event.status.state);
      });

      const task = await taskManager.createTask(message);

      // Wait for initial transitions (submitted -> working)
      await waitFor(() => states.length >= 2, { timeout: 1000 });

      // Now do additional transitions
      await taskManager.updateTaskStatus(task.id, 'input-required');
      await taskManager.updateTaskStatus(task.id, 'working');
      await taskManager.updateTaskStatus(task.id, 'completed');

      // Wait for all events (submitted, working, input-required, working, completed = 5)
      await waitFor(() => states.length >= 5, { timeout: 2000 });

      // Should have all expected states
      expect(states).toContain('submitted');
      expect(states).toContain('working');
      expect(states).toContain('input-required');
      expect(states).toContain('completed');
      expect(states.length).toBeGreaterThanOrEqual(5);
    });

    it('should prevent transitions from final states', async () => {
      const finalStates: TaskState[] = [
        'completed',
        'canceled',
        'failed',
        'rejected'
      ];

      for (const finalState of finalStates) {
        const message = createTestMessage(`Test ${finalState}`);
        const task = await taskManager.createTask(message);

        await taskManager.updateTaskStatus(task.id, finalState);

        await expect(
          taskManager.cancelTask(task.id)
        ).rejects.toThrow('Cannot cancel task');
      }
    });
  });

  describe('State Filtering', () => {
    it('should filter tasks by multiple states', async () => {
      // Create tasks in different states
      const task1 = await taskManager.createTask(createTestMessage('Task 1'));
      const task2 = await taskManager.createTask(createTestMessage('Task 2'));
      const task3 = await taskManager.createTask(createTestMessage('Task 3'));
      await taskManager.createTask(createTestMessage('Task 4'));

      await taskManager.updateTaskStatus(task1.id, 'completed');
      await taskManager.updateTaskStatus(task2.id, 'failed');
      await taskManager.updateTaskStatus(task3.id, 'input-required');
      // task4 stays in working

      // Filter for final states
      const finalTasks = await taskManager.listTasks({
        filter: {
          states: [
            'completed',
            'failed',
            'canceled',
            'rejected'
          ]
        }
      });

      expect(finalTasks.tasks.length).toBe(2);
      expect(finalTasks.tasks.map(t => t.id).sort()).toEqual([task1.id, task2.id].sort());
    });

    it('should filter tasks by active states', async () => {
      const task1 = await taskManager.createTask(createTestMessage('Task 1'));
      const task2 = await taskManager.createTask(createTestMessage('Task 2'));
      const task3 = await taskManager.createTask(createTestMessage('Task 3'));

      await taskManager.updateTaskStatus(task1.id, 'completed');
      await taskManager.updateTaskStatus(task2.id, 'input-required');
      // task3 stays in working

      const activeTasks = await taskManager.listTasks({
        filter: {
          states: ['working', 'input-required']
        }
      });

      expect(activeTasks.tasks.length).toBe(2);
      expect(activeTasks.tasks.map(t => t.id).sort()).toEqual([task2.id, task3.id].sort());
    });
  });
});
