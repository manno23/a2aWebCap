import { describe, expect, it } from 'vitest';
import { InMemorySturdyRefFactory } from '../src/in-memory-sturdy-ref.js';
import type { SturdyRefDescriptor } from '../src/sturdy-ref.js';

const descriptor: SturdyRefDescriptor = { ref: 'test-ref' };

describe('InMemorySturdyRefFactory', () => {
  it('routes requests through a registered handler', async () => {
    const factory = new InMemorySturdyRefFactory();
    factory.register(descriptor, async (request) => {
      const payload = await request.json();
      return new Response(JSON.stringify({ echoed: payload.message }), { status: 200 });
    });

    const endpoint = factory.createEndpoint(descriptor);
    const response = await endpoint.fetch(
      new Request('https://example.test/echo', {
        method: 'POST',
        body: JSON.stringify({ message: 'ping' })
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ echoed: 'ping' });
    expect(endpoint.id).toBe(descriptor.ref);
  });

  it('fails fast when no handler is registered', async () => {
    const factory = new InMemorySturdyRefFactory();
    expect(() => factory.createEndpoint(descriptor)).toThrow(/No in-memory sturdy ref/);
  });
});
