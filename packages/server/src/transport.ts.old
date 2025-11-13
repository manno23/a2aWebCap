import { RpcTarget, newWebWorkerSocketRpcSession, PromptRequest, PromptResponse, Prompt, RpcStub } from '@a2a-webcap/shared';

// A simple, standalone A2A agent implementation that will be served via Capnweb.
// It is structurally compatible with the `Agent` interface from the ACP SDK.
class A2AService extends RpcTarget {
  
  // Keep track of the connection for sending updates
  private _connection: RpcStub<any>; // In a real app, you'd use a proper type for the client-side connection stub

  constructor(connection: RpcStub<any>) {
    super();
    this._connection = connection;
    console.log('[Server] A2A Service Initialized.');
  }

  // --- Stubbed Agent Methods ---

  async initialize() {
    console.log('[Server] initialize called');
    return {
      protocolVersion: 1,
      agentCapabilities: { loadSession: false, mcpCapabilities: {http: false, sse: false}, promptCapabilities: {embeddedContext: false, image: false} },
      authMethods: [],
      _meta: {},
    };
  }

  async newSession(params: any) {
    console.log('[Server] newSession called with:', params);
    const sessionId = crypto.randomUUID();
    return {
      sessionId,
      models: { availableModels: [], currentModelId: '' },
      modes: { availableModes: [], currentModeId: '' },
      _meta: {},
    };
  }
  
  async loadSession(params: any) {
    console.log('[Server] loadSession called with:', params);
    return {
      sessionId: params.sessionId,
      models: { availableModels: [], currentModelId: '' },
      modes: { availableModes: [], currentModeId: '' },
      _meta: {},
    };
  }

  async setSessionModel(params: any) {
    console.log('[Server] setSessionModel called with:', params);
    return { _meta: {} };
  }

  async setSessionMode(params: any) {
    console.log('[Server] setSessionMode called with:', params);
  }

  async prompt(params: PromptRequest): Promise<PromptResponse> {
    const inputText = params.prompt.filter((p: Prompt) => p.type === 'text').map((p: any) => p.text).join(' ');
    console.log(`[Server] Received prompt: "${inputText}"`);

    // Simulate an echo response
    const responseText = `Server echo: "${inputText}"`;
    
    // In a real agent, you would stream updates back.
    // For this stub, we'll just log it.
    console.log(`[Server] Sending response: "${responseText}"`);

    // The ACP SDK expects a specific response structure.
    // We are fulfilling that contract here.
    return {
      stopReason: 'end_turn',
      _meta: {},
    };
  }

  async cancel(params: any) {
    console.log('[Server] cancel called with:', params);
  }
  
  async authenticate(params: any) {
    console.log('[Server] authenticate called with:', params);
    throw new Error('Authentication not implemented');
  }
}

// --- Server Setup ---

const server = Bun.serve({
  port: 8080,
  fetch(req, server) {
    // Upgrade the request to a WebSocket connection for capnweb
    if (server.upgrade(req)) {
      return;
    }
    return new Response('Upgrade failed', { status: 500 });
  },
  websocket: {
    async open(ws) {
      console.log('[Server] WebSocket connection opened.');
      // Use newWebSocketRpcResponse to handle the RPC session over the WebSocket
      newWorkerWebSocketRpcResponse(ws, (client: RpcStub<any>) => new A2AService(client));
    },
    message(_ws, _message) {},
    close(_ws, code, reason) {
      console.log('[Server] WebSocket connection closed.', code, reason);
    },
  },
});

console.log(`[Server] Listening on http://localhost:${server.port}`);
