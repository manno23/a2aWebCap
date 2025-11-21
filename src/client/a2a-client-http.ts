/**
 * Cloudflare Workers Compatible A2A Client
 * HTTP-based client for A2A protocol (WebSocket requires Durable Objects)
 */

import { createLogger, type Logger } from '../../shared/src/logger.js';
import type {
  Message,
  Task,
  AgentCard,
  MessageSendConfig,
  ListTasksParams,
  ListTasksResult
} from '../../shared/src/a2a-types.js';

export interface A2AClientOptions {
  url: string;
  timeout?: number;
  authToken?: string;
}

/**
 * A2A HTTP Client for Cloudflare Workers
 * Uses fetch API instead of WebSocket for compatibility
 */
export class A2AClient {
  private url: string;
  private timeout: number;
  private authToken?: string;
  private log: Logger;

  constructor(options: A2AClientOptions) {
    this.url = options.url.replace(/\/$/, ''); // Remove trailing slash
    this.timeout = options.timeout || 30000;
    this.authToken = options.authToken;
    this.log = createLogger('a2a-client');

    this.log.info('A2A HTTP Client initialized', { url: this.url, timeout: this.timeout });
  }

  /**
   * Get agent capabilities and information
   */
  async getAgentCard(): Promise<AgentCard> {
    this.log.info('Getting agent card');

    const response = await this.fetch('/.well-known/agent.json');

    if (!response.ok) {
      throw new Error(`Failed to get agent card: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Send a message and create/update a task
   */
  async sendMessage(message: Message, config?: MessageSendConfig): Promise<Task> {
    this.log.info('Sending message', { messageId: message.messageId });

    const response = await this.fetch('/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message,
        config
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get task by ID
   */
  async getTask(taskId: string, historyLength?: number): Promise<Task> {
    this.log.info('Getting task', { taskId, historyLength });

    const params = new URLSearchParams();
    if (historyLength !== undefined) {
      params.set('historyLength', historyLength.toString());
    }

    const response = await this.fetch(`/tasks/${taskId}?${params}`);

    if (!response.ok) {
      throw new Error(`Failed to get task: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * List tasks with optional filtering
   */
  async listTasks(params?: ListTasksParams): Promise<ListTasksResult> {
    this.log.info('Listing tasks', { params });

    const searchParams = new URLSearchParams();
    if (params?.contextId) {
      searchParams.set('contextId', params.contextId);
    }
    if (params?.limit !== undefined) {
      searchParams.set('limit', params.limit.toString());
    }
    if (params?.offset !== undefined) {
      searchParams.set('offset', params.offset.toString());
    }

    const response = await this.fetch(`/tasks?${searchParams}`);

    if (!response.ok) {
      throw new Error(`Failed to list tasks: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Cancel a task
   */
  async cancelTask(taskId: string): Promise<Task> {
    this.log.info('Cancelling task', { taskId });

    const response = await this.fetch(`/tasks/${taskId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error(`Failed to cancel task: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Health check
   */
  async health(): Promise<{ status: string; timestamp: string; service: string }> {
    this.log.info('Health check');

    const response = await this.fetch('/health');

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Make HTTP request with timeout and auth
   */
  private async fetch(path: string, init?: RequestInit): Promise<Response> {
    const url = `${this.url}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    const headers: Record<string, string> = {};
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    try {
      const response = await fetch(url, {
        ...init,
        headers: {
          ...headers,
          ...init?.headers
        },
        signal: controller.signal
      });

      return response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
