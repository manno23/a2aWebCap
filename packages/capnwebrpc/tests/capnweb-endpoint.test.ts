import { describe, expect, it } from 'vitest';
import { CapnWebEndpoint, CapnWebSturdyRefFactory } from '../src/capnweb-endpoint.js';
import type { SturdyRefDescriptor } from '../src/sturdy-ref.js';
import { Rpc } from './helpers/capnweb-shim.js';

describe('CapnWeb adapters', () => {
  it('wraps a CapnWeb endpoint with SturdyRef semantics', async () => {
    const echoEndpoint: Rpc.Endpoint = {
      async fetch(request: Request): Promise<Response> {
        const body = await request.json();
        return new Response(JSON.stringify({ echoed: body.message }), { status: 201 });
      }
    };

    const wrapper = new CapnWebEndpoint(echoEndpoint, 'stub-id');
    const response = await wrapper.fetch(
      new Request('https://example.test/echo', {
        method: 'POST',
        body: JSON.stringify({ message: 'ping' })
      })
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ echoed: 'ping' });
    expect(wrapper.id).toBe('stub-id');
  });

  it('creates wrapped endpoints from descriptors', async () => {
    const descriptor: SturdyRefDescriptor = { ref: 'do/123' };

    const factory = new CapnWebSturdyRefFactory((incoming) => {
      expect(incoming).toBe(descriptor);
      return {
        async fetch(): Promise<Response> {
          return new Response('ok');
        }
      } satisfies Rpc.Endpoint;
    });

    const endpoint = factory.createEndpoint(descriptor);
    const response = await endpoint.fetch(new Request('https://example.test'));
    expect(response.status).toBe(200);
    expect(endpoint.id).toBe('do/123');
  });
});
