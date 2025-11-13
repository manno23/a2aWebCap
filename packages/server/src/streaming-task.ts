/**
 * StreamingTask - RpcTarget for task streaming
 *
 * Represents a streaming task that can push updates to registered callbacks.
 * This enables real-time bidirectional communication between server and client.
 */

import { RpcTarget } from 'capnweb';
import pino from 'pino';
import type { TaskManager, TaskUpdateEvent } from './task-manager';
import type { TaskUpdateCallback } from './task-update-callback';
import { TaskState, type Task, type StatusUpdateEvent, type ArtifactUpdateEvent } from '@a2a-webcap/shared';

const log = pino({ name: 'streaming-task' });

/**
 * StreamingTask represents a task with real-time update capabilities
 *
 * Key features:
 * - Multiple callbacks can subscribe to updates
 * - Automatically forwards TaskManager events to callbacks
 * - Handles callback errors gracefully
 * - Tracks whether task has reached final state
 */
export class StreamingTask extends RpcTarget {
  private callbacks = new Set<TaskUpdateCallback>();
  private unsubscribeHandler?: () => void;
  private isFinal = false;

  constructor(
    private task: Task,
    private taskManager: TaskManager
  ) {
    super();
    log.info('StreamingTask created', { taskId: task.id });
    this.startMonitoring();
  }

  /**
   * Subscribe a callback to receive updates
   *
   * @param callback - TaskUpdateCallback implementation
   */
  async subscribe(callback: TaskUpdateCallback): Promise<void> {
    log.info('Callback subscribed', { taskId: this.task.id });
    this.callbacks.add(callback);

    // Send current task state immediately
    await this.sendStatusUpdate({
      type: 'status',
      taskId: this.task.id,
      contextId: this.task.contextId,
      status: this.task.status,
      final: false
    });
  }

  /**
   * Unsubscribe a callback
   *
   * @param callback - Callback to remove
   */
  unsubscribeCallback(callback: TaskUpdateCallback): void {
    this.callbacks.delete(callback);
    log.info('Callback unsubscribed', {
      taskId: this.task.id,
      remainingCallbacks: this.callbacks.size
    });
  }

  /**
   * Get the current task state
   */
  async getTask(): Promise<Task> {
    return await this.taskManager.getTask(this.task.id);
  }

  /**
   * Check if task has reached final state
   */
  isFinalState(): boolean {
    return this.isFinal;
  }

  /**
   * Start monitoring task updates from TaskManager
   */
  private startMonitoring(): void {
    this.unsubscribeHandler = this.taskManager.onTaskUpdate(
      this.task.id,
      async (event: TaskUpdateEvent) => {
        log.debug('Task update received', {
          taskId: event.taskId,
          state: event.status.state
        });

        // Check if this is a final state
        const finalStates = [
          TaskState.Completed,
          TaskState.Canceled,
          TaskState.Failed,
          TaskState.Rejected
        ];
        const isFinal = finalStates.includes(event.status.state);

        // Send status update
        await this.sendStatusUpdate({
          type: 'status',
          taskId: event.taskId,
          contextId: this.task.contextId,
          status: event.status,
          final: isFinal
        });

        // Send artifact update if present
        if (event.artifact) {
          await this.sendArtifactUpdate({
            type: 'artifact',
            taskId: event.taskId,
            contextId: this.task.contextId,
            artifact: event.artifact
          });
        }

        // Mark as final if needed
        if (isFinal) {
          this.isFinal = true;
          this.stopMonitoring();
        }
      }
    );
  }

  /**
   * Stop monitoring task updates
   */
  private stopMonitoring(): void {
    if (this.unsubscribeHandler) {
      this.unsubscribeHandler();
      this.unsubscribeHandler = undefined;
      log.info('Stopped monitoring task', { taskId: this.task.id });
    }
  }

  /**
   * Send status update to all callbacks
   */
  private async sendStatusUpdate(event: StatusUpdateEvent): Promise<void> {
    const failedCallbacks: TaskUpdateCallback[] = [];

    for (const callback of this.callbacks) {
      try {
        await callback.onStatusUpdate(event);
      } catch (error) {
        log.error('Callback error in onStatusUpdate', {
          error,
          taskId: event.taskId
        });
        failedCallbacks.push(callback);
      }
    }

    // Remove failed callbacks
    for (const callback of failedCallbacks) {
      this.callbacks.delete(callback);
    }
  }

  /**
   * Send artifact update to all callbacks
   */
  private async sendArtifactUpdate(event: ArtifactUpdateEvent): Promise<void> {
    const failedCallbacks: TaskUpdateCallback[] = [];

    for (const callback of this.callbacks) {
      try {
        await callback.onArtifactUpdate(event);
      } catch (error) {
        log.error('Callback error in onArtifactUpdate', {
          error,
          taskId: event.taskId
        });
        failedCallbacks.push(callback);
      }
    }

    // Remove failed callbacks
    for (const callback of failedCallbacks) {
      this.callbacks.delete(callback);
    }
  }

  /**
   * Cleanup when disposing
   */
  dispose(): void {
    log.info('StreamingTask disposed', { taskId: this.task.id });
    this.stopMonitoring();
    this.callbacks.clear();
  }
}
