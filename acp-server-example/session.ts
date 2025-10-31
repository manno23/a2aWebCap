import { RpcTarget, newMessagePortRpcSession } from 'capnweb';
import type { EchoService } from './types';
import { EchoServiceImpl, AnotherServiceImpl } from './agent';

// Demo the client-server interactions
async function demo() {
  console.log('=== Starting CapnWeb RPC Demo ===\n');

  // Step 1: Create MessageChannel for in-memory communication
  console.log('Step 1: Creating MessageChannel for in-memory communication...');
  const messageChannel = new MessageChannel();
  
  // Create server instance
  const serverInstance = new EchoServiceImpl();
  
  // Start capnweb session on server port
  newMessagePortRpcSession(messageChannel.port1, serverInstance);
  console.log('[Server] CapnWeb session started on server port');

  // Step 2: Create client stub connected to the server
  console.log('Step 2: Creating client stub...');
  const echoService = newMessagePortRpcSession<EchoService>(messageChannel.port2);
  console.log('[Client] CapnWeb client stub created');
  console.log('');

  // Step 3: Call echo method
  console.log('Step 3: Calling echo method...');
  try {
    const echoResult = await echoService.echo('Hello, CapnWeb!');
    console.log('[Client] echo result:', echoResult);
  } catch (error) {
    console.error('[Client] echo error:', error);
  }
  console.log('');

  // Step 4: Get another service
  console.log('Step 4: Getting AnotherService...');
  try {
    const anotherService = await echoService.getAnotherService();
    console.log('[Client] Received AnotherService stub');
    
    // Step 5: Call doSomething on the new service
    console.log('Step 5: Calling doSomething on AnotherService...');
    const somethingResult = await anotherService.doSomething();
    console.log('[Client] doSomething result:', somethingResult);
  } catch (error) {
    console.error('[Client] getAnotherService error:', error);
  }

  console.log('\n=== Demo Complete ===');
}

// Run the demo
demo().catch(console.error);
