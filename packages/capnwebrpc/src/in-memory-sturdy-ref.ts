import { randomUUID } from 'node:crypto';
import type { SturdyRefEndpoint, SturdyRefDescriptor, SturdyRefFactory } from './sturdy-ref.js';

export type SturdyRefHandler = (request: Request) => Promise<Response> | Response;

/**
 * Minimal in-memory implementation of a sturdy ref endpoint.
 *
 * This is intentionally lightweight so it can be used in unit tests without
 * spinning up a Worker runtime. It mirrors the fetch surface supported by
 * DurableObjectStub and other persistent endpoints.
 */
export class InMemorySturdyRef implements SturdyRefEndpoint {
  public readonly id: string;
  private readonly handler: SturdyRefHandler;

  constructor(handler: SturdyRefHandler, id: string = randomUUID()) {
    this.handler = handler;
    this.id = id;
  }

  async fetch(request: Request): Promise<Response> {
    return await this.handler(request);
  }
}

/**
 * Utility factory that can translate sturdy ref descriptors into in-memory
 * endpoints. This makes it trivial to plug into higher level APIs that expect
 * a SturdyRefFactory without requiring a Workers runtime.
 */
export class InMemorySturdyRefFactory implements SturdyRefFactory {
  private readonly registry = new Map<string, SturdyRefHandler>();

  register(descriptor: SturdyRefDescriptor, handler: SturdyRefHandler): InMemorySturdyRef {
    this.registry.set(descriptor.ref, handler);
    return new InMemorySturdyRef(handler, descriptor.ref);
  }

  createEndpoint(descriptor: SturdyRefDescriptor): SturdyRefEndpoint {
    const handler = this.registry.get(descriptor.ref);
    if (!handler) {
      throw new Error(`No in-memory sturdy ref registered for ${descriptor.ref}`);
    }
    return new InMemorySturdyRef(handler, descriptor.ref);
  }
}
