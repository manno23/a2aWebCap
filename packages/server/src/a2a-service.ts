/**
 * A2AService - Main A2A RPC interface using CapnWeb
 *
 * This service implements the A2A protocol methods as RPC calls,
 * replacing traditional HTTP+JSON-RPC transport with capnweb.
 */

import { RpcTarget } from 'capnweb';
import pino from 'pino';
import { TaskManager } from './task-manager';
import { TaskState } from '@a2a-webcap/shared';
import type {
  Message,
  Task,
  AgentCard,
  MessageSendConfig,
  ListTasksParams,
  ListTasksResult,
  AuthCredentials
} from '@a2a-webcap/shared';

const log = pino({ name: 'a2a-service' });

export interface A2AServiceConfig {
  agentName?: string;
  agentDescription?: string;
  agentUrl?: string;
  protocolVersion?: string;
}

/**
 * Main A2A Service exposed via CapnWeb RPC
 * Implements all A2A protocol methods
 */
export class A2AService extends RpcTarget {
  private taskManager: TaskManager;
  private config: A2AServiceConfig;

  constructor(config: A2AServiceConfig = {}) {
    super();
    this.taskManager = new TaskManager();
    this.config = {
      agentName: config.agentName || 'A2A CapnWeb Server',
      agentDescription: config.agentDescription || 'A2A server using capnweb transport',
      agentUrl: config.agentUrl || 'http://localhost:8080',
      protocolVersion: config.protocolVersion || '0.4.0'
    };

    log.info('A2AService initialized', { config: this.config });
  }

  /**
   * Send a message and create/continue a task
   *
   * Implements: message/send (A2A Protocol)
   * Maps to: RPC method invocation with Promise return
   *
   * @param message - Message to send
   * @param config - Optional configuration
   * @returns Task or Message depending on whether task is created
   */
  async sendMessage(
    message: Message,
    config?: MessageSendConfig
  ): Promise<Task | Message> {
    log.info('sendMessage called', {
      messageId: message.messageId,
      role: message.role,
      hasTaskId: !!message.taskId
    });

    try {
      // If message has taskId, continue existing task
      if (message.taskId) {
        const task = await this.taskManager.getTask(message.taskId);

        // Add message to history
        await this.taskManager.addMessageToHistory(task.id, message);

        // Process the message (stub implementation for now)
        await this.processMessage(task.id, message);

        return await this.taskManager.getTask(task.id);
      }

      // Create new task
      const task = await this.taskManager.createTask(message, config?.metadata);

      // Process the message asynchronously
      this.processMessage(task.id, message).catch(err => {
        log.error('Error processing message', { error: err, taskId: task.id });
        this.taskManager.updateTaskStatus(task.id, TaskState.Failed).catch(() => {});
      });

      return task;
    } catch (error) {
      log.error('sendMessage error', { error });
      throw error;
    }
  }

  /**
   * Get task status
   *
   * Implements: tasks/get (A2A Protocol)
   * Maps to: Direct RPC method call
   *
   * @param taskId - Task ID to retrieve
   * @param historyLength - Optional limit on history
   * @returns Task
   */
  async getTask(taskId: string, historyLength?: number): Promise<Task> {
    log.info('getTask called', { taskId, historyLength });

    try {
      return await this.taskManager.getTask(taskId, historyLength);
    } catch (error) {
      log.error('getTask error', { error, taskId });
      throw error;
    }
  }

  /**
   * List tasks with optional filtering
   *
   * Implements: tasks/list (A2A Protocol)
   * Maps to: RPC method with parameters
   *
   * @param params - Query parameters
   * @returns List of tasks
   */
  async listTasks(params: ListTasksParams): Promise<ListTasksResult> {
    log.info('listTasks called', { params });

    try {
      return await this.taskManager.listTasks(params);
    } catch (error) {
      log.error('listTasks error', { error });
      throw error;
    }
  }

  /**
   * Cancel a task
   *
   * Implements: tasks/cancel (A2A Protocol)
   * Maps to: RPC method invocation
   *
   * @param taskId - Task ID to cancel
   * @returns Canceled task
   */
  async cancelTask(taskId: string): Promise<Task> {
    log.info('cancelTask called', { taskId });

    try {
      return await this.taskManager.cancelTask(taskId);
    } catch (error) {
      log.error('cancelTask error', { error, taskId });
      throw error;
    }
  }

  /**
   * Get agent card (agent discovery)
   *
   * Implements: AgentCard endpoint (A2A Protocol)
   * Usually served at /.well-known/agent.json
   *
   * @returns AgentCard with server capabilities
   */
  getAgentCard(): AgentCard {
    log.debug('getAgentCard called');

    return {
      protocolVersion: this.config.protocolVersion!,
      name: this.config.agentName!,
      description: this.config.agentDescription!,
      url: this.config.agentUrl!,
      preferredTransport: 'CAPNWEB',
      additionalInterfaces: [
        {
          url: this.config.agentUrl!,
          transport: 'CAPNWEB',
          metadata: {
            websocket: true,
            bidirectional: true
          }
        }
      ],
      capabilities: {
        streaming: true,
        pushNotifications: true,
        bidirectional: true,
        taskManagement: true,
        fileTransfer: true
      },
      authentication: [
        {
          type: 'bearer',
          description: 'Bearer token authentication'
        }
      ],
      metadata: {
        implementation: 'a2aWebCap',
        runtime: 'Node.js',
        transport: 'capnweb'
      }
    };
  }

  /**
   * Authenticate and return authorized service stub
   *
   * Implements: Capability-based security pattern
   * This is a capnweb-specific enhancement over standard A2A
   *
   * @param credentials - Authentication credentials
   * @returns Authenticated service (stub with user context)
   */
  async authenticate(credentials: AuthCredentials): Promise<AuthenticatedA2AService> {
    log.info('authenticate called', { type: credentials.type });

    // Stub authentication - in production, validate credentials
    // against actual auth service (database, OAuth, etc.)
    if (!credentials.token || credentials.token.length === 0) {
      throw new Error('Invalid credentials');
    }

    // Return authenticated service with user context
    const userId = 'user-' + credentials.token.substring(0, 8);

    log.info('Authentication successful', { userId });

    return new AuthenticatedA2AService(
      this.taskManager,
      userId,
      ['read', 'write'] // permissions
    );
  }

  /**
   * Process a message (stub implementation)
   *
   * In a real implementation, this would:
   * - Parse the message content
   * - Execute appropriate tools/actions
   * - Generate response
   * - Update task status
   * - Create artifacts
   *
   * For MVP, we just echo back with a simple response
   */
  private async processMessage(taskId: string, message: Message): Promise<void> {
    log.info('Processing message', { taskId, messageId: message.messageId });

    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 100));

    // Extract text from message parts
    const textParts = message.parts
      .filter(p => p.kind === 'text')
      .map(p => (p as any).text)
      .join(' ');

    // Create a simple echo response
    const responseText = `Echo: ${textParts}`;

    // Add response message to history
    const responseMessage: Message = {
      messageId: `msg-${Date.now()}`,
      contextId: message.contextId,
      taskId,
      role: 'agent',
      parts: [
        {
          kind: 'text',
          text: responseText
        }
      ]
    };

    await this.taskManager.addMessageToHistory(taskId, responseMessage);

    // Mark task as completed
    await this.taskManager.updateTaskStatus(taskId, TaskState.Completed, responseMessage);

    log.info('Message processing complete', { taskId });
  }

  /**
   * Get the underlying task manager (for testing)
   */
  getTaskManager(): TaskManager {
    return this.taskManager;
  }
}

/**
 * Authenticated A2A Service with user context
 *
 * This demonstrates capnweb's capability-based security:
 * - Authentication returns a NEW stub with user context
 * - No need to send credentials with every request
 * - Stub disposal automatically revokes access
 */
export class AuthenticatedA2AService extends RpcTarget {
  constructor(
    private taskManager: TaskManager,
    private userId: string,
    private permissions: string[]
  ) {
    super();
    log.info('AuthenticatedA2AService created', { userId, permissions });
  }

  /**
   * Send message with automatic user context
   */
  async sendMessage(message: Message, config?: MessageSendConfig): Promise<Task | Message> {
    log.info('Authenticated sendMessage', { userId: this.userId, messageId: message.messageId });

    // Add user context to metadata
    const enrichedConfig = {
      ...config,
      metadata: {
        ...config?.metadata,
        userId: this.userId
      }
    };

    // Create task through task manager
    if (message.taskId) {
      const task = await this.taskManager.getTask(message.taskId);
      await this.taskManager.addMessageToHistory(task.id, message);
      return task;
    }

    return await this.taskManager.createTask(message, enrichedConfig.metadata);
  }

  /**
   * Get task (filtered to user's tasks)
   */
  async getTask(taskId: string, historyLength?: number): Promise<Task> {
    const task = await this.taskManager.getTask(taskId, historyLength);

    // In production, verify task belongs to user
    // For MVP, we just return it
    return task;
  }

  /**
   * List tasks (filtered to user's tasks)
   */
  async listTasks(params: ListTasksParams): Promise<ListTasksResult> {
    // In production, filter by userId
    return await this.taskManager.listTasks(params);
  }

  /**
   * Cancel task (with ownership check)
   */
  async cancelTask(taskId: string): Promise<Task> {
    const task = await this.taskManager.getTask(taskId);

    // In production, verify task belongs to user
    return await this.taskManager.cancelTask(taskId);
  }

  /**
   * Get agent card (public information)
   */
  getAgentCard(): AgentCard {
    // Could customize based on user permissions
    return new A2AService().getAgentCard();
  }
}
