/**
 * Cloudflare Workers A2A Server Entry Point
 * 
 * This is the main entry point for running the A2A server on Cloudflare Workers
 * It handles HTTP requests and WebSocket connections using Workers APIs
 */

import { A2AService } from './a2a-service-worker.js';
import { createLogger} from '../../shared/dist/logger'

const log = createLogger('a2a-worker');

export interface Env {
  // Environment variables
  JWT_SECRET?: string;
  SESSION_TIMEOUT?: string;
  AGENT_URL?: string;
  AGENT_NAME?: string;
  AGENT_DESCRIPTION?: string;

  // KV namespaces
  A2A_SESSIONS?: KVNamespace;
  A2A_TASKS?: KVNamespace;

  // Durable Objects
  A2A_SESSIONS_DO?: DurableObjectNamespace;
}

/**
 * Main request handler for Cloudflare Workers
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    log.info('Received request', { method: request.method, url: url.toString() });

    // Initialize A2A Service
    const a2aService = new A2AService({
      agentName: env.AGENT_NAME,
      agentDescription: env.AGENT_DESCRIPTION,
      agentUrl: env.AGENT_URL || url.origin,
      protocolVersion: '0.4.0'
    });

    try {
      // Handle WebSocket upgrade requests
      if (request.headers.get('Upgrade') === 'websocket') {
        return handleWebSocket(request, env, ctx, a2aService);
      }

      // Handle HTTP requests
      switch (url.pathname) {
        case '/.well-known/agent.json':
          return handleAgentCard(env, a2aService);

        case '/health':
          return handleHealth();

        case '/':
          return handleRoot();

        default:
          return new Response('Not Found', { status: 404 });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      log.error('Request handling error', { error: errorMessage, stack: errorStack });
      return new Response('Internal Server Error', { status: 500 });
    }
  }
};

/**
 * Handle WebSocket connections for A2A RPC
 */
async function handleWebSocket(request: Request, env: Env, ctx: ExecutionContext, a2aService: A2AService): Promise<Response> {
  // This is a placeholder - actual WebSocket handling would require Durable Objects
  // for stateful connections in Cloudflare Workers
  return new Response('WebSocket support requires Durable Objects', { status: 501 });
}

/**
 * Handle AgentCard request
 */
async function handleAgentCard(env: Env, a2aService: A2AService): Promise<Response> {
  const agentCard = a2aService.getAgentCard();

  return new Response(JSON.stringify(agentCard, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

/**
 * Handle health check
 */
async function handleHealth(): Promise<Response> {
  return new Response(JSON.stringify({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'a2a-webcap-worker'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Handle root path
 */
async function handleRoot(): Promise<Response> {
  return new Response('A2A WebCap Server running on Cloudflare Workers', {
    headers: { 'Content-Type': 'text/plain' }
  });
}
