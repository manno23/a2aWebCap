/**
 * TaskManager - Core task state management
 *
 * Handles all task CRUD operations, state transitions, and update notifications.
 * Uses in-memory storage for MVP (can be replaced with database later).
 */

import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';

import type {
  Task,
  Message,
  TaskStatus,
  TaskState,
  Artifact,
  ToolCall,
  AuthResult,
  A2AError,
  A2AErrorCode
} from '../shared/a2a.types.ts';


export interface TaskUpdateEvent {
  taskId: string;
  status: TaskStatus;
  artifact?: Artifact;
}

/**
 * TaskManager handles all task lifecycle operations
 */
export class TaskManager extends EventEmitter {
  private tasks = new Map<string, Task>();

  constructor() {
    super();
  }

  /**
   * Create a new task from a message
   *
   * Protocol invariants enforced:
   * 1. Task starts in 'submitted' state
   * 2. Immediately transitions to 'working' state
   * 3. Emits status update events
   */
  async createTask(message: Message, metadata?: Record<string, any>): Promise<Task> {
    const taskId = randomUUID();
    const contextId = message.contextId || randomUUID();

    // Create task in 'submitted' state (Protocol Invariant 1)
    const task: Task = {
      id: taskId,
      contextId,
      status: {
        state: 'submitted',
        timestamp: new Date().toISOString()
      },
      history: [message],
      artifacts: [],
      toolCalls: [], // Initialize toolCalls
      metadata: metadata || {},
      kind: 'task'
    };

    this.tasks.set(taskId, task);

    // Emit initial status update
    this.emit('task:update', {
      taskId: task.id,
      status: task.status
    } as TaskUpdateEvent);

    // Immediately transition to 'working' (Protocol Invariant 2)
    await this.updateTaskStatus(taskId, 'working');

    return task;
  }

  /**
   * Get a task by ID
   *
   * @param taskId - Task ID to retrieve
   * @param historyLength - Optional limit on history length
   * @throws A2AError if task not found
   */
  async getTask(taskId: string, historyLength?: number): Promise<Task> {
    const task = this.tasks.get(taskId);

    if (!task) {
      throw this.createError(
        `Task not found: ${taskId}`,
        'TASK_NOT_FOUND' as A2AErrorCode
      );
    }

    // Clone task to prevent external mutations
    const taskCopy = { ...task };

    // Limit history if requested
    if (historyLength && task.history && task.history.length > historyLength) {
      taskCopy.history = task.history.slice(-historyLength);
    }

    return taskCopy;
  }

  /**
   * List tasks with optional filtering
   *
   * @param params - Query parameters (contextId, limit, offset, filter)
   * @param userId - Optional user ID for ownership filtering
   */
  async listTasks(params: ListTaskParams, userId?: string): Promise<AuthResult> {
    let tasks = Array.from(this.tasks.values());

    // Filter by userId if provided (ownership filtering)
    if (userId) {
      tasks = tasks.filter(t => t.metadata?.userId === userId);
    }

    // Filter by contextId if provided
    if (params.contextId) {
      tasks = tasks.filter(t => t.contextId === params.contextId);
    }

    // Filter by state if provided
    if (params.filter?.states && params.filter.states.length > 0) {
      tasks = tasks.filter(t => params.filter!.states!.includes(t.status.state));
    }

    // Filter by creation time
    if (params.filter?.createdAfter) {
      const afterTime = new Date(params.filter.createdAfter).getTime();
      tasks = tasks.filter(t => {
        const taskTime = t.status.timestamp ? new Date(t.status.timestamp).getTime() : 0;
        return taskTime >= afterTime;
      });
    }

    if (params.filter?.createdBefore) {
      const beforeTime = new Date(params.filter.createdBefore).getTime();
      tasks = tasks.filter(t => {
        const taskTime = t.status.timestamp ? new Date(t.status.timestamp).getTime() : 0;
        return taskTime <= beforeTime;
      });
    }

    // Sort by creation time (newest first)
    tasks.sort((a, b) => {
      const aTime = a.status.timestamp ? new Date(a.status.timestamp).getTime() : 0;
      const bTime = b.status.timestamp ? new Date(b.status.timestamp).getTime() : 0;
      return bTime - aTime;
    });

    const total = tasks.length;

    // Apply pagination
    const offset = params.offset || 0;
    const limit = params.limit || 50;
    const paginatedTasks = tasks.slice(offset, offset + limit);

    return {
      tasks: paginatedTasks,
      total,
      hasMore: offset + limit < total
    };
  }

  /**
   * Cancel a task
   *
   * @param taskId - Task ID to cancel
   * @throws A2AError if task not found or already in final state
   */
  async cancelTask(taskId: string): Promise<Task> {
    const task = await this.getTask(taskId);

    // Check if task is already in a final state
    const finalStates: TaskState[] = [
      'completed',
      'canceled',
      'failed',
      'rejected'
    ];
    if (finalStates.includes(task.status.state)) {
      throw this.createError(
        `Cannot cancel task in ${task.status.state} state`,
        'INVALID_REQUEST' as A2AErrorCode
      );
    }

    await this.updateTaskStatus(taskId, 'canceled');

    return this.tasks.get(taskId)!;
  }

  /**
   * Update task status
   *
   * @param taskId - Task ID to update
   * @param state - New state
   * @param message - Optional status message
   */
  async updateTaskStatus(
    taskId: string,
    state: TaskState,
    message?: Message
  ): Promise<void> {
    const task = this.tasks.get(taskId);

    if (!task) {
      throw this.createError(
        `Task not found: ${taskId}`,
        'TASK_NOT_FOUND' as A2AErrorCode
      );
    }

    task.status = {
      state,
      timestamp: new Date().toISOString(),
      message
    };

    // Emit update event
    this.emit('task:update', {
      taskId: task.id,
      status: task.status
    } as TaskUpdateEvent);
  }

  /**
   * Add an artifact to a task
   *
   * @param taskId - Task ID
   * @param artifact - Artifact to add
   */
  async addArtifact(taskId: string, artifact: Artifact): Promise<void> {
    const task = this.tasks.get(taskId);

    if (!task) {
      throw this.createError(
        `Task not found: ${taskId}`,
        'TASK_NOT_FOUND' as A2AErrorCode
      );
    }

    if (!task.artifacts) {
      task.artifacts = [];
    }

    task.artifacts.push(artifact);

    // Emit artifact update event
    this.emit('task:update', {
      taskId: task.id,
      status: task.status,
      artifact
    } as TaskUpdateEvent);
  }

  /**
   * Add a message to task history
   *
   * @param taskId - Task ID
   * @param message - Message to add to history
   */
  async addMessageToHistory(taskId: string, message: Message): Promise<void> {
    const task = this.tasks.get(taskId);

    if (!task) {
      throw this.createError(
        `Task not found: ${taskId}`,
        'TASK_NOT_FOUND' as A2AErrorCode
      );
    }

    if (!task.history) {
      task.history = [];
    }

    task.history.push(message);
  }

  /**
   * Subscribe to task updates
   *
   * @param taskId - Task ID to watch
   * @param callback - Function to call on updates
   * @returns Unsubscribe function
   */
  onTaskUpdate(
    taskId: string,
    callback: (event: TaskUpdateEvent) => void | Promise<void>
  ): () => void {
    const listener = (event: TaskUpdateEvent) => {
      if (event.taskId === taskId) {
        callback(event);
      }
    };

    this.on('task:update', listener);

    // Return unsubscribe function
    return () => {
      this.off('task:update', listener);
    };
  }

  /**
   * Get task count
   */
  getTaskCount(): number {
    return this.tasks.size;
  }

  /**
   * Clear all tasks (for testing)
   */
  clearAllTasks(): void {
    this.tasks.clear();
    this.removeAllListeners();
  }

  /**
   * Add a tool call to a task
   *
   * @param taskId - Task ID
   * @param toolCall - Tool call to add
   */
  async addToolCall(taskId: string, toolCall: ToolCall): Promise<void> {
    const task = this.tasks.get(taskId);

    if (!task) {
      throw this.createError(
        `Task not found: ${taskId}`,
        'TASK_NOT_FOUND' as A2AErrorCode
      );
    }

    if (!task.toolCalls) {
      task.toolCalls = [];
    }

    task.toolCalls.push(toolCall);
  }

  /**
   * Update a tool call in a task
   *
   * @param taskId - Task ID
   * @param callId - Tool call ID
   * @param updatedToolCall - Updated tool call
   */
  async updateToolCall(taskId: string, callId: string, updatedToolCall: ToolCall): Promise<void> {
    const task = this.tasks.get(taskId);

    if (!task) {
      throw this.createError(
        `Task not found: ${taskId}`,
        'TASK_NOT_FOUND' as A2AErrorCode
      );
    }

    if (!task.toolCalls) {
      return;
    }

    const index = task.toolCalls.findIndex((tc: ToolCall) => tc.callId === callId);
    if (index >= 0) {
      task.toolCalls[index] = updatedToolCall;
    }
  }

  /**
   * Get tool calls for a task
   *
   * @param taskId - Task ID
   * @returns Array of tool calls for the task
   */
  getToolCalls(taskId: string): ToolCall[] {
    const task = this.tasks.get(taskId);
    return task?.toolCalls || [];
  }

  /**
   * Helper to create A2AError
   */
  private createError(message: string, code: A2AErrorCode): Error {
    const error = new Error(message) as any;
    error.code = code;
    return error;
  }
}
