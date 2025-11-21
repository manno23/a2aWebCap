import type { Rpc } from 'cloudflare:capnweb';
import type { SturdyRefEndpoint, SturdyRefDescriptor, SturdyRefFactory } from './sturdy-ref.js';

/**
 * Thin adapter so Cap'n Web endpoints can satisfy the SturdyRefEndpoint
 * interface without pulling in any session state machine.
 */
export class CapnWebEndpoint implements SturdyRefEndpoint {
  public readonly id: string;
  private readonly endpoint: Rpc.Endpoint;

  constructor(endpoint: Rpc.Endpoint, id: string) {
    this.endpoint = endpoint;
    this.id = id;
  }

  async fetch(request: Request): Promise<Response> {
    return await this.endpoint.fetch(request);
  }
}

export type CapnWebNamespace = (descriptor: SturdyRefDescriptor) => Rpc.Endpoint;

export class CapnWebSturdyRefFactory implements SturdyRefFactory {
  constructor(private readonly resolveEndpoint: CapnWebNamespace) {}

  createEndpoint(descriptor: SturdyRefDescriptor): SturdyRefEndpoint {
    const endpoint = this.resolveEndpoint(descriptor);
    return new CapnWebEndpoint(endpoint, descriptor.ref);
  }
}
