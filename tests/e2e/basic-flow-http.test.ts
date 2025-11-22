/**
 * End-to-End Test - Basic A2A Flow (HTTP Version)
 *
 * Tests the complete client-server interaction using HTTP:
 * 1. Server starts
 * 2. Client connects via HTTP
 * 3. Client sends message
 * 4. Task is created and processed
 * 5. Client retrieves task status
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { A2AService } from '../../src/a2a-service-worker';
import { A2AClient } from '../../../client/src/a2a-client-http';
import { createTestMessage } from '../utils';

// Simple wait function for tests
function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Time to wait for async task processing
const PROCESSING_DELAY_MS = 200;

describe('End-to-End: Basic A2A Flow (HTTP)', () => {
  let a2aService: A2AService;
  let client: A2AClient;
  const PORT = 8181; // Use different port for testing
  const BASE_URL = `http://localhost:${PORT}`;

  // Simple HTTP test server
  let testServer: any;

  beforeAll(async () => {
    // Create A2A service
    a2aService = new A2AService({
      agentName: 'Test A2A Server',
      agentUrl: BASE_URL,
      protocolVersion: '0.4.0'
    });

    // Create simple HTTP server for testing
    testServer = createTestServer();

    // Set up handlers for A2A protocol endpoints
    testServer.addHandler('/.well-known/agent.json', async () => {
      const agentCard = a2aService.getAgentCard();
      return new Response(JSON.stringify(agentCard), {
        headers: { 'Content-Type': 'application/json' }
      });
    });

    testServer.addHandler('/messages', async (req) => {
      if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }

      const body = await req.json();
      const task = await a2aService.sendMessage(body.message, body.config);
      return new Response(JSON.stringify(task), {
        headers: { 'Content-Type': 'application/json' }
      });
    });

    testServer.addHandler('/tasks', async (req) => {
      const url = new URL(req.url);
      const params = Object.fromEntries(url.searchParams.entries());
      const taskList = await a2aService.listTasks({
        contextId: params.contextId,
        limit: params.limit ? parseInt(params.limit) : undefined,
        offset: params.offset ? parseInt(params.offset) : undefined
      });
      return new Response(JSON.stringify(taskList), {
        headers: { 'Content-Type': 'application/json' }
      });
    });

    testServer.addHandler('/tasks/', async (req) => {
      const url = new URL(req.url);
      const pathParts = url.pathname.split('/');
      const taskId = pathParts[pathParts.length - 1];

      // Handle both /tasks/{id} and /tasks/{id}/ patterns
      if (!taskId || taskId === 'tasks') {
        // This is /tasks or /tasks/ - handle as list endpoint
        if (req.method === 'GET') {
          const params = Object.fromEntries(url.searchParams.entries());
          const taskList = await a2aService.listTasks({
            contextId: params.contextId,
            limit: params.limit ? parseInt(params.limit) : undefined,
            offset: params.offset ? parseInt(params.offset) : undefined
          });
          return new Response(JSON.stringify(taskList), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return new Response('Method not allowed', { status: 405 });
      }

      if (req.method === 'DELETE') {
        const cancelledTask = await a2aService.cancelTask(taskId);
        return new Response(JSON.stringify(cancelledTask), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (req.method === 'GET') {
        const historyLength = url.searchParams.get('historyLength');
        const task = await a2aService.getTask(taskId, historyLength ? parseInt(historyLength) : undefined);
        if (!task) {
          return new Response('Task not found', { status: 404 });
        }
        return new Response(JSON.stringify(task), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response('Method not allowed', { status: 405 });
    });

    testServer.addHandler('/health', async () => {
      return new Response(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'a2a-test-server'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    });

    httpServer = await startTestServer(testServer, PORT);

    // Create HTTP client
    client = new A2AClient({
      url: BASE_URL,
      timeout: 5000
    });
  });

  afterAll(async () => {
    await stopTestServer();
  });

  it('should retrieve agent card', async () => {
    const agentCard = await client.getAgentCard();

    expect(agentCard).toBeDefined();
    expect(agentCard.protocolVersion).toBe('0.4.0');
    expect(agentCard.name).toBe('Test A2A Server');
    expect(agentCard.capabilities).toBeDefined();
    expect(agentCard.capabilities?.streaming).toBe(true);
    expect(agentCard.capabilities?.taskManagement).toBe(true);
  });

  it('should send message and create task', async () => {
    const message = createTestMessage('Hello A2A Server');

    const task = await client.sendMessage(message);

    expect(task).toBeDefined();
    expect(task.id).toBeDefined();
    expect(task.status).toBeDefined();
    expect(task.status.state).toBeDefined();
    expect(task.history).toBeDefined();
    expect(task.history?.length).toBeGreaterThan(0);
  });

  it('should retrieve task by ID', async () => {
    const message = createTestMessage('Test task retrieval');
    const createdTask = await client.sendMessage(message);

    // Wait a bit for processing
    await wait(PROCESSING_DELAY_MS);

    const retrievedTask = await client.getTask(createdTask.id);

    expect(retrievedTask).toBeDefined();
    expect(retrievedTask.id).toBe(createdTask.id);
    expect(retrievedTask.status).toBeDefined();
  });

  it('should list tasks', async () => {
    // Create a few tasks
    const message1 = createTestMessage('First test message');
    const message2 = createTestMessage('Second test message');

    await client.sendMessage(message1);
    await client.sendMessage(message2);

    // Wait for processing
    await wait(PROCESSING_DELAY_MS);

    const taskList = await client.listTasks({ limit: 10 });

    expect(taskList).toBeDefined();
    expect(taskList.tasks).toBeDefined();
    expect(Array.isArray(taskList.tasks)).toBe(true);
    expect(taskList.tasks.length).toBeGreaterThan(0);
  });

  it('should cancel task', async () => {
    const message = createTestMessage('Task to be cancelled');
    const task = await client.sendMessage(message);

    const cancelledTask = await client.cancelTask(task.id);

    expect(cancelledTask).toBeDefined();
    expect(cancelledTask.id).toBe(task.id);
    expect(cancelledTask.status.state).toBe('canceled');
  });

  it('should handle health check', async () => {
    const health = await client.health();

    expect(health).toBeDefined();
    expect(health.status).toBe('healthy');
    expect(health.timestamp).toBeDefined();
    expect(health.service).toBeDefined();
  });

  it('should handle errors gracefully', async () => {
    // Try to get a non-existent task
    await expect(client.getTask('non-existent-task-id')).rejects.toThrow();
  });

  it('should maintain context ID across messages', async () => {
    const contextId = 'test-context-123';
    const message1 = createTestMessage('First message', { contextId });
    const message2 = createTestMessage('Second message', { contextId });

    const task1 = await client.sendMessage(message1);
    const task2 = await client.sendMessage(message2);

    expect(task1.contextId).toBe(contextId);
    expect(task2.contextId).toBe(contextId);
  });
});

// Simple HTTP test server implementation
let httpServer: any;

function createTestServer() {
  const handlers = new Map<string, (req: Request) => Promise<Response>>();

  return {
    addHandler: (path: string, handler: (req: Request) => Promise<Response>) => {
      handlers.set(path, handler);
    },

    handleRequest: async (req: Request) => {
      const url = new URL(req.url);
      const handler = handlers.get(url.pathname) || handlers.get(`${url.pathname}/`);

      if (handler) {
        return handler(req);
      }

      return new Response('Not Found', { status: 404 });
    }
  };
}

async function startTestServer(server: any, port: number) {
  // Simple HTTP server implementation for testing
  const http = await import('node:http');
  httpServer = http.createServer(async (req: any, res: any) => {
    let body = '';
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      req.on('data', (chunk: any) => body += chunk);
      await new Promise(resolve => req.on('end', resolve));
    }

    const request = new Request(`http://localhost:${port}${req.url}`, {
      method: req.method,
      headers: req.headers,
      body: body || undefined
    });

    const response = await server.handleRequest(request);

    res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    res.end(await response.text());
  });

await new Promise<void>((resolve) => {
    httpServer.listen(port, resolve);
  });
}

async function stopTestServer() {
  if (httpServer) {
    return new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  }
}
