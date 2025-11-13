/**
 * A2AService - Main A2A RPC interface using CapnWeb
 *
 * This service implements the A2A protocol methods as RPC calls,
 * replacing traditional HTTP+JSON-RPC transport with capnweb.
 */

import { RpcTarget } from 'capnweb';
import pino from 'pino';
import { TaskManager } from './task-manager';
import { StreamingTask } from './streaming-task';
import type { TaskUpdateCallback } from './task-update-callback';
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

    log.info({ config: this.config }, 'A2AService initialized');
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
    log.info({
      messageId: message.messageId,
      role: message.role,
      hasTaskId: !!message.taskId
    }, 'sendMessage called');

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
        log.error({ error: err, taskId: task.id }, 'Error processing message');
        this.taskManager.updateTaskStatus(task.id, TaskState.Failed).catch(() => {});
      });

      return task;
    } catch (error) {
      log.error({ error }, 'sendMessage error');
      throw error;
    }
  }

  /**
   * Send a message with streaming updates
   *
   * Implements: message/send with streaming (A2A Protocol)
   * Maps to: Returns StreamingTask RpcTarget for bidirectional updates
   *
   * @param message - Message to send
   * @param config - Optional configuration
   * @param callback - Optional callback for push notifications
   * @returns StreamingTask that client can subscribe to
   */
  async sendMessageStreaming(
    message: Message,
    config?: MessageSendConfig,
    callback?: TaskUpdateCallback
  ): Promise<StreamingTask> {
    log.info({
      messageId: message.messageId,
      role: message.role,
      hasCallback: !!callback
    }, 'sendMessageStreaming called');

    try {
      // Create task
      const task = await this.taskManager.createTask(message, config?.metadata);

      // Create streaming task
      const streamingTask = new StreamingTask(task, this.taskManager);

      // Register callback if provided
      if (callback) {
        await streamingTask.subscribe(callback);
      }

      // Process message asynchronously
      this.processMessage(task.id, message).catch(err => {
        log.error({ error: err, taskId: task.id }, 'Error processing message');
        this.taskManager.updateTaskStatus(task.id, TaskState.Failed).catch(() => {});
      });

      return streamingTask;
    } catch (error) {
      log.error({ error }, 'sendMessageStreaming error');
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
    log.info({ taskId, historyLength }, 'getTask called');

    try {
      return await this.taskManager.getTask(taskId, historyLength);
    } catch (error) {
      log.error({ error, taskId }, 'getTask error');
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
    log.info({ params }, 'listTasks called');

    try {
      return await this.taskManager.listTasks(params);
    } catch (error) {
      log.error({ error, params }, 'listTasks error');
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
    log.info({ taskId }, 'cancelTask called');

    try {
      return await this.taskManager.cancelTask(taskId);
    } catch (error) {
      log.error({ error, taskId }, 'cancelTask error');
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
    log.info({ hasToken: !!credentials.token }, 'authenticate called');

    // ⚠️ SECURITY WARNING: This is a STUB implementation for Phase 1 MVP ONLY
    // DO NOT USE THIS IN PRODUCTION - it accepts ANY non-empty token!
    //
    // For production, implement proper authentication:
    // - Validate against actual auth service (OAuth2, JWT, API keys)
    // - Verify token signature and expiry
    // - Check against user database
    // - Implement rate limiting
    // - Add audit logging
    // - Use secure credential storage
    //
    // Phase 3 will implement capability-based security model
    if (!credentials.token || credentials.token.length === 0) {
      throw new Error('Invalid credentials');
    }

    // Return authenticated service with user context
    const userId = 'user-' + credentials.token.substring(0, 8);

    log.info({ userId }, 'Authentication successful');

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
    log.info({ taskId, messageId: message.messageId }, 'Processing message');

    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 100));

    // Extract text from message parts
    const textParts = message.parts
      .filter((p): p is { kind: 'text'; text: string } => p.kind === 'text')
      .map(p => p.text)
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

    log.info({ taskId }, 'Message processing completed');
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
    log.info({ userId, permissions }, 'AuthenticatedA2AService created');
  }

  /**
   * Send message with automatic user context
   */
  async sendMessage(message: Message, config?: MessageSendConfig): Promise<Task | Message> {
    log.info({ userId: this.userId, messageId: message.messageId }, 'Authenticated sendMessage');

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
   * Get task (TODO: add user ownership filtering in Phase 2/3)
   */
  async getTask(taskId: string, historyLength?: number): Promise<Task> {
    const task = await this.taskManager.getTask(taskId, historyLength);

    // TODO: Verify task belongs to user
    // if (task.metadata?.userId !== this.userId) throw new Error('Unauthorized');

    return task;
  }

  /**
   * List tasks (TODO: add user filtering in Phase 2/3)
   */
  async listTasks(params: ListTasksParams): Promise<ListTasksResult> {
    // TODO: Filter by userId
    // const userParams = { ...params, filter: { ...params.filter, userId: this.userId } };
    // return await this.taskManager.listTasks(userParams);

    return await this.taskManager.listTasks(params);
  }

  /**
   * Cancel task (with ownership check)
   */
  async cancelTask(taskId: string): Promise<Task> {
    // TODO: In production, verify task belongs to user
    // const task = await this.taskManager.getTask(taskId);
    // if (task.metadata?.userId !== this.userId) throw new Error('Unauthorized');

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
