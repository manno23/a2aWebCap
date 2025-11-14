/**
 * Tool Registry
 * Manages available tools, schemas, and permissions
 */

import type { ToolCall, ToolStatus } from '@a2a-webcap/shared';
import pino from 'pino';

const log = pino({ name: 'tool-registry' });

/**
 * Tool definition with schema and execution function
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, ParameterSchema>;
  requiresApproval: boolean;
  execute: (input: Record<string, any>) => Promise<any>;
}

/**
 * Parameter schema for validation
 */
export interface ParameterSchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
  default?: any;
  enum?: any[];
  items?: ParameterSchema;
  properties?: Record<string, ParameterSchema>;
}

/**
 * Tool Registry
 * Central registry for all available tools
 */
export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  constructor() {
    this.registerBuiltInTools();
  }

  /**
   * Register a new tool
   */
  registerTool(definition: ToolDefinition): void {
    if (this.tools.has(definition.name)) {
      throw new Error(`Tool '${definition.name}' is already registered`);
    }

    log.info({ name: definition.name }, 'Tool registered');
    this.tools.set(definition.name, definition);
  }

  /**
   * Get tool definition by name
   */
  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * List all registered tools
   */
  listTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Validate tool input against schema
   */
  validateInput(toolName: string, input: Record<string, any>): ValidationResult {
    const tool = this.tools.get(toolName);

    if (!tool) {
      return {
        valid: false,
        errors: [`Tool '${toolName}' not found`]
      };
    }

    const errors: string[] = [];

    // Check required parameters
    for (const [paramName, schema] of Object.entries(tool.parameters)) {
      if (schema.required && !(paramName in input)) {
        errors.push(`Required parameter '${paramName}' is missing`);
      }

      // Type validation
      if (paramName in input) {
        const value = input[paramName];
        const typeError = this.validateType(value, schema, paramName);
        if (typeError) {
          errors.push(typeError);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate value against schema type
   */
  private validateType(value: any, schema: ParameterSchema, paramName: string): string | null {
    const actualType = Array.isArray(value) ? 'array' : typeof value;

    if (schema.type === 'array' && !Array.isArray(value)) {
      return `Parameter '${paramName}' must be an array`;
    }

    if (schema.type !== 'array' && actualType !== schema.type) {
      return `Parameter '${paramName}' must be of type ${schema.type}, got ${actualType}`;
    }

    if (schema.enum && !schema.enum.includes(value)) {
      return `Parameter '${paramName}' must be one of: ${schema.enum.join(', ')}`;
    }

    return null;
  }

  /**
   * Register built-in tools for demonstration
   */
  private registerBuiltInTools(): void {
    // Calculator tool
    this.registerTool({
      name: 'calculator',
      description: 'Perform basic arithmetic operations',
      parameters: {
        operation: {
          type: 'string',
          description: 'The operation to perform',
          required: true,
          enum: ['add', 'subtract', 'multiply', 'divide']
        },
        a: {
          type: 'number',
          description: 'First operand',
          required: true
        },
        b: {
          type: 'number',
          description: 'Second operand',
          required: true
        }
      },
      requiresApproval: false,
      execute: async (input) => {
        const { operation, a, b } = input;

        switch (operation) {
          case 'add':
            return { result: a + b };
          case 'subtract':
            return { result: a - b };
          case 'multiply':
            return { result: a * b };
          case 'divide':
            if (b === 0) {
              throw new Error('Division by zero');
            }
            return { result: a / b };
          default:
            throw new Error(`Unknown operation: ${operation}`);
        }
      }
    });

    // Echo tool (for testing)
    this.registerTool({
      name: 'echo',
      description: 'Echo back the input message',
      parameters: {
        message: {
          type: 'string',
          description: 'The message to echo',
          required: true
        }
      },
      requiresApproval: false,
      execute: async (input) => {
        return { echo: input.message };
      }
    });

    // File read tool (requires approval)
    this.registerTool({
      name: 'read_file',
      description: 'Read contents of a file',
      parameters: {
        path: {
          type: 'string',
          description: 'Path to the file',
          required: true
        }
      },
      requiresApproval: true,
      execute: async (input) => {
        // TODO: Implement actual file reading
        // For now, return mock data
        return {
          path: input.path,
          content: 'Mock file content',
          size: 1024
        };
      }
    });

    // HTTP request tool (requires approval)
    this.registerTool({
      name: 'http_request',
      description: 'Make an HTTP request',
      parameters: {
        url: {
          type: 'string',
          description: 'The URL to request',
          required: true
        },
        method: {
          type: 'string',
          description: 'HTTP method',
          required: false,
          default: 'GET',
          enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
        }
      },
      requiresApproval: true,
      execute: async (input) => {
        // TODO: Implement actual HTTP request
        // For now, return mock data
        return {
          url: input.url,
          method: input.method || 'GET',
          status: 200,
          body: { mock: 'response' }
        };
      }
    });
  }
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
