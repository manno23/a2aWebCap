import { RpcTarget } from 'capnweb';
import type { EchoService, AnotherService } from './types.ts';

// Simple EchoService implementation
export class EchoServiceImpl extends RpcTarget implements EchoService {
  constructor() {
    super();
    console.log('[Server] EchoService created');
  }

  async echo(message: string): Promise<string> {
    console.log(`[Server] EchoService.echo called with: "${message}"`);
    return `Echo: ${message}`;
  }

  async getAnotherService(): Promise<AnotherService> {
    console.log('[Server] EchoService.getAnotherService called');
    return new AnotherServiceImpl();
  }
}

// AnotherService implementation
export class AnotherServiceImpl extends RpcTarget implements AnotherService {
  constructor() {
    super();
    console.log('[Server] AnotherService created');
  }

  async doSomething(): Promise<string> {
    console.log('[Server] AnotherService.doSomething called');
    return "did something";
  }
}
