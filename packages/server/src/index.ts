/**
 * A2A CapnWeb Server Entry Point
 *
 * HTTP server with WebSocket upgrade for capnweb RPC sessions
 * Serves AgentCard at /.well-known/agent.json
 */

import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import pino from 'pino';
import { A2AService } from './a2a-service';

const log = pino({ name: 'a2a-server' });

// Server configuration from environment
const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = process.env.HOST || '0.0.0.0';
const AGENT_URL = process.env.AGENT_URL || `http://localhost:${PORT}`;

/**
 * Create A2A service instance
 */
const a2aService = new A2AService({
  agentName: process.env.AGENT_NAME || 'A2A CapnWeb Server',
  agentDescription: process.env.AGENT_DESCRIPTION || 'A2A protocol server using capnweb transport',
  agentUrl: AGENT_URL,
  protocolVersion: '0.4.0'
});

/**
 * HTTP server for AgentCard and WebSocket upgrade
 */
const server = createServer((req, res) => {
  log.info('HTTP request', { method: req.method, url: req.url });

  // Serve AgentCard at /.well-known/agent.json
  if (req.url === '/.well-known/agent.json') {
    const agentCard = a2aService.getAgentCard();

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(agentCard, null, 2));
    return;
  }

  // Root endpoint info
  if (req.url === '/') {
    const info = {
      name: 'A2A CapnWeb Server',
      version: '0.1.0',
      protocolVersion: '0.4.0',
      transport: 'capnweb',
      agentCard: `${AGENT_URL}/.well-known/agent.json`,
      websocket: `ws://${HOST}:${PORT}`,
      status: 'running'
    };

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(info, null, 2));
    return;
  }

  // Health check endpoint
  if (req.url === '/health') {
    const health = {
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      tasks: a2aService.getTaskManager().getTaskCount()
    };

    res.writeHead(200, {
      'Content-Type': 'application/json'
    });
    res.end(JSON.stringify(health));
    return;
  }

  // 404 for other endpoints
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found\n\nEndpoints:\n- / (server info)\n- /.well-known/agent.json (AgentCard)\n- /health (health check)\n- ws:// (WebSocket for RPC)\n');
});

/**
 * WebSocket server for capnweb RPC
 */
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  log.info('WebSocket connection established', {
    remoteAddress: req.socket.remoteAddress
  });

  // TODO: Replace simple JSON-RPC with proper capnweb RPC session once WebSocket adapter is ready
  // Current implementation uses basic JSON-RPC for MVP (Phase 1)
  // Phase 2 will integrate full capnweb transport layer

  ws.on('message', async (data) => {
    // Parse request ID early for error handling
    const requestId = (() => {
      try {
        return JSON.parse(data.toString()).id;
      } catch {
        return undefined;
      }
    })();

    try {
      const request = JSON.parse(data.toString());
      log.debug('RPC request', { method: request.method });

      let response: any;

      // Simple RPC dispatch (MVP implementation)
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
      log.error('RPC error', { error: error.message });

      ws.send(JSON.stringify({
        id: requestId,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message
        }
      }));
    }
  });

  ws.on('close', (code, reason) => {
    log.info('WebSocket connection closed', {
      code,
      reason: reason.toString()
    });
  });

  ws.on('error', (error) => {
    log.error('WebSocket error', { error });
  });

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'welcome',
    server: 'A2A CapnWeb Server',
    protocolVersion: '0.4.0',
    transport: 'capnweb-simple'
  }));
});

/**
 * Start server
 */
server.listen(PORT, HOST, () => {
  log.info('A2A CapnWeb Server started', {
    port: PORT,
    host: HOST,
    agentUrl: AGENT_URL,
    agentCard: `${AGENT_URL}/.well-known/agent.json`,
    websocket: `ws://${HOST}:${PORT}`
  });

  console.log('\n========================================');
  console.log('🚀 A2A CapnWeb Server Running');
  console.log('========================================');
  console.log(`Server:      http://${HOST}:${PORT}`);
  console.log(`AgentCard:   ${AGENT_URL}/.well-known/agent.json`);
  console.log(`WebSocket:   ws://${HOST}:${PORT}`);
  console.log(`Health:      http://${HOST}:${PORT}/health`);
  console.log('========================================\n');
});

/**
 * Graceful shutdown
 */
process.on('SIGTERM', () => {
  log.info('SIGTERM received, shutting down gracefully');

  wss.close(() => {
    log.info('WebSocket server closed');
  });

  server.close(() => {
    log.info('HTTP server closed');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    log.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
});

process.on('SIGINT', () => {
  log.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

/**
 * Export for testing
 */
export { server, wss, a2aService };
