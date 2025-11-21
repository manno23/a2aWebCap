/**
 * Workers Runtime Test Environment Setup
 * 
 * Provides Miniflare v4 configuration for testing Cloudflare Workers code
 * in a simulated Workers runtime environment
 */

import { Miniflare } from 'miniflare';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Create a Miniflare instance for Workers runtime simulation
 */
export async function createWorkersTestEnvironment() {
  const mf = new Miniflare({
    // Core configuration
    name: 'a2a-test-worker',
    scriptPath: join(__dirname, '../src/worker.ts'),

    // Workers runtime compatibility
    compatibilityDate: '2024-11-17',
    compatibilityFlags: ['nodejs_compat'],

    // Module configuration
    modules: true,
    moduleRules: [
      { type: 'ESModule', include: ['**/*.js', '**/*.ts'] },
      { type: 'Text', include: ['**/*.json'] }
    ],

    // Bindings and environment
    bindings: {
      // Mock environment variables
      AGENT_NAME: 'Test A2A Agent',
      AGENT_DESCRIPTION: 'Test agent for A2A protocol',
      AGENT_URL: 'http://localhost:8787',
      JWT_SECRET: 'test-secret-key',
      DEBUG: 'true'
    },

    // KV namespaces for testing
    kvNamespaces: {
      'TEST_KV': 'test-kv-namespace'
    },

    // Durable Objects for testing
    durableObjects: {
      'A2A_SERVICE': 'A2AServiceDurableObject'
    },

    // WebSocket support
    webSocket: true,

    // Development settings
    log: new Proxy(console, {
      get(target, prop) {
        return target[prop as keyof Console];
      }
    }),

    // File system access for tests
    sitePath: join(__dirname, '../'),

    // Allow network access for testing
    globalAsyncIO: true,

    // Mock crypto and other Workers APIs
    globalRandom: true,
    globalPerformance: true,

    // Enable all compatibility features
    enableServiceWorker: true,
    enablePagesAssetsServiceBinding: false
  });

  return mf;
}

/**
 * Setup global Workers APIs for testing
 */
export function setupWorkersGlobals() {
  // Mock Web Crypto API if not available
  if (typeof globalThis.crypto === 'undefined') {
    globalThis.crypto = {
      subtle: {
        importKey: async () => ({ algorithm: { name: 'HMAC' } }),
        sign: async () => new ArrayBuffer(32),
        verify: async () => true,
        digest: async (algorithm, data) => {
          // Simple mock digest
          const buffer = new ArrayBuffer(32);
          return buffer;
        }
      },
      getRandomValues: (array) => {
        for (let i = 0; i < array.length; i++) {
          array[i] = Math.floor(Math.random() * 256);
        }
        return array;
      },
      randomUUID: () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      }
    } as any;
  }

  // Mock Workers runtime APIs
  if (typeof globalThis.fetch === 'undefined') {
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      // Simple mock fetch
      return new Response('Mock response', { status: 200 });
    };
  }

  // Mock WebSocket if not available
  if (typeof globalThis.WebSocket === 'undefined') {
    globalThis.WebSocket = class MockWebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        // Mock implementation
      }

      send(data: any) {
        // Mock implementation
      }

      close(code?: number, reason?: string) {
        // Mock implementation
      }

      addEventListener(type: string, listener: EventListener) {
        // Mock implementation
      }

      removeEventListener(type: string, listener: EventListener) {
        // Mock implementation
      }
    } as any;
  }

  // Mock structuredClone if not available
  if (typeof globalThis.structuredClone === 'undefined') {
    globalThis.structuredClone = (obj: any) => JSON.parse(JSON.stringify(obj));
  }

  // Mock Headers, Request, Response
  if (typeof globalThis.Headers === 'undefined') {
    globalThis.Headers = class MockHeaders {
      constructor(init?: HeadersInit) {
        // Mock implementation
      }

      get(name: string): string | null {
        return null;
      }

      set(name: string, value: string) {
        // Mock implementation
      }

      has(name: string): boolean {
        return false;
      }
    } as any;
  }

  if (typeof globalThis.Request === 'undefined') {
    globalThis.Request = class MockRequest {
      constructor(input: RequestInfo | URL, init?: RequestInit) {
        // Mock implementation
      }

      get url(): string {
        return 'http://localhost:8787/';
      }

      get method(): string {
        return 'GET';
      }

      get headers(): Headers {
        return new Headers();
      }
    } as any;
  }

  if (typeof globalThis.Response === 'undefined') {
    globalThis.Response = class MockResponse {
      constructor(body?: BodyInit | null, init?: ResponseInit) {
        // Mock implementation
      }

      get status(): number {
        return 200;
      }

      get headers(): Headers {
        return new Headers();
      }

      get ok(): boolean {
        return true;
      }
    } as any;
  }

  // Mock URL
  if (typeof globalThis.URL === 'undefined') {
    globalThis.URL = class MockURL {
      constructor(url: string, base?: string) {
        // Mock implementation
      }

      get origin(): string {
        return 'http://localhost:8787';
      }

      get pathname(): string {
        return '/';
      }

      get search(): string {
        return '';
      }
    } as any;
  }

  // Mock atob and btoa for base64 encoding
  if (typeof globalThis.atob === 'undefined') {
    globalThis.atob = (encoded: string): string => {
      return Buffer.from(encoded, 'base64').toString('binary');
    };
  }

  if (typeof globalThis.btoa === 'undefined') {
    globalThis.btoa = (string: string): string => {
      return Buffer.from(string, 'binary').toString('base64');
    };
  }
}

/**
 * Create a test environment with Workers runtime simulation
 */
export async function createTestEnvironment() {
  // Setup global Workers APIs
  setupWorkersGlobals();

  // Create Miniflare instance
  const mf = await createWorkersTestEnvironment();

  return {
    mf,

    // Helper to execute code in Workers context
    async executeInWorker<T>(fn: () => T | Promise<T>): Promise<T> {
      // For now, just execute in current context with mocked globals
      // In a more sophisticated setup, we could use the Miniflare runtime
      return await fn();
    },

    // Cleanup function
    async cleanup() {
      await mf.dispose();
    }
  };
}
