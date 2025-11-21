/**
 * Core SturdyRef interfaces used by the a2a-webcap runtime.
 *
 * These abstractions intentionally mirror the minimal surface area we need
 * to support multiple persistent endpoint implementations (Durable Objects,
 * Cap'n Web endpoints, in-memory test doubles, etc.).
 */

export interface SturdyRefEndpoint {
  /** Unique identifier for the endpoint. */
  readonly id: string;
  /**
   * Execute a request against the endpoint. Implementations should treat the
   * request as fire-and-forget semantics – reliability and persistence are
   * characteristics of the endpoint itself, not this interface.
   */
  fetch(request: Request): Promise<Response>;
}

export interface SturdyRefDescriptor {
  /** String form of the sturdy reference (e.g., DO id, URL, capability token). */
  ref: string;
  /** Optional hint about where the endpoint is hosted (useful for gateways). */
  locationHint?: string;
}

export interface SturdyRefFactory {
  /** Resolve a descriptor into a live endpoint reference. */
  createEndpoint(descriptor: SturdyRefDescriptor): SturdyRefEndpoint;
}
