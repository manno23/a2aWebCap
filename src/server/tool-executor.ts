/**
 * Tool Execution Engine
 * Handles tool execution, approval workflows, and state management
 */

import { EventEmitter } from 'events';
import type { EventEmitter as EventEmitterType } from 'events';
import { randomUUID } from 'crypto';
type ToolStatus = string;
export interface ToolCall { callId: string; name: string; input: Record<string, any>; status: ToolStatus; result?: any; error?: string; timestamp: string; }
import { ToolRegistry, type ToolDefinition } from './tool-registry.js';
import { createLogger } from '../shared/logger.js'

const log = createLogger('tool-executor');

/**
 * Tool execution events
 */
export interface ToolExecutionEvents {
  'tool:statusChange': (event: ToolStatusChangeEvent) => void;
  'tool:needsApproval': (event: ToolApprovalNeededEvent) => void;
}

export interface ToolStatusChangeEvent {
  taskId: string;
  callId: string;
  status: ToolStatus;
  result?: any;
  error?: string;
}

export interface ToolApprovalNeededEvent {
  taskId: string;
  callId: string;
  toolName: string;
  input: Record<string, any>;
}

/**
 * Tool approval decision
 */
export interface ToolApproval {
  callId: string;
  approved: boolean;
  reason?: string;
}

/**
 * Tool Executor
 * Manages tool execution lifecycle with approval workflow
 */
export class ToolExecutor extends EventEmitter implements EventEmitterType {
  private registry: ToolRegistry;
  private toolCalls = new Map<string, ToolCall>();
  private taskTools = new Map<string, Set<string>>(); // taskId -> Set<callId>
  private pendingApprovals = new Map<string, ToolCall>(); // callId -> ToolCall

  constructor(registry?: ToolRegistry) {
    super();
    this.registry = registry || new ToolRegistry();
  }

  /**
   * Execute a tool call
   * Returns immediately with ToolCall in appropriate status
   * Execution happens asynchronously
   */
  async executeTool(
    taskId: string,
    toolName: string,
    input?: Record<string, any>
  ): Promise<ToolCall> {
    const callId = randomUUID();
    const timestamp = new Date().toISOString();

    log.info({ taskId, callId, toolName }, 'Tool execution requested');

    // Create initial tool call in 'validating' status
    const toolCall: ToolCall = {
      callId,
      name: toolName,
      input: input || {},
      status: 'validating' as ToolStatus,
      timestamp
    };

    this.toolCalls.set(callId, toolCall);

    // Track tools for this task
    if (!this.taskTools.has(taskId)) {
      this.taskTools.set(taskId, new Set());
    }
    this.taskTools.get(taskId)!.add(callId);

    // Start async execution
    this.processToolCall(taskId, toolCall).catch(err => {
      log.error({ taskId, callId, error: err.message }, 'Tool execution error');
    });

    return toolCall;
  }

  /**
   * Approve or reject a pending tool call
   */
  async approveToolCall(approval: ToolApproval): Promise<void> {
    const toolCall = this.pendingApprovals.get(approval.callId);

    if (!toolCall) {
      throw new Error(`No pending approval for call ${approval.callId}`);
    }

    log.info({
      callId: approval.callId,
      approved: approval.approved
    }, 'Tool approval decision received');

    if (approval.approved) {
      // Resume execution
      await this.updateToolStatus(toolCall, 'executing');
      this.pendingApprovals.delete(approval.callId);

      // Execute the tool
      const tool = this.registry.getTool(toolCall.name);
      if (tool) {
        this.executeToolDefinition(toolCall, tool).catch(err => {
          log.error({
            callId: approval.callId,
            error: err.message
          }, 'Tool execution failed after approval');
        });
      }
    } else {
      // User rejected - cancel the tool call
      await this.updateToolStatus(toolCall, 'cancelled', undefined, approval.reason);
      this.pendingApprovals.delete(approval.callId);
    }
  }

  /**
   * Get tool call by ID
   */
  getToolCall(callId: string): ToolCall | undefined {
    return this.toolCalls.get(callId);
  }

  /**
   * Get all tool calls for a task
   */
  getTaskToolCalls(taskId: string): ToolCall[] {
    const callIds = this.taskTools.get(taskId) || new Set();
    return Array.from(callIds)
      .map(callId => this.toolCalls.get(callId))
      .filter((call): call is ToolCall => call !== undefined);
  }

  /**
   * Get pending approval requests for a task
   */
  getPendingApprovals(taskId: string): ToolCall[] {
    const taskCalls = this.getTaskToolCalls(taskId);
    return taskCalls.filter(call => call.status === 'awaiting-approval');
  }

  /**
   * Process tool call through its lifecycle
   */
  private async processToolCall(taskId: string, toolCall: ToolCall): Promise<void> {
    // Validate tool exists
    const tool = this.registry.getTool(toolCall.name);

    if (!tool) {
      await this.updateToolStatus(
        toolCall,
        'error',
        undefined,
        `Tool '${toolCall.name}' not found`
      );
      return;
    }

    // Validate input
    const validation = this.registry.validateInput(toolCall.name, toolCall.input || {});
    if (!validation.valid) {
      await this.updateToolStatus(
        toolCall,
        'error',
        undefined,
        `Validation failed: ${validation.errors.join(', ')}`
      );
      return;
    }

    // Move to 'scheduled' status
    await this.updateToolStatus(toolCall, 'scheduled');

    // Check if tool requires approval
    if (tool.requiresApproval) {
      await this.updateToolStatus(toolCall, 'awaiting-approval');
      this.pendingApprovals.set(toolCall.callId, toolCall);

      // Emit event for approval needed
      this.emit('tool:needsApproval', {
        taskId,
        callId: toolCall.callId,
        toolName: toolCall.name,
        input: toolCall.input || {}
      });

      // Execution will resume after approval
      return;
    }

    // No approval needed - execute immediately
    await this.updateToolStatus(toolCall, 'executing');
    await this.executeToolDefinition(toolCall, tool);
  }

  /**
   * Execute the tool definition
   */
  private async executeToolDefinition(toolCall: ToolCall, tool: ToolDefinition): Promise<void> {
    try {
      log.info({callId: toolCall.callId, name: tool.name }, 'Executing tool');

      const result = await tool.execute(toolCall.input || {});

      await this.updateToolStatus(toolCall, 'success', result);
    } catch (error: any) {
      log.error({
        callId: toolCall.callId,
        error: error.message
      }, 'Tool execution failed');

      await this.updateToolStatus(toolCall, 'error', undefined, error.message);
    }
  }

  /**
   * Update tool call status and emit events
   */
  private async updateToolStatus(
    toolCall: ToolCall,
    status: ToolStatus,
    result?: any,
    error?: string
  ): Promise<void> {
    toolCall.status = status;
    if (result !== undefined) {
      toolCall.result = result;
    }
    if (error !== undefined) {
      toolCall.error = error;
    }

    log.info({
      callId: toolCall.callId,
      status,
      hasResult: result !== undefined,
      hasError: error !== undefined
    }, 'Tool status updated');

    // Emit status change event
    this.emit('tool:statusChange', {
      taskId: this.findTaskIdForCall(toolCall.callId),
      callId: toolCall.callId,
      status,
      result,
      error
    });
  }

  /**
   * Find task ID for a given call ID
   */
  private findTaskIdForCall(callId: string): string {
    for (const [taskId, callIds] of this.taskTools.entries()) {
      if (callIds.has(callId)) {
        return taskId;
      }
    }
    return 'unknown';
  }

  /**
   * Get tool registry for inspection
   */
  getRegistry(): ToolRegistry {
    return this.registry;
  }
}
