declare module 'cloudflare:capnweb' {
  export namespace Rpc {
    interface Endpoint {
      fetch(request: Request): Promise<Response>;
    }

    interface Service {}

    type Handle<T extends Service> = T;

    function bootstrap<T extends Service>(endpoint: Endpoint, service: new (...args: any[]) => T): Handle<T>;
    function handleRequest(service: Service, request: Request): Promise<Response>;
    function exportService(service: object): void;
  }
}
