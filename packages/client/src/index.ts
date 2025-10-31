import { newWebSocketRpcSession, RpcStub, Agent } from '@a2a-webcap/shared';

async function main() {
  console.log('[Client] Connecting to server...');

  // Create a new WebSocket RPC session. The type parameter ensures the client stub is correctly typed.
  const server: RpcStub<Agent> = newWebSocketRpcSession('ws://localhost:8080');

  console.log('[Client] Connection established.');

  // --- Test the `prompt` method ---
  const testPrompt = 'Hello from the client!';
  console.log(`[Client] Sending prompt: "${testPrompt}"`);

  try {
    const response = server.prompt({
      sessionId: 'test-session-123',
      prompt: [{ type: 'text', text: testPrompt }],
    });

    console.log('[Client] Received response:', response);

    if (response === 'end_turn') {
      console.log('[Client] Successfully received end_turn from server.');
    }

  } catch (error) {
    console.error('[Client] An error occurred:', error);
  } finally {
    // Dispose of the RPC session to close the connection
    server[Symbol.dispose]();
    console.log('[Client] Connection closed.');
  }
}

main().catch(console.error);
