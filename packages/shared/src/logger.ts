/**
 * Cloudflare Workers compatible logger
 * Uses console.log with structured data
 */

export interface Logger {
  info: (msg: string, obj?: any) => void;
  error: (msg: string, obj?: any) => void;
  warn: (msg: string, obj?: any) => void;
  debug: (msg: string, obj?: any) => void;
  child: (bindings: Record<string, any>) => Logger;
}

class WorkersLogger implements Logger {
  private context: Record<string, any>;

  constructor(context: Record<string, any> = {}) {
    this.context = context;
  }

  info(msg: string, obj?: any) {
    console.log(JSON.stringify({ level: 'info', msg, ...this.context, ...obj }));
  }

  error(msg: string, obj?: any) {
    console.error(JSON.stringify({ level: 'error', msg, ...this.context, ...obj }));
  }

  warn(msg: string, obj?: any) {
    console.warn(JSON.stringify({ level: 'warn', msg, ...this.context, ...obj }));
  }

  debug(msg: string, obj?: any) {
    // In Cloudflare Workers, we can use the DEBUG environment variable
    if (typeof globalThis !== 'undefined' && (globalThis as any).DEBUG) {
      console.log(JSON.stringify({ level: 'debug', msg, ...this.context, ...obj }));
    }
  }

  child(bindings: Record<string, any>) {
    return new WorkersLogger({ ...this.context, ...bindings });
  }
}

export function createLogger(name: string): Logger {
  return new WorkersLogger({ name });
}