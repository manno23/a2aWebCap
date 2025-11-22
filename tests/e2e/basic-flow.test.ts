/**
 * End-to-End Test - Basic A2A Flow
 *
 * Tests the complete client-server interaction:
 * 1. Server starts
 * 2. Client connects
 * 3. Client sends message
 * 4. Task is created and processed
 * 5. Client retrieves task status
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'http';
import { randomUUID } from 'crypto';
import { WebSocketServer } from 'ws';
import { A2AService } from '../../src/server/index';
import { A2AClient } from '../../../client/src/index';
import { wait } from '../utils';

// Time to wait for async task processing
const PROCESSING_DELAY_MS = 200;

describe('End-to-End: Basic A2A Flow', () => {
  let server: ReturnType<typeof createServer>;
  let wss: WebSocketServer;
  let a2aService: A2AService;
  let client: A2AClient;
  const PORT = 8181; // Use different port for testing

  beforeAll(async () => {
    // Create A2A service
    a2aService = new A2AService({
      agentName: 'Test A2A Server',
      agentUrl: `http://localhost:${PORT}`,
      protocolVersion: '0.4.0'
    });

    // Create HTTP server
    server = createServer((req, res) => {
      if (req.url === '/.well-known/agent.json') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(a2aService.getAgentCard()));
        return;
      }

      res.writeHead(404);
      res.end();
    });

    // Create WebSocket server
    wss = new WebSocketServer({ server });

    wss.on('connection', (ws) => {
      ws.on('message', async (data) => {
        try {
          const request = JSON.parse(data.toString());
          let response: any;

          switch (request.method) {
            case 'getAgentCard':
              response = a2aService.getAgentCard();
              break;
            case 'sendMessage':
              response = await a2aService.sendMessage(
                request.params.message,
                request.params.config
              );
              break;
            case 'getTask':
              response = await a2aService.getTask(
                request.params.taskId,
                request.params.historyLength
              );
              break;
            case 'listTasks':
              response = await a2aService.listTasks(request.params);
              break;
            case 'cancelTask':
              response = await a2aService.cancelTask(request.params.taskId);
              break;
            default:
              throw new Error(`Unknown method: ${request.method}`);
          }

          ws.send(JSON.stringify({
            id: request.id,
            result: response
          }));
        } catch (error: any) {
          ws.send(JSON.stringify({
            id: (data as any).id,
            error: {
              code: error.code || 'INTERNAL_ERROR',
              message: error.message
            }
          }));
        }
      });

      // Send welcome
      ws.send(JSON.stringify({
        type: 'welcome',
        server: 'Test Server',
        protocolVersion: '0.4.0'
      }));
    });

    // Start server
    await new Promise<void>((resolve) => {
      server.listen(PORT, () => {
        console.log(`[E2E Test] Server started on port ${PORT}`);
        resolve();
      });
    });

    // Create client
    client = new A2AClient({ url: `ws://localhost:${PORT}` });
    await client.connect();
  });

  afterAll(async () => {
    // Clean up
    client.close();

    await new Promise<void>((resolve) => {
      wss.close(() => {
        server.close(() => {
          resolve();
        });
      });
    });
  });

  it('should complete basic message send and retrieve flow', async () => {
    // Step 1: Send a message
    const message = {
      messageId: randomUUID(),
      role: 'user' as const,
      parts: [
        { kind: 'text' as const, text: 'Hello, A2A server!' }
      ]
    };

    const task = await client.sendMessage(message);

    // Verify task was created
    expect(task).toBeDefined();
    expect((task as any).id).toBeDefined();
    expect((task as any).kind).toBe('task');
    expect((task as any).status.state).toBe('working');

    const taskId = (task as any).id;

    // Step 2: Wait for processing
    await wait(PROCESSING_DELAY_MS);

    // Step 3: Retrieve task status
    const updatedTask = await client.getTask(taskId);

    // Verify task was processed
    expect(updatedTask).toBeDefined();
    expect(updatedTask.id).toBe(taskId);
    expect(updatedTask.status.state).toBe('completed');
    expect(updatedTask.history).toBeDefined();
    expect(updatedTask.history!.length).toBeGreaterThanOrEqual(2); // Original + response
  });

  it('should retrieve agent card', async () => {
    const agentCard = await client.getAgentCard();

    expect(agentCard).toBeDefined();
    expect(agentCard.protocolVersion).toBe('0.4.0');
    expect(agentCard.name).toBe('Test A2A Server');
    expect(agentCard.preferredTransport).toBe('CAPNWEB');
    expect(agentCard.capabilities).toBeDefined();
    expect(agentCard.capabilities?.streaming).toBe(true);
    expect(agentCard.capabilities?.bidirectional).toBe(true);
  });

  it('should list all tasks', async () => {
    // Create a few tasks
    for (let i = 0; i < 3; i++) {
      await client.sendMessage({
        messageId: randomUUID(),
        role: 'user',
        parts: [{ kind: 'text', text: `Test message ${i}` }]
      });
    }

    // List tasks
    const result = await client.listTasks({});

    expect(result).toBeDefined();
    expect(result.tasks).toBeDefined();
    expect(result.tasks.length).toBeGreaterThanOrEqual(3);
    expect(result.total).toBeGreaterThanOrEqual(3);
  });

  it('should cancel a task', async () => {
    // Create a task
    const task = await client.sendMessage({
      messageId: randomUUID(),
      role: 'user',
      parts: [{ kind: 'text', text: 'Task to cancel' }]
    });

    const taskId = (task as any).id;

    // Cancel it immediately (before it completes)
    const canceledTask = await client.cancelTask(taskId);

    expect(canceledTask).toBeDefined();
    expect(canceledTask.id).toBe(taskId);
    expect(canceledTask.status.state).toBe('canceled');
  });

  it('should handle task history retrieval', async () => {
    // Create task with message
    const task = await client.sendMessage({
      messageId: randomUUID(),
      role: 'user',
      parts: [{ kind: 'text', text: 'Test with history' }]
    });

    const taskId = (task as any).id;

    // Wait for processing
    await wait(PROCESSING_DELAY_MS);

    // Get full history
    const fullTask = await client.getTask(taskId);
    expect(fullTask.history).toBeDefined();
    const fullHistoryLength = fullTask.history!.length;

    // Get limited history
    const limitedTask = await client.getTask(taskId, 1);
    expect(limitedTask.history).toBeDefined();
    expect(limitedTask.history!.length).toBe(1);
    expect(limitedTask.history!.length).toBeLessThan(fullHistoryLength);
  });

  it('should handle context ID propagation', async () => {
    const contextId = 'test-context-' + randomUUID();

    // Send message with specific contextId
    const task = await client.sendMessage({
      messageId: randomUUID(),
      contextId,
      role: 'user',
      parts: [{ kind: 'text', text: 'Test context' }]
    });

    expect((task as any).contextId).toBe(contextId);

    // Verify context is maintained
    await wait(PROCESSING_DELAY_MS);
    const retrieved = await client.getTask((task as any).id);
    expect(retrieved.contextId).toBe(contextId);
  });

  it('should filter tasks by contextId', async () => {
    const contextId = 'filter-test-' + randomUUID();

    // Create tasks with specific contextId
    await client.sendMessage({
      messageId: randomUUID(),
      contextId,
      role: 'user',
      parts: [{ kind: 'text', text: 'Task 1' }]
    });

    await client.sendMessage({
      messageId: randomUUID(),
      contextId,
      role: 'user',
      parts: [{ kind: 'text', text: 'Task 2' }]
    });

    // Create task with different contextId
    await client.sendMessage({
      messageId: randomUUID(),
      contextId: 'different-context',
      role: 'user',
      parts: [{ kind: 'text', text: 'Task 3' }]
    });

    // List tasks for specific context
    const result = await client.listTasks({ contextId });

    expect(result.tasks.every(t => t.contextId === contextId)).toBe(true);
    expect(result.tasks.length).toBeGreaterThanOrEqual(2);
  });

  it.skip('should handle errors gracefully', async () => {
    // Try to get non-existent task
    try {
      await client.getTask('non-existent-task-id');
      throw new Error('Should have thrown');
    } catch (error: any) {
      expect(error.message).toContain('Task not found');
    }

    // Try to cancel non-existent task
    try {
      await client.cancelTask('non-existent-task-id');
      throw new Error('Should have thrown');
    } catch (error: any) {
      expect(error.message).toContain('Task not found');
    }
  });
});
