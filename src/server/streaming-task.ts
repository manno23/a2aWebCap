/**
 * StreamingTask - RpcTarget for task streaming
 *
 * Represents a streaming task that can push updates to registered callbacks.
 * This enables real-time bidirectional communication between server and client.
 */


import { createLogger } from '../shared/logger.js';
import type { TaskManager, TaskUpdateEvent } from './task-manager.js';
import type { TaskUpdateCallback } from './task-update-callback.js';
import { TaskState } from '../shared/a2a.types.js';
import type { Task, TaskStatusUpdateEvent, TaskArtifactUpdateEvent } from '../shared/a2a.types.js';

const log = createLogger('streaming-task');

/**
 * StreamingTask represents a task with real-time update capabilities
 *
 * Key features:
 * - Multiple callbacks can subscribe to updates
 * - Automatically forwards TaskManager events to callbacks
 * - Handles callback errors gracefully
 * - Tracks whether task has reached final state
 */
export class StreamingTask {
  private callbacks = new Set<any>();
  private unsubscribeHandler?: () => void;
  private isFinal = false;
  private monitoringStarted = false;
  private timeoutHandle?: NodeJS.Timeout;
  private readonly MONITORING_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour

  constructor(
    private task: Task,
    private taskManager: TaskManager
  ) {
    // super();
    log.info({ taskId: task.id }, 'StreamingTask created');
    // Don't start monitoring immediately to avoid race condition where
    // early task updates could be missed before callbacks subscribe
  }

  /**
   * Subscribe a callback to receive updates
   *
   * @param callback - TaskUpdateCallback implementation
   */
  async subscribe(callback: any): Promise<void> {
    log.info({ taskId: this.task.id }, 'Callback subscribed');
    this.callbacks.add(callback);

    // Start monitoring on first subscription to avoid race condition
    if (!this.monitoringStarted) {
      this.startMonitoring();
      this.monitoringStarted = true;
    }

    // Fetch fresh task state from TaskManager to avoid sending stale cached state
    const currentTask = await this.taskManager.getTask(this.task.id);

    // Check if task is already in final state (for late subscribers)
    const isFinal = currentTask.status ? this.isFinalTaskState(currentTask.status.state) : false;

    // Send current task state immediately with correct final flag
    await this.sendStatusUpdate({
      taskId: currentTask.id,
      contextId: currentTask.contextId,
      status: currentTask.status,
      final: isFinal,
      metadata: {}
    });
  }

  /**
   * Unsubscribe a callback
   *
   * @param callback - Callback to remove
   */
  unsubscribeCallback(callback: any): void {
    this.callbacks.delete(callback);
    log.info({ taskId: this.task.id, remainingCallbacks: this.callbacks.size }, 'Callback unsubscribed');
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
   * Check if a task state is a final state
   *
   * Final states are: Completed, Canceled, Failed, Rejected
   * Note: InputRequired and AuthRequired are NOT final states - they indicate
   * the task is waiting for input/auth and can continue after receiving it.
   */
  private isFinalTaskState(state: TaskState): boolean {
    const finalStates = [
      TaskState.TASK_STATE_COMPLETED,
      TaskState.TASK_STATE_CANCELLED,
      TaskState.TASK_STATE_FAILED,
      TaskState.TASK_STATE_REJECTED
    ];
    return finalStates.includes(state);
  }

  /**
   * Start monitoring task updates from TaskManager
   */
  private startMonitoring(): void {
    this.unsubscribeHandler = this.taskManager.onTaskUpdate(
      this.task.id,
      async (event: TaskUpdateEvent) => {
        log.debug({
          taskId: event.taskId,
          state: event.status.state
        }, 'Task update');

        // Check if this is a final state
        const isFinal = this.isFinalTaskState(event.status.state);

        // Send status update
        await this.sendStatusUpdate({
          taskId: event.taskId,
          contextId: this.task.contextId,
          status: event.status,
          final: isFinal,
          metadata: {}
        });

        // Send artifact update if present
        if (event.artifact) {
          await this.sendArtifactUpdate({
            taskId: event.taskId,
            contextId: this.task.contextId,
            artifact: event.artifact,
            append: false,
            lastChunk: true,
            metadata: {}
          });
        }

        // Mark as final if needed
        if (isFinal) {
          this.isFinal = true;
          this.stopMonitoring();
        }
      }
    );

    // Set up timeout to prevent memory leaks from tasks that never complete
    this.timeoutHandle = setTimeout(() => {
      log.warn({ taskId: this.task.id, timeoutMs: this.MONITORING_TIMEOUT_MS }, 'Task monitoring timeout reached - forcing cleanup');
      this.stopMonitoring();
    }, this.MONITORING_TIMEOUT_MS);
  }

  /**
   * Stop monitoring task updates
   */
  private stopMonitoring(): void {
    if (this.unsubscribeHandler) {
      this.unsubscribeHandler();
      this.unsubscribeHandler = undefined;
      log.info({ taskId: this.task.id }, 'Stopped monitoring task');
    }

    // Clear timeout to prevent memory leak
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = undefined;
    }
  }

  /**
   * Send status update to all callbacks
   */
  private async sendStatusUpdate(event: TaskStatusUpdateEvent): Promise<void> {
    const failedCallbacks: TaskUpdateCallback[] = [];

    for (const callback of this.callbacks) {
      try {
        await callback.onStatusUpdate(event);
      } catch (error) {
        log.error({ error, taskId: event.taskId }, 'Callback error in onStatusUpdate');
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
  private async sendArtifactUpdate(event: TaskArtifactUpdateEvent): Promise<void> {
    const failedCallbacks: TaskUpdateCallback[] = [];

    for (const callback of this.callbacks) {
      try {
        await callback.onArtifactUpdate(event);
      } catch (error) {
        log.error({ error, taskId: event.taskId }, 'Callback error in onArtifactUpdate');
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
    log.info({ taskId: this.task.id }, 'StreamingTask disposed');
    this.stopMonitoring();
    this.callbacks.clear();
  }
}
