/**
 * A2A Client - Simple WebSocket-based client for A2A protocol
 *
 * Connects to A2A server over WebSocket and provides typed methods
 * for all A2A protocol operations.
 */

import { WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import type {
  Message,
  Task,
  AgentCard,
  MessageSendConfig,
  ListTasksParams,
  ListTasksResult
} from '@a2a-webcap/shared';

export interface A2AClientOptions {
  url: string;
  timeout?: number;
}

/**
 * A2A Client for WebSocket communication
 */
export class A2AClient {
  private ws: WebSocket | null = null;
  private url: string;
  private timeout: number;
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
  }>();

  constructor(options: A2AClientOptions) {
    this.url = options.url;
    this.timeout = options.timeout || 30000; // 30 seconds default
  }

  /**
   * Connect to the server
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.on('open', () => {
        resolve();
      });

      this.ws.on('error', (error) => {
        reject(error);
      });

      this.ws.on('message', (data) => {
        this.handleMessage(data.toString());
      });

      this.ws.on('close', () => {
        // Reject all pending requests
        for (const request of this.pendingRequests.values()) {
          clearTimeout(request.timer);
          request.reject(new Error('Connection closed'));
        }
        this.pendingRequests.clear();
      });
    });
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      // Handle welcome message
      if (message.type === 'welcome') {
        console.log('[Client] Server welcome:', message);
        return;
      }

      // Handle RPC response
      if (message.id && this.pendingRequests.has(message.id)) {
        const request = this.pendingRequests.get(message.id)!;
        clearTimeout(request.timer);
        this.pendingRequests.delete(message.id);

        if (message.error) {
          request.reject(new Error(message.error.message || 'RPC Error'));
        } else {
          request.resolve(message.result);
        }
      }
    } catch (error) {
      console.error('[Client] Error parsing message:', error);
    }
  }

  /**
   * Send an RPC request
   */
  private async sendRequest(method: string, params: any): Promise<any> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected');
    }

    const id = randomUUID();
    const request = {
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, this.timeout);

      this.pendingRequests.set(id, { resolve, reject, timer });

      this.ws!.send(JSON.stringify(request));
    });
  }

  /**
   * Get agent card
   */
  async getAgentCard(): Promise<AgentCard> {
    return await this.sendRequest('getAgentCard', {});
  }

  /**
   * Send a message
   */
  async sendMessage(
    message: Message,
    config?: MessageSendConfig
  ): Promise<Task | Message> {
    return await this.sendRequest('sendMessage', { message, config });
  }

  /**
   * Get task by ID
   */
  async getTask(taskId: string, historyLength?: number): Promise<Task> {
    return await this.sendRequest('getTask', { taskId, historyLength });
  }

  /**
   * List tasks
   */
  async listTasks(params: ListTasksParams): Promise<ListTasksResult> {
    return await this.sendRequest('listTasks', params);
  }

  /**
   * Cancel a task
   */
  async cancelTask(taskId: string): Promise<Task> {
    return await this.sendRequest('cancelTask', { taskId });
  }

  /**
   * Close the connection
   */
  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

/**
 * Example usage (for testing)
 */
async function main() {
  const client = new A2AClient({ url: 'ws://localhost:8080' });

  try {
    console.log('[Client] Connecting to server...');
    await client.connect();
    console.log('[Client] Connected!');

    // Get agent card
    console.log('\n[Client] Getting agent card...');
    const agentCard = await client.getAgentCard();
    console.log('[Client] Agent Card:', JSON.stringify(agentCard, null, 2));

    // Send a message
    console.log('\n[Client] Sending message...');
    const task = await client.sendMessage({
      messageId: randomUUID(),
      role: 'user',
      parts: [
        { kind: 'text', text: 'Hello from the A2A client!' }
      ]
    });
    console.log('[Client] Task created:', task);

    // Wait a bit for processing
    await new Promise(resolve => setTimeout(resolve, 200));

    // Get task status
    console.log('\n[Client] Getting task status...');
    const updatedTask = await client.getTask((task as Task).id);
    console.log('[Client] Task status:', updatedTask.status);

    // List all tasks
    console.log('\n[Client] Listing all tasks...');
    const tasksList = await client.listTasks({});
    console.log('[Client] Total tasks:', tasksList.total);

  } catch (error) {
    console.error('[Client] Error:', error);
  } finally {
    client.close();
    console.log('[Client] Connection closed.');
  }
}

// Run example if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export default A2AClient;
