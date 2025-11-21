/**
 * Tool Execution Integration Tests
 * Tests the complete tool execution workflow including approval flows
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { A2AService } from '../../src/server/index';
import { TaskState } from '@a2a-webcap/shared';
import type { Message, ToolCall } from '@a2a-webcap/shared';

describe('Tool Execution', () => {
  let service: A2AService;

  beforeEach(() => {
    service = new A2AService({
      agentName: 'Test Agent',
      agentUrl: 'http://localhost:8080'
    });
  });

  afterEach(() => {
    service.getTaskManager().clearAllTasks();
  });

  describe('Tool Registry', () => {
    it('should list available tools', () => {
      const tools = service.listTools();

      expect(tools).toBeInstanceOf(Array);
      expect(tools.length).toBeGreaterThan(0);

      // Check built-in tools are registered
      const toolNames = tools.map(t => t.name);
      expect(toolNames).toContain('calculator');
      expect(toolNames).toContain('echo');
      expect(toolNames).toContain('read_file');
      expect(toolNames).toContain('http_request');
    });

    it('should indicate which tools require approval', () => {
      const tools = service.listTools();

      const calculator = tools.find(t => t.name === 'calculator');
      const readFile = tools.find(t => t.name === 'read_file');

      expect(calculator?.requiresApproval).toBe(false);
      expect(readFile?.requiresApproval).toBe(true);
    });
  });

  describe('Tool Execution - Auto-approved Tools', () => {
    it('should execute calculator tool without approval', async () => {
      // Create a task
      const message: Message = {
        messageId: 'msg-1',
        role: 'user',
        parts: [{ kind: 'text', text: 'Calculate 5 + 3' }]
      };

      const task = await service.sendMessage(message) as any;
      expect(task.id).toBeDefined();

      // Execute calculator tool
      const toolCall = await service.executeTool(task.id, 'calculator', {
        operation: 'add',
        a: 5,
        b: 3
      });

      expect(toolCall.callId).toBeDefined();
      expect(toolCall.name).toBe('calculator');
      // Tool execution is very fast, status may already be 'success'
      expect(['validating', 'scheduled', 'executing', 'success']).toContain(toolCall.status);

      // Wait for tool execution
      await new Promise(resolve => setTimeout(resolve, 150));

      // Get updated task
      const updatedTask = await service.getTaskManager().getTask(task.id);

      // Tool should have completed
      const executedTool = updatedTask.toolCalls?.find(tc => tc.callId === toolCall.callId);
      expect(executedTool).toBeDefined();
      expect(executedTool?.status).toBe('success');
      expect(executedTool?.result).toEqual({ result: 8 });
    });

    it('should execute echo tool', async () => {
      const message: Message = {
        messageId: 'msg-2',
        role: 'user',
        parts: [{ kind: 'text', text: 'Echo test' }]
      };

      const task = await service.sendMessage(message) as any;

      const toolCall = await service.executeTool(task.id, 'echo', {
        message: 'Hello, World!'
      });

      await new Promise(resolve => setTimeout(resolve, 150));

      const updatedTask = await service.getTaskManager().getTask(task.id);
      const executedTool = updatedTask.toolCalls?.find(tc => tc.callId === toolCall.callId);

      expect(executedTool?.status).toBe('success');
      expect(executedTool?.result).toEqual({ echo: 'Hello, World!' });
    });

    it('should handle tool execution errors gracefully', async () => {
      const message: Message = {
        messageId: 'msg-3',
        role: 'user',
        parts: [{ kind: 'text', text: 'Divide by zero' }]
      };

      const task = await service.sendMessage(message) as any;

      const toolCall = await service.executeTool(task.id, 'calculator', {
        operation: 'divide',
        a: 10,
        b: 0
      });

      await new Promise(resolve => setTimeout(resolve, 150));

      const updatedTask = await service.getTaskManager().getTask(task.id);
      const executedTool = updatedTask.toolCalls?.find(tc => tc.callId === toolCall.callId);

      expect(executedTool?.status).toBe('error');
      expect(executedTool?.error).toContain('Division by zero');
    });

    it('should reject unknown tools', async () => {
      const message: Message = {
        messageId: 'msg-4',
        role: 'user',
        parts: [{ kind: 'text', text: 'Test' }]
      };

      const task = await service.sendMessage(message) as any;

      const toolCall = await service.executeTool(task.id, 'nonexistent_tool', {});

      await new Promise(resolve => setTimeout(resolve, 150));

      const updatedTask = await service.getTaskManager().getTask(task.id);
      const executedTool = updatedTask.toolCalls?.find(tc => tc.callId === toolCall.callId);

      expect(executedTool?.status).toBe('error');
      expect(executedTool?.error).toContain('not found');
    });

    it('should validate tool input parameters', async () => {
      const message: Message = {
        messageId: 'msg-5',
        role: 'user',
        parts: [{ kind: 'text', text: 'Test' }]
      };

      const task = await service.sendMessage(message) as any;

      // Missing required parameter
      const toolCall = await service.executeTool(task.id, 'calculator', {
        operation: 'add',
        a: 5
        // Missing 'b' parameter
      });

      await new Promise(resolve => setTimeout(resolve, 150));

      const updatedTask = await service.getTaskManager().getTask(task.id);
      const executedTool = updatedTask.toolCalls?.find(tc => tc.callId === toolCall.callId);

      expect(executedTool?.status).toBe('error');
      expect(executedTool?.error).toContain('Required parameter');
    });
  });

  describe('Tool Execution - Approval Workflow', () => {
    it('should pause task for tool approval', async () => {
      const message: Message = {
        messageId: 'msg-6',
        role: 'user',
        parts: [{ kind: 'text', text: 'Read file' }]
      };

      const task = await service.sendMessage(message) as any;

      // Execute tool that requires approval
      const toolCall = await service.executeTool(task.id, 'read_file', {
        path: '/tmp/test.txt'
      });

      // Wait for state transition
      await new Promise(resolve => setTimeout(resolve, 150));

      // Task may complete via processMessage, but tool should still be awaiting approval
      const updatedTask = await service.getTaskManager().getTask(task.id);

      // Tool should be awaiting approval
      const executedTool = updatedTask.toolCalls?.find(tc => tc.callId === toolCall.callId);
      expect(executedTool?.status).toBe('awaiting-approval');

      // Task state might be InputRequired or Completed (if processMessage finished first)
      // The key is that the tool is waiting for approval
      expect([TaskState.InputRequired, TaskState.Completed]).toContain(updatedTask.status.state);

      // Pending approvals should include this tool
      const pendingApprovals = service.getPendingApprovals(task.id);
      expect(pendingApprovals.length).toBe(1);
      expect(pendingApprovals[0].callId).toBe(toolCall.callId);
    });

    it('should execute tool after approval', async () => {
      const message: Message = {
        messageId: 'msg-7',
        role: 'user',
        parts: [{ kind: 'text', text: 'Read file' }]
      };

      const task = await service.sendMessage(message) as any;

      const toolCall = await service.executeTool(task.id, 'read_file', {
        path: '/tmp/test.txt'
      });

      // Wait for approval request
      await new Promise(resolve => setTimeout(resolve, 150));

      // Approve the tool
      await service.approveToolCall({
        callId: toolCall.callId,
        approved: true
      });

      // Wait for execution
      await new Promise(resolve => setTimeout(resolve, 150));

      // Tool should have executed
      const updatedTask = await service.getTaskManager().getTask(task.id);
      const executedTool = updatedTask.toolCalls?.find(tc => tc.callId === toolCall.callId);

      expect(executedTool?.status).toBe('success');
      expect(executedTool?.result).toBeDefined();

      // Task may be in Working or Completed state (processMessage may have finished)
      expect([TaskState.Working, TaskState.Completed]).toContain(updatedTask.status.state);
    });

    it('should cancel tool on rejection', async () => {
      const message: Message = {
        messageId: 'msg-8',
        role: 'user',
        parts: [{ kind: 'text', text: 'Make HTTP request' }]
      };

      const task = await service.sendMessage(message) as any;

      const toolCall = await service.executeTool(task.id, 'http_request', {
        url: 'https://example.com',
        method: 'GET'
      });

      await new Promise(resolve => setTimeout(resolve, 150));

      // Reject the tool
      await service.approveToolCall({
        callId: toolCall.callId,
        approved: false,
        reason: 'User denied permission'
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Tool should be cancelled
      const updatedTask = await service.getTaskManager().getTask(task.id);
      const executedTool = updatedTask.toolCalls?.find(tc => tc.callId === toolCall.callId);

      expect(executedTool?.status).toBe('cancelled');
      expect(executedTool?.error).toContain('User denied permission');

      // Task may be in Working or Completed state
      expect([TaskState.Working, TaskState.Completed]).toContain(updatedTask.status.state);
    });

    it('should handle multiple tool approvals in sequence', async () => {
      const message: Message = {
        messageId: 'msg-9',
        role: 'user',
        parts: [{ kind: 'text', text: 'Multiple operations' }]
      };

      const task = await service.sendMessage(message) as any;

      // Execute two tools that require approval
      const toolCall1 = await service.executeTool(task.id, 'read_file', {
        path: '/tmp/file1.txt'
      });

      const toolCall2 = await service.executeTool(task.id, 'read_file', {
        path: '/tmp/file2.txt'
      });

      await new Promise(resolve => setTimeout(resolve, 150));

      // Both should be pending
      let pendingApprovals = service.getPendingApprovals(task.id);
      expect(pendingApprovals.length).toBe(2);

      // Approve first tool
      await service.approveToolCall({
        callId: toolCall1.callId,
        approved: true
      });

      await new Promise(resolve => setTimeout(resolve, 150));

      // First tool should complete
      let updatedTask = await service.getTaskManager().getTask(task.id);
      let tool1 = updatedTask.toolCalls?.find(tc => tc.callId === toolCall1.callId);
      expect(tool1?.status).toBe('success');

      // Second tool still pending
      pendingApprovals = service.getPendingApprovals(task.id);
      expect(pendingApprovals.length).toBe(1);
      // Task may be InputRequired or Completed (processMessage may have finished)
      expect([TaskState.InputRequired, TaskState.Completed]).toContain(updatedTask.status.state);

      // Approve second tool
      await service.approveToolCall({
        callId: toolCall2.callId,
        approved: true
      });

      await new Promise(resolve => setTimeout(resolve, 150));

      // Both tools should complete
      updatedTask = await service.getTaskManager().getTask(task.id);
      const tool2 = updatedTask.toolCalls?.find(tc => tc.callId === toolCall2.callId);
      expect(tool2?.status).toBe('success');

      // Task may be Working or Completed
      expect([TaskState.Working, TaskState.Completed]).toContain(updatedTask.status.state);
    });
  });

  describe('Multiple Tools in Task', () => {
    it('should execute multiple tools concurrently', async () => {
      const message: Message = {
        messageId: 'msg-10',
        role: 'user',
        parts: [{ kind: 'text', text: 'Multiple calculations' }]
      };

      const task = await service.sendMessage(message) as any;

      // Execute multiple auto-approved tools
      const toolCall1 = await service.executeTool(task.id, 'calculator', {
        operation: 'add',
        a: 1,
        b: 2
      });

      const toolCall2 = await service.executeTool(task.id, 'calculator', {
        operation: 'multiply',
        a: 3,
        b: 4
      });

      const toolCall3 = await service.executeTool(task.id, 'echo', {
        message: 'Test'
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      // All tools should complete
      const updatedTask = await service.getTaskManager().getTask(task.id);
      expect(updatedTask.toolCalls?.length).toBe(3);

      const tool1 = updatedTask.toolCalls?.find(tc => tc.callId === toolCall1.callId);
      const tool2 = updatedTask.toolCalls?.find(tc => tc.callId === toolCall2.callId);
      const tool3 = updatedTask.toolCalls?.find(tc => tc.callId === toolCall3.callId);

      expect(tool1?.status).toBe('success');
      expect(tool1?.result).toEqual({ result: 3 });

      expect(tool2?.status).toBe('success');
      expect(tool2?.result).toEqual({ result: 12 });

      expect(tool3?.status).toBe('success');
      expect(tool3?.result).toEqual({ echo: 'Test' });
    });

    it('should handle mix of auto-approved and approval-required tools', async () => {
      const message: Message = {
        messageId: 'msg-11',
        role: 'user',
        parts: [{ kind: 'text', text: 'Mixed operations' }]
      };

      const task = await service.sendMessage(message) as any;

      // Execute auto-approved tool
      const autoTool = await service.executeTool(task.id, 'echo', {
        message: 'Hello'
      });

      // Execute approval-required tool
      const approvalTool = await service.executeTool(task.id, 'read_file', {
        path: '/tmp/test.txt'
      });

      await new Promise(resolve => setTimeout(resolve, 150));

      const updatedTask = await service.getTaskManager().getTask(task.id);

      // Auto tool should complete
      const completedTool = updatedTask.toolCalls?.find(tc => tc.callId === autoTool.callId);
      expect(completedTool?.status).toBe('success');

      // Approval tool should be waiting
      const waitingTool = updatedTask.toolCalls?.find(tc => tc.callId === approvalTool.callId);
      expect(waitingTool?.status).toBe('awaiting-approval');

      // Task may be InputRequired or Completed (processMessage may have finished)
      expect([TaskState.InputRequired, TaskState.Completed]).toContain(updatedTask.status.state);
    });
  });
});
