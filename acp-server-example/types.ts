import { RpcTarget } from 'capnweb';

// Define the interfaces for our RPC services that extend RpcTarget
export abstract class EchoService extends RpcTarget {
  abstract echo(message: string): Promise<string>;
  abstract getAnotherService(): Promise<RpcTarget>;
}

export abstract class AnotherService extends RpcTarget {
  abstract doSomething(): Promise<string>;
}