/**
 * Wait for a condition to be true
 */

export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: {
    timeout?: number;
    interval?: number;
    message?: string;
  } = {}
): Promise<void> {
  const { timeout = 5000, interval = 100, message = 'Condition not met' } = options;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await wait(interval);
  }

  throw new Error(`${message} (timeout: ${timeout}ms)`);
}

export interface TestWorkerServer {
  env: any;
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  handleRequest: (request: Request) => Promise<Response>;
}

export async function createTestWorkerServer(): Promise<TestWorkerServer> {
  const env = {
  TASK_MANAGER: { id: 'test-task', fetch: async () => new Response('OK') },
  SESSION_MANAGER: { id: 'test-session', fetch: async () => new Response('OK') },
  globalScope: globalThis as any
} as any;
  
  const handleFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    
    if (url.pathname === '/api/agent') {
      return new Response(JSON.stringify({
        protocolVersion: '0.4.0',
        name: 'Test Worker Agent',
        description: 'Test agent for authentication tests'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('Not Found', { status: 404 });
  };

  const handleRequest = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    
    if (url.pathname === '/api/agent') {
      return new Response(JSON.stringify({
        protocolVersion: '0.4.0',
        name: 'Test Worker Agent',
        description: 'Test agent for authentication tests'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('Not Found', { status: 404 });
  };
  
  return {
    env,
    fetch: handleFetch,
    handleRequest
  };
}