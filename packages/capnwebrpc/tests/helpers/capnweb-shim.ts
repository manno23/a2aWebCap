// Minimal runtime shim for the "cloudflare:capnweb" module so tests can run
// in Node without a Workers runtime. This is intentionally tiny and only
// implements what our adapters need.
export namespace Rpc {
  export interface Endpoint {
    fetch(request: Request): Promise<Response>;
  }

  export interface Service {}

  export type Handle<T extends Service> = T;

  export function bootstrap<T extends Service>(_endpoint: Endpoint, _service: new (...args: any[]) => T): Handle<T> {
    // For unit tests we only need the type-level signal that bootstrap returns
    // something callable; the handle isn't used directly today.
    return {} as Handle<T>;
  }

  export async function handleRequest(service: Service, request: Request): Promise<Response> {
    const candidate = service as { fetch?: (request: Request) => Promise<Response> };
    if (candidate.fetch) {
      return await candidate.fetch(request);
    }
    throw new Error('No fetch handler registered');
  }

  export function exportService(_service: object): void {
    // No-op for the test shim.
  }
}
