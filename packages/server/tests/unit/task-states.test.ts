/**
 * Comprehensive Task State Tests
 *
 * Tests all 8 task states and state transitions according to A2A Protocol v0.4.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TaskManager } from '../../src/task-manager';
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
      expect(events[0].status.state).toBe(TaskState.Submitted);
      expect(events[1].status.state).toBe(TaskState.Working);
      expect(task.status.state).toBe(TaskState.Working);
    });

    it('should emit status update event when transitioning to working', async () => {
      const message = createTestMessage('Test');
      let workingEventReceived = false;

      taskManager.on('task:update', (event) => {
        if (event.status.state === TaskState.Working) {
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

      await taskManager.updateTaskStatus(task.id, TaskState.InputRequired);

      const updated = await taskManager.getTask(task.id);
      expect(updated.status.state).toBe(TaskState.InputRequired);
    });

    it('should emit update event for input-required', async () => {
      const message = createTestMessage('Test');
      const task = await taskManager.createTask(message);
      let inputRequiredReceived = false;

      taskManager.on('task:update', (event) => {
        if (event.status.state === TaskState.InputRequired) {
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
        TaskState.InputRequired,
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

      await taskManager.updateTaskStatus(task.id, TaskState.AuthRequired);

      const updated = await taskManager.getTask(task.id);
      expect(updated.status.state).toBe(TaskState.AuthRequired);
    });

    it('should emit update event for auth-required', async () => {
      const message = createTestMessage('Test');
      const task = await taskManager.createTask(message);
      let authRequiredReceived = false;

      taskManager.on('task:update', (event) => {
        if (event.status.state === TaskState.AuthRequired) {
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

      await taskManager.updateTaskStatus(task.id, TaskState.AuthRequired);
      await taskManager.updateTaskStatus(task.id, TaskState.Working);

      const updated = await taskManager.getTask(task.id);
      expect(updated.status.state).toBe(TaskState.Working);
    });
  });

  describe('State: Completed', () => {
    it('should transition to completed state', async () => {
      const message = createTestMessage('Test');
      const task = await taskManager.createTask(message);

      await taskManager.updateTaskStatus(task.id, TaskState.Completed);

      const updated = await taskManager.getTask(task.id);
      expect(updated.status.state).toBe(TaskState.Completed);
    });

    it('should emit update event for completed', async () => {
      const message = createTestMessage('Test');
      const task = await taskManager.createTask(message);
      let completedReceived = false;

      taskManager.on('task:update', (event) => {
        if (event.status.state === TaskState.Completed) {
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

      expect(canceled.status.state).toBe(TaskState.Canceled);
    });

    it('should emit update event for canceled', async () => {
      const message = createTestMessage('Test');
      const task = await taskManager.createTask(message);
      let canceledReceived = false;

      taskManager.on('task:update', (event) => {
        if (event.status.state === TaskState.Canceled) {
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

      await taskManager.updateTaskStatus(task.id, TaskState.Failed);

      const updated = await taskManager.getTask(task.id);
      expect(updated.status.state).toBe(TaskState.Failed);
    });

    it('should emit update event for failed', async () => {
      const message = createTestMessage('Test');
      const task = await taskManager.createTask(message);
      let failedReceived = false;

      taskManager.on('task:update', (event) => {
        if (event.status.state === TaskState.Failed) {
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
        TaskState.Failed,
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

      await taskManager.updateTaskStatus(task.id, TaskState.Rejected);

      const updated = await taskManager.getTask(task.id);
      expect(updated.status.state).toBe(TaskState.Rejected);
    });

    it('should emit update event for rejected', async () => {
      const message = createTestMessage('Test');
      const task = await taskManager.createTask(message);
      let rejectedReceived = false;

      taskManager.on('task:update', (event) => {
        if (event.status.state === TaskState.Rejected) {
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
        TaskState.Rejected,
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
      await taskManager.updateTaskStatus(task.id, TaskState.InputRequired);
      let updated = await taskManager.getTask(task.id);
      expect(updated.status.state).toBe(TaskState.InputRequired);

      // InputRequired -> Working
      await taskManager.updateTaskStatus(task.id, TaskState.Working);
      updated = await taskManager.getTask(task.id);
      expect(updated.status.state).toBe(TaskState.Working);

      // Working -> Completed
      await taskManager.updateTaskStatus(task.id, TaskState.Completed);
      updated = await taskManager.getTask(task.id);
      expect(updated.status.state).toBe(TaskState.Completed);
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
      await taskManager.updateTaskStatus(task.id, TaskState.InputRequired);
      await taskManager.updateTaskStatus(task.id, TaskState.Working);
      await taskManager.updateTaskStatus(task.id, TaskState.Completed);

      // Wait for all events (submitted, working, input-required, working, completed = 5)
      await waitFor(() => states.length >= 5, { timeout: 2000 });

      // Should have all expected states
      expect(states).toContain(TaskState.Submitted);
      expect(states).toContain(TaskState.Working);
      expect(states).toContain(TaskState.InputRequired);
      expect(states).toContain(TaskState.Completed);
      expect(states.length).toBeGreaterThanOrEqual(5);
    });

    it('should prevent transitions from final states', async () => {
      const finalStates = [
        TaskState.Completed,
        TaskState.Canceled,
        TaskState.Failed,
        TaskState.Rejected
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

      await taskManager.updateTaskStatus(task1.id, TaskState.Completed);
      await taskManager.updateTaskStatus(task2.id, TaskState.Failed);
      await taskManager.updateTaskStatus(task3.id, TaskState.InputRequired);
      // task4 stays in working

      // Filter for final states
      const finalTasks = await taskManager.listTasks({
        filter: {
          states: [
            TaskState.Completed,
            TaskState.Failed,
            TaskState.Canceled,
            TaskState.Rejected
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

      await taskManager.updateTaskStatus(task1.id, TaskState.Completed);
      await taskManager.updateTaskStatus(task2.id, TaskState.InputRequired);
      // task3 stays in working

      const activeTasks = await taskManager.listTasks({
        filter: {
          states: [TaskState.Working, TaskState.InputRequired]
        }
      });

      expect(activeTasks.tasks.length).toBe(2);
      expect(activeTasks.tasks.map(t => t.id).sort()).toEqual([task2.id, task3.id].sort());
    });
  });
});
