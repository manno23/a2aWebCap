/**
 * @a2a-webcap/shared
 * Shared types and utilities for A2A on CapnWeb
 */

// Export all A2A protocol types
export * from './a2a-types';

// Export Cloudflare Workers compatible logger
export { createLogger } from './logger';
export type { Logger } from './logger';

// Export capnweb RPC primitives
// export { RpcTarget, RpcStub } from 'capnweb';

// WebSocket session creators
// export {
//   newWebSocketRpcSession,
//   newMessagePortRpcSession
// } from 'capnweb';
