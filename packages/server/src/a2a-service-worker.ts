/**
 * Cloudflare Workers Compatible A2A Service
 * Minimal implementation for Workers runtime
 */

import { createLogger, type Logger } from '../../shared/dist/logger'
import { TaskState } from '../../shared/dist/a2a-types'
import type {
  Message,
  Task,
  AgentCard,
  MessageSendConfig,
  ListTasksParams,
  ListTasksResult,
} from '../../shared/dist/a2a-types';

const log: Logger = createLogger('a2a-service-worker');

export interface A2AServiceConfig {
  agentName?: string;
  agentDescription?: string;
  agentUrl?: string;
  protocolVersion?: string;
}

/**
 * Simplified A2A Service for Cloudflare Workers
 * This version removes dependencies on Node.js-specific modules
 */
export class A2AService {
  private config: A2AServiceConfig;
  private tasks: Map<string, Task>;

  constructor(config: A2AServiceConfig = {}) {
    this.config = {
      agentName: config.agentName || 'A2A Worker Agent',
      agentDescription: config.agentDescription || 'A2A protocol agent running on Cloudflare Workers',
      agentUrl: config.agentUrl || 'https://your-worker.workers.dev',
      protocolVersion: config.protocolVersion || '0.4.0'
    };

    this.tasks = new Map();

    log.info('A2A Service initialized for Workers', { config: this.config });
  }

  /**
   * Get agent capabilities and information
   */
  getAgentCard(): AgentCard {
    return {
      protocolVersion: this.config.protocolVersion!,
      name: this.config.agentName!,
      description: this.config.agentDescription!,
      url: this.config.agentUrl!,
      preferredTransport: "websocket",
      capabilities: {
        streaming: true,
        pushNotifications: false,
        bidirectional: true,
        taskManagement: true,
        fileTransfer: false  // Limited in Workers
      },
      authentication: [
        {
          type: "bearer",
          description: "JWT Bearer token authentication"
        }
      ]
    };
  }

  /**
   * Send a message and create/update a task
   */
  async sendMessage(message: Message, config?: MessageSendConfig): Promise<Task> {
    const taskId = message.taskId || this.generateTaskId();

    log.info('Processing message', { messageId: message.messageId, taskId });

    // Create or update task
    let task = this.tasks.get(taskId);
    if (!task) {
      task = {
        id: taskId,
        contextId: message.contextId || taskId,
        status: {
          state: TaskState.Working,
          timestamp: new Date().toISOString()
        },
        history: [],
        artifacts: [],
        toolCalls: [],
        kind: 'task'
      };
      this.tasks.set(taskId, task);
    }

    // Add message to history
    if (task.history) {
      task.history.push(message);
    }

    // Simulate processing (in a real implementation, this would call AI models)
    try {
      // Generate a simple response for demonstration
      const responseMessage: Message = {
        messageId: this.generateMessageId(),
        contextId: message.contextId,
        taskId: taskId,
        role: 'agent',
        parts: [
          {
            kind: 'text',
            text: `Processed message: ${message.parts[0]?.kind === 'text' ? message.parts[0].text : 'Unknown content'}`
          }
        ],
        metadata: {
          processedBy: 'a2a-worker',
          timestamp: new Date().toISOString()
        }
      };

      if (task.history) {
        task.history.push(responseMessage);
      }

      // Update task status
      task.status = {
        state: TaskState.Completed,
        timestamp: new Date().toISOString()
      };

      log.info('Message processed successfully', { messageId: message.messageId, taskId });

    } catch (error) {
      log.error('Error processing message', { messageId: message.messageId, taskId, error });

      task.status = {
        state: TaskState.Failed,
        timestamp: new Date().toISOString()
      };
    }

    return task;
  }

  /**
   * Get task by ID
   */
  async getTask(taskId: string, historyLength?: number): Promise<Task | undefined> {
    log.info('Getting task', { taskId, historyLength });

    const task = this.tasks.get(taskId);
    if (!task) {
      log.warn('Task not found', { taskId });
      return undefined;
    }

    // If historyLength is specified, limit the history
    if (historyLength !== undefined && task.history) {
      return {
        ...task,
        history: task.history.slice(-historyLength)
      };
    }

    return task;
  }

  /**
   * List tasks with optional filtering
   */
  async listTasks(params?: ListTasksParams): Promise<ListTasksResult> {
    log.info('Listing tasks', { params });

    const allTasks = Array.from(this.tasks.values());

    // Apply filtering (simplified implementation)
    let filteredTasks = allTasks;

    if (params?.filter?.states) {
      filteredTasks = filteredTasks.filter(task => 
        params.filter!.states!.includes(task.status.state)
      );
    }

    // Apply pagination
    const offset = params?.offset || 0;
    const limit = params?.limit || 10;
    const paginatedTasks = filteredTasks.slice(offset, offset + limit);

    return {
      tasks: paginatedTasks,
      total: filteredTasks.length,
      hasMore: offset + limit < filteredTasks.length
    };
  }

  /**
   * Cancel a task
   */
  async cancelTask(taskId: string): Promise<Task | undefined> {
    log.info('Cancelling task', { taskId });

    const task = this.tasks.get(taskId);
    if (!task) {
      log.warn('Task not found for cancellation', { taskId });
      return undefined;
    }

    task.status = {
      state: TaskState.Canceled,
      timestamp: new Date().toISOString()
    };

    return task;
  }

  // Helper methods
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
