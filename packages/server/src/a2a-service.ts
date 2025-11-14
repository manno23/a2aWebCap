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
import { ToolExecutor } from './tool-executor';
import { ToolRegistry } from './tool-registry';
import type { ToolApproval } from './tool-executor';
import { TaskState } from '@a2a-webcap/shared';
import type { AuthenticationService } from './authentication-service';
import type {
  Message,
  Task,
  AgentCard,
  MessageSendConfig,
  ListTasksParams,
  ListTasksResult,
  AuthCredentials,
  ToolCall
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
  private toolExecutor: ToolExecutor;
  private config: A2AServiceConfig;
  private authService?: AuthenticationService;

  constructor(config: A2AServiceConfig = {}, authService?: AuthenticationService) {
    super();
    this.taskManager = new TaskManager();
    this.toolExecutor = new ToolExecutor();
    this.authService = authService;
    this.config = {
      agentName: config.agentName || 'A2A CapnWeb Server',
      agentDescription: config.agentDescription || 'A2A server using capnweb transport',
      agentUrl: config.agentUrl || 'http://localhost:8080',
      protocolVersion: config.protocolVersion || '0.4.0'
    };

    log.info({ config: this.config }, 'A2AService initialized');

    // Setup tool execution event handlers
    this.setupToolExecutionHandlers();
  }

  /**
   * Setup event handlers for tool execution
   */
  private setupToolExecutionHandlers(): void {
    // When a tool needs approval, transition task to InputRequired state
    this.toolExecutor.on('tool:needsApproval', async (event) => {
      log.info({
        taskId: event.taskId,
        callId: event.callId,
        toolName: event.toolName
      }, 'Tool needs approval');

      try {
        await this.taskManager.updateTaskStatus(
          event.taskId,
          TaskState.InputRequired
        );
      } catch (err: any) {
        log.error({
          taskId: event.taskId,
          error: err.message
        }, 'Failed to update task status for approval');
      }
    });

    // When tool status changes, sync with task
    this.toolExecutor.on('tool:statusChange', async (event) => {
      log.info({
        taskId: event.taskId,
        callId: event.callId,
        status: event.status
      }, 'Tool status changed');

      try {
        const toolCall = this.toolExecutor.getToolCall(event.callId);
        if (toolCall) {
          await this.taskManager.updateToolCall(event.taskId, event.callId, toolCall);
        }

        // If tool execution completed and no more pending approvals,
        // transition back to Working state
        if (event.status === 'success' || event.status === 'error' || event.status === 'cancelled') {
          const pendingApprovals = this.toolExecutor.getPendingApprovals(event.taskId);
          if (pendingApprovals.length === 0) {
            const task = await this.taskManager.getTask(event.taskId);
            if (task.status.state === TaskState.InputRequired) {
              await this.taskManager.updateTaskStatus(
                event.taskId,
                TaskState.Working
              );
            }
          }
        }
      } catch (err: any) {
        log.error({
          taskId: event.taskId,
          error: err.message
        }, 'Failed to handle tool status change');
      }
    });
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
   * Execute a tool in the context of a task
   *
   * @param taskId - Task ID to execute tool in
   * @param toolName - Name of tool to execute
   * @param input - Tool input parameters
   * @returns Tool call object
   */
  async executeTool(
    taskId: string,
    toolName: string,
    input?: Record<string, any>
  ): Promise<ToolCall> {
    log.info({ taskId, toolName }, 'executeTool called');

    try {
      // Verify task exists
      await this.taskManager.getTask(taskId);

      // Execute tool
      const toolCall = await this.toolExecutor.executeTool(taskId, toolName, input);

      // Add tool call to task
      await this.taskManager.addToolCall(taskId, toolCall);

      return toolCall;
    } catch (error) {
      log.error({ error, taskId, toolName }, 'executeTool error');
      throw error;
    }
  }

  /**
   * Approve or reject a pending tool call
   *
   * @param approval - Approval decision
   */
  async approveToolCall(approval: ToolApproval): Promise<void> {
    log.info({
      callId: approval.callId,
      approved: approval.approved
    }, 'approveToolCall called');

    try {
      await this.toolExecutor.approveToolCall(approval);
    } catch (error) {
      log.error({ error, callId: approval.callId }, 'approveToolCall error');
      throw error;
    }
  }

  /**
   * List available tools
   *
   * @returns Array of available tool definitions
   */
  listTools(): Array<{name: string; description: string; requiresApproval: boolean}> {
    const tools = this.toolExecutor.getRegistry().listTools();
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      requiresApproval: tool.requiresApproval
    }));
  }

  /**
   * Get pending tool approvals for a task
   *
   * @param taskId - Task ID
   * @returns Array of pending tool calls
   */
  getPendingApprovals(taskId: string): ToolCall[] {
    return this.toolExecutor.getPendingApprovals(taskId);
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
    log.info({ type: credentials.type, hasToken: !!credentials.token }, 'authenticate called');

    // Use real authentication service if available
    if (this.authService) {
      const authResult = await this.authService.authenticate(credentials);

      if (!authResult.authenticated) {
        const error = authResult.metadata?.error || 'Authentication failed';
        log.warn({ error }, 'Authentication failed');
        throw new Error(`UNAUTHORIZED: ${error}`);
      }

      log.info(
        {
          userId: authResult.userId,
          permissions: authResult.permissions
        },
        'Authentication successful'
      );

      return new AuthenticatedA2AService(
        this.taskManager,
        authResult.userId!,
        authResult.permissions || []
      );
    }

    // Fallback to stub implementation if no auth service configured
    // (for backward compatibility with tests)
    log.warn('Using stub authentication - not secure for production!');

    if (!credentials.token || credentials.token.length === 0) {
      throw new Error('UNAUTHORIZED: Invalid credentials');
    }

    const userId = 'user-' + credentials.token.substring(0, 8);

    return new AuthenticatedA2AService(
      this.taskManager,
      userId,
      ['read', 'write']
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
   * Get task with ownership check
   */
  async getTask(taskId: string, historyLength?: number): Promise<Task> {
    const task = await this.taskManager.getTask(taskId, historyLength);

    // Verify task belongs to user
    if (task.metadata?.userId && task.metadata.userId !== this.userId) {
      throw new Error('FORBIDDEN: Task does not belong to user');
    }

    return task;
  }

  /**
   * List tasks filtered by user ownership
   */
  async listTasks(params: ListTasksParams): Promise<ListTasksResult> {
    // Filter by userId to enforce ownership
    return await this.taskManager.listTasks(params, this.userId);
  }

  /**
   * Cancel task with ownership check
   */
  async cancelTask(taskId: string): Promise<Task> {
    // Verify task belongs to user before canceling
    const task = await this.taskManager.getTask(taskId);

    if (task.metadata?.userId && task.metadata.userId !== this.userId) {
      throw new Error('FORBIDDEN: Cannot cancel task that does not belong to user');
    }

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
