/**
 * A2A CapnWeb Server Entry Point
 *
 * HTTP server with WebSocket upgrade for capnweb RPC sessions
 * Serves AgentCard at /.well-known/agent.json
 */

import { createServer, IncomingMessage } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import pino from 'pino';
import { A2AService } from './a2a-service.js';
import { AuthenticationService } from './authentication-service.js';
import { SessionManager } from './session-manager.js';

const log = pino({ name: 'a2a-server' });

const HOST = process.env.HOST || '0.0.0.0';
const PORT = parseInt(process.env.PORT || '3000', 10);
const SESSION_TIMEOUT = parseInt(process.env.SESSION_TIMEOUT || '3600000', 10); // 1 hour
const AGENT_URL = process.env.AGENT_URL || `http://${HOST}:${PORT}`;
const authService = new AuthenticationService({
  jwtSecret: process.env.JWT_SECRET || 'super-secret-jwt-key-for-development-only-change-in-production!!'
});

const HOST = process.env.HOST || '0.0.0.0';
const PORT = parseInt(process.env.PORT || '3000');
const SESSION_TIMEOUT = parseInt(process.env.SESSION_TIMEOUT || '3600000'); // 1 hour
const AGENT_URL = process.env.AGENT_URL || `http://${HOST}:${PORT}`;
const authService = new AuthenticationService();
const sessionManager = new SessionManager({
  sessionTimeout: SESSION_TIMEOUT
});

/**
 * Create A2A service instance
 */
const a2aService = new A2AService({
  agentName: process.env.AGENT_NAME || 'A2A CapnWeb Server',
  agentDescription: process.env.AGENT_DESCRIPTION || 'A2A protocol server using capnweb transport',
  agentUrl: AGENT_URL,
  protocolVersion: '0.4.0'
}, authService);

/**
 * HTTP server for AgentCard, Authentication, and WebSocket upgrade
 */
const server = createServer(async (req, res) => {
  log.info({ method: req.method, url: req.url }, 'HTTP request');

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type'
  };

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  // Serve AgentCard at /.well-known/agent.json
  if (req.url === '/.well-known/agent.json') {
    const agentCard = a2aService.getAgentCard();

    res.writeHead(200, {
      'Content-Type': 'application/json',
      ...corsHeaders
    });
    res.end(JSON.stringify(agentCard, null, 2));
    return;
  }

  // Authentication endpoint (POST /a2a/auth)
  if (req.url === '/a2a/auth' && req.method === 'POST') {
    try {
      // Extract Authorization header
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        res.writeHead(401, {
          'Content-Type': 'application/json',
          'WWW-Authenticate': 'Bearer realm="a2a"',
          ...corsHeaders
        });
        res.end(
          JSON.stringify({
            error: 'UNAUTHORIZED',
            message: 'Missing Authorization header'
          })
        );
        return;
      }

      // Parse authorization header
      const [scheme, token] = authHeader.split(' ');

      if (scheme.toLowerCase() !== 'bearer') {
        res.writeHead(401, {
          'Content-Type': 'application/json',
          ...corsHeaders
        });
        res.end(
          JSON.stringify({
            error: 'UNAUTHORIZED',
            message: 'Only Bearer authentication supported'
          })
        );
        return;
      }

      // Authenticate
      const authResult = await authService.authenticate(
        { type: 'bearer', token },
        {
          ipAddress: req.socket.remoteAddress,
          userAgent: req.headers['user-agent']
        }
      );

      if (!authResult.authenticated) {
        res.writeHead(401, {
          'Content-Type': 'application/json',
          ...corsHeaders
        });
        res.end(
          JSON.stringify({
            error: 'UNAUTHORIZED',
            message: authResult.metadata?.error || 'Invalid or expired token'
          })
        );
        return;
      }

      // Create session
      const session = await sessionManager.createSession({
        userId: authResult.userId!,
        permissions: authResult.permissions || [],
        metadata: {
          ipAddress: req.socket.remoteAddress,
          userAgent: req.headers['user-agent']
        }
      });

      // Return session info
      res.writeHead(200, {
        'Content-Type': 'application/json',
        ...corsHeaders
      });
      res.end(
        JSON.stringify({
          sessionId: session.id,
          expiresIn: SESSION_TIMEOUT,
          userId: authResult.userId,
          permissions: authResult.permissions
        })
      );
    } catch (error: any) {
      log.error({ error: error.message }, 'Authentication endpoint error');

      // Distinguish authentication errors (401) from internal errors (500)
      const isAuthError = error.message?.includes('UNAUTHORIZED') ||
                          error.message?.includes('Invalid') ||
                          error.message?.includes('expired') ||
                          error.code === 'UNAUTHORIZED';

      const statusCode = isAuthError ? 401 : 500;
      const headers: any = {
        'Content-Type': 'application/json',
        ...corsHeaders
      };

      // Add WWW-Authenticate header for 401 responses
      if (isAuthError) {
        headers['WWW-Authenticate'] = 'Bearer realm="a2a", error="invalid_token"';
      }

      res.writeHead(statusCode, headers);
      res.end(
        JSON.stringify({
          error: isAuthError ? 'UNAUTHORIZED' : 'INTERNAL_ERROR',
          message: isAuthError ? error.message : 'Authentication failed'
        })
      );
    }
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
      authEndpoint: `${AGENT_URL}/a2a/auth`,
      websocket: `ws://${HOST}:${PORT}`,
      status: 'running'
    };

    res.writeHead(200, {
      'Content-Type': 'application/json',
      ...corsHeaders
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
      tasks: a2aService.getTaskManager().getTaskCount(),
      sessions: sessionManager.getSessionCount()
    };

    res.writeHead(200, {
      'Content-Type': 'application/json'
    });
    res.end(JSON.stringify(health));
    return;
  }

  // 404 for other endpoints
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found\n\nEndpoints:\n- / (server info)\n- /.well-known/agent.json (AgentCard)\n- POST /a2a/auth (authentication)\n- /health (health check)\n- ws:// (WebSocket for RPC)\n');
});

/**
 * WebSocket server for capnweb RPC
 */
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  log.info({ remoteAddress: req.socket.remoteAddress }, 'WebSocket connection');

  // Session tracking for this WebSocket connection
  let authenticatedService: any = null;
  let sessionId: string | null = null;

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
      log.debug({ method: request.method }, 'RPC request');

      let response: any;

      // Public methods that don't require authentication
      if (request.method === 'getAgentCard') {
        response = a2aService.getAgentCard();
        ws.send(JSON.stringify({
          id: request.id,
          result: response
        }));
        return;
      }

      // Authentication method to establish session
      if (request.method === 'authenticate') {
        const sessionIdParam = request.params?.sessionId;

        if (!sessionIdParam) {
          throw Object.assign(new Error('Missing sessionId parameter'), { code: 'UNAUTHORIZED' });
        }

        const session = await sessionManager.validateSession(sessionIdParam);

        if (!session) {
          throw Object.assign(new Error('Invalid or expired session'), { code: 'UNAUTHORIZED' });
        }

        // Extend session to keep it alive
        await sessionManager.extendSession(sessionIdParam, SESSION_TIMEOUT);

        // Create authenticated service for this session
        authenticatedService = a2aService.createAuthenticatedService(
          session.userId,
          session.permissions
        );
        sessionId = sessionIdParam;

        log.info({ sessionId, userId: session.userId }, 'WebSocket authenticated');

        ws.send(JSON.stringify({
          id: request.id,
          result: { authenticated: true, userId: session.userId }
        }));
        return;
      }

      // All other methods require authentication
      if (!authenticatedService || !sessionId) {
        throw Object.assign(new Error('Authentication required. Call authenticate method first.'), { code: 'UNAUTHORIZED' });
      }

      // Validate session is still active
      const session = await sessionManager.validateSession(sessionId);
      if (!session) {
        authenticatedService = null;
        sessionId = null;
        throw Object.assign(new Error('Session expired. Please re-authenticate.'), { code: 'UNAUTHORIZED' });
      }

      // Extend session to keep it alive with activity
      await sessionManager.extendSession(sessionId, SESSION_TIMEOUT);

      // Dispatch to authenticated service
      switch (request.method) {
        case 'sendMessage':
          response = await authenticatedService.sendMessage(
            request.params.message,
            request.params.config
          );
          break;

        case 'getTask':
          response = await authenticatedService.getTask(
            request.params.taskId,
            request.params.historyLength
          );
          break;

        case 'listTasks':
          response = await authenticatedService.listTasks(request.params);
          break;

        case 'cancelTask':
          response = await authenticatedService.cancelTask(request.params.taskId);
          break;

        default:
          throw new Error(`Unknown method: ${request.method}`);
      }

      ws.send(JSON.stringify({
        id: request.id,
        result: response
      }));

    } catch (error: any) {
      log.error({ error: error.message, requestId }, 'RPC error');

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
    log.info({ code, reason: reason.toString() }, 'WebSocket connection closed');
  });

  ws.on('error', (error) => {
    log.error({ error: error.message }, 'WebSocket error');
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
  log.info({ host: HOST, port: PORT, agentUrl: AGENT_URL }, 'A2A CapnWeb Server started');

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
  log.info('SIGTERM received, initiating graceful shutdown');

  wss.close(() => {
    log.info('WebSocket server closed');
  });

  server.close(() => {
    log.info('HTTP server closed - exiting');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    log.error({ timeoutSec: 10 }, 'Forced shutdown after timeout');
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
