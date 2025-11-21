import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { pathToFileURL } from 'url';
import { WebSocketServer } from 'ws';
import pino, { type Logger } from 'pino';
import { A2AService } from './a2a-service';
import { AuthenticationService } from './authentication-service';
import { SessionManager } from './session-manager';

export interface StandaloneServerConfig {
  host?: string;
  port?: number;
  agentUrl?: string;
  jwtSecret?: string;
  jwtIssuer?: string;
  jwtAudience?: string;
  sessionTimeout?: number;
  logger?: Logger;
}

export interface StandaloneServerRuntime {
  server: ReturnType<typeof createServer>;
  wss: WebSocketServer;
  a2aService: A2AService;
  sessionManager: SessionManager;
  authService: AuthenticationService;
  config: Required<Omit<StandaloneServerConfig, 'logger'>> & { logger: Logger };
}

function resolveConfig(config: StandaloneServerConfig): Required<Omit<StandaloneServerConfig, 'logger'>> & { logger: Logger } {
  const host = config.host ?? process.env.HOST ?? '0.0.0.0';
  const port = config.port ?? parseInt(process.env.PORT || '8080', 10);

  const resolved: Required<Omit<StandaloneServerConfig, 'logger'>> & { logger: Logger } = {
    host,
    port,
    agentUrl: config.agentUrl ?? process.env.AGENT_URL ?? `http://${host}:${port}`,
    jwtSecret: config.jwtSecret ?? process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
    jwtIssuer: config.jwtIssuer ?? process.env.JWT_ISSUER ?? 'a2a-webcap',
    jwtAudience: config.jwtAudience ?? process.env.JWT_AUDIENCE ?? 'a2a-api',
    sessionTimeout: config.sessionTimeout ?? parseInt(process.env.SESSION_TIMEOUT || '3600', 10),
    logger: config.logger ?? pino({ name: 'a2a-server' })
  };

  if (process.env.NODE_ENV === 'production' && resolved.jwtSecret === 'dev-secret-change-in-production') {
    throw new Error(
      'SECURITY ERROR: Default JWT secret detected in production environment. ' +
        'Please set JWT_SECRET environment variable to a secure random value.'
    );
  }

  return resolved;
}

export function createStandaloneServer(config: StandaloneServerConfig = {}): StandaloneServerRuntime {
  const resolved = resolveConfig(config);

  const authService = new AuthenticationService({
    jwtSecret: resolved.jwtSecret,
    jwtIssuer: resolved.jwtIssuer,
    jwtAudience: resolved.jwtAudience
  });

  const sessionManager = new SessionManager({
    sessionTimeout: resolved.sessionTimeout
  });

  const a2aService = new A2AService(
    {
      agentName: process.env.AGENT_NAME || 'A2A CapnWeb Server',
      agentDescription: process.env.AGENT_DESCRIPTION || 'A2A protocol server using capnweb transport',
      agentUrl: resolved.agentUrl,
      protocolVersion: '0.4.0'
    },
    authService
  );

  const server = createServer(async (req, res) =>
    httpHandler({ req, res, a2aService, sessionManager, authService, resolved })
  );

  const wss = new WebSocketServer({ server });
  wireWebSocketServer({ wss, sessionManager, a2aService, resolved });

  return { server, wss, a2aService, sessionManager, authService, config: resolved };
}

function httpHandler({
  req,
  res,
  a2aService,
  sessionManager,
  authService,
  resolved
}: {
  req: IncomingMessage;
  res: ServerResponse;
  a2aService: A2AService;
  sessionManager: SessionManager;
  authService: AuthenticationService;
  resolved: Required<Omit<StandaloneServerConfig, 'logger'>> & { logger: Logger };
}) {
  const { logger } = resolved;
  logger.info({ method: req.method, url: req.url }, 'HTTP request');

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type'
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  if (req.url === '/.well-known/agent.json') {
    const agentCard = a2aService.getAgentCard();

    res.writeHead(200, {
      'Content-Type': 'application/json',
      ...corsHeaders
    });
    res.end(JSON.stringify(agentCard, null, 2));
    return;
  }

  if (req.url === '/a2a/auth' && req.method === 'POST') {
    handleAuthRequest({ req, res, authService, sessionManager, resolved, corsHeaders });
    return;
  }

  if (req.url === '/') {
    const info = {
      name: 'A2A CapnWeb Server',
      version: '0.1.0',
      protocolVersion: '0.4.0',
      transport: 'capnweb',
      agentCard: `${resolved.agentUrl}/.well-known/agent.json`,
      authEndpoint: `${resolved.agentUrl}/a2a/auth`,
      websocket: `ws://${resolved.host}:${resolved.port}`,
      status: 'running'
    };

    res.writeHead(200, {
      'Content-Type': 'application/json',
      ...corsHeaders
    });
    res.end(JSON.stringify(info, null, 2));
    return;
  }

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

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found\n\nEndpoints:\n- / (server info)\n- /.well-known/agent.json (AgentCard)\n- POST /a2a/auth (authentication)\n- /health (health check)\n- ws:// (WebSocket for RPC)\n');
}

function handleAuthRequest({
  req,
  res,
  authService,
  sessionManager,
  resolved,
  corsHeaders
}: {
  req: IncomingMessage;
  res: ServerResponse;
  authService: AuthenticationService;
  sessionManager: SessionManager;
  resolved: Required<Omit<StandaloneServerConfig, 'logger'>> & { logger: Logger };
  corsHeaders: Record<string, string>;
}) {
  const { logger } = resolved;
  (async () => {
    try {
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

      const session = await sessionManager.createSession({
        userId: authResult.userId!,
        permissions: authResult.permissions || [],
        metadata: {
          ipAddress: req.socket.remoteAddress,
          userAgent: req.headers['user-agent']
        }
      });

      res.writeHead(200, {
        'Content-Type': 'application/json',
        ...corsHeaders
      });
      res.end(
        JSON.stringify({
          sessionId: session.id,
          expiresIn: resolved.sessionTimeout,
          userId: authResult.userId,
          permissions: authResult.permissions
        })
      );
    } catch (error: any) {
      logger.error({ error: error.message }, 'Authentication endpoint error');

      const isAuthError =
        error.message?.includes('UNAUTHORIZED') ||
        error.message?.includes('Invalid') ||
        error.message?.includes('expired') ||
        error.code === 'UNAUTHORIZED';

      const statusCode = isAuthError ? 401 : 500;
      const headers: any = {
        'Content-Type': 'application/json',
        ...corsHeaders
      };

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
  })();
}

function wireWebSocketServer({
  wss,
  sessionManager,
  a2aService,
  resolved
}: {
  wss: WebSocketServer;
  sessionManager: SessionManager;
  a2aService: A2AService;
  resolved: Required<Omit<StandaloneServerConfig, 'logger'>> & { logger: Logger };
}) {
  const { logger } = resolved;

  wss.on('connection', (ws, req) => {
    logger.info({ remoteAddress: req.socket.remoteAddress }, 'WebSocket connection');

    let authenticatedService: any = null;
    let sessionId: string | null = null;

    ws.on('message', async (data) => {
      const requestId = (() => {
        try {
          return JSON.parse(data.toString()).id;
        } catch {
          return undefined;
        }
      })();

      try {
        const request = JSON.parse(data.toString());
        logger.debug({ method: request.method }, 'RPC request');

        let response: any;

        if (request.method === 'getAgentCard') {
          response = a2aService.getAgentCard();
          ws.send(
            JSON.stringify({
              id: request.id,
              result: response
            })
          );
          return;
        }

        if (request.method === 'authenticate') {
          const sessionIdParam = request.params?.sessionId;

          if (!sessionIdParam) {
            throw Object.assign(new Error('Missing sessionId parameter'), { code: 'UNAUTHORIZED' });
          }

          const session = await sessionManager.validateSession(sessionIdParam);

          if (!session) {
            throw Object.assign(new Error('Invalid or expired session'), { code: 'UNAUTHORIZED' });
          }

          await sessionManager.extendSession(sessionIdParam, resolved.sessionTimeout);

          authenticatedService = a2aService.createAuthenticatedService(session.userId, session.permissions);
          sessionId = sessionIdParam;

          logger.info({ sessionId, userId: session.userId }, 'WebSocket authenticated');

          ws.send(
            JSON.stringify({
              id: request.id,
              result: { authenticated: true, userId: session.userId }
            })
          );
          return;
        }

        if (!authenticatedService || !sessionId) {
          throw Object.assign(new Error('Authentication required. Call authenticate method first.'), {
            code: 'UNAUTHORIZED'
          });
        }

        const session = await sessionManager.validateSession(sessionId);
        if (!session) {
          authenticatedService = null;
          sessionId = null;
          throw Object.assign(new Error('Session expired. Please re-authenticate.'), { code: 'UNAUTHORIZED' });
        }

        await sessionManager.extendSession(sessionId, resolved.sessionTimeout);

        switch (request.method) {
          case 'sendMessage':
            response = await authenticatedService.sendMessage(request.params.message, request.params.config);
            break;
          case 'getTask':
            response = await authenticatedService.getTask(request.params.taskId, request.params.historyLength);
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

        ws.send(
          JSON.stringify({
            id: request.id,
            result: response
          })
        );
      } catch (error: any) {
        logger.error({ error: error.message, requestId }, 'RPC error');

        ws.send(
          JSON.stringify({
            id: requestId,
            error: {
              code: error.code || 'INTERNAL_ERROR',
              message: error.message
            }
          })
        );
      }
    });

    ws.on('close', (code, reason) => {
      logger.info({ code, reason: reason.toString() }, 'WebSocket connection closed');
    });

    ws.on('error', (error) => {
      logger.error({ error: error.message }, 'WebSocket error');
    });

    ws.send(
      JSON.stringify({
        type: 'welcome',
        server: 'A2A CapnWeb Server',
        protocolVersion: '0.4.0',
        transport: 'capnweb-simple'
      })
    );
  });
}

export function startStandaloneServer(config: StandaloneServerConfig = {}): Promise<StandaloneServerRuntime> {
  const runtime = createStandaloneServer(config);

  return new Promise((resolve) => {
    runtime.server.listen(runtime.config.port, runtime.config.host, () => {
      runtime.config.logger.info(
        { host: runtime.config.host, port: runtime.config.port, agentUrl: runtime.config.agentUrl },
        'A2A CapnWeb Server started'
      );

      console.log('\n========================================');
      console.log('🚀 A2A CapnWeb Server Running');
      console.log('========================================');
      console.log(`Server:      http://${runtime.config.host}:${runtime.config.port}`);
      console.log(`AgentCard:   ${runtime.config.agentUrl}/.well-known/agent.json`);
      console.log(`WebSocket:   ws://${runtime.config.host}:${runtime.config.port}`);
      console.log(`Health:      http://${runtime.config.host}:${runtime.config.port}/health`);
      console.log('========================================\n');

      resolve(runtime);
    });
  });
}

const isDirectRun = pathToFileURL(process.argv[1] || '').href === import.meta.url;

if (isDirectRun) {
  startStandaloneServer();
}
