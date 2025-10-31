# A2A on CapnWeb Implementation Plan

This plan outlines the steps to implement the A2A protocol on top of the CapnWeb RPC transport, as detailed in the formal analysis document.

## B.1 Server Implementation

- [x] Create `A2AService` class extending `RpcTarget`
- [ ] Implement all A2A methods as RPC methods
- [ ] Create `StreamingTask` RpcTarget for streaming updates
- [ ] Implement `TaskUpdateCallback` interface
- [ ] Set up authentication returning `AuthenticatedA2AService`
- [ ] Configure HTTP and WebSocket endpoints
- [ ] Add TLS certificates
- [ ] Implement task state management
- [ ] Create AgentCard with CAPNWEB transport
- [ ] Add error handling and logging
- [ ] Implement rate limiting
- [ ] Add monitoring and metrics

## B.2 Client Implementation

- [ ] Create `A2AClient` class
- [ ] Implement connection management (HTTP batch / WebSocket)
- [ ] Implement all A2A client methods
- [ ] Create client-side `TaskUpdateCallback` implementation
- [ ] Add authentication flow
- [ ] Implement callback registration for streaming
- [ ] Add error handling
- [ ] Implement reconnection logic (WebSocket)
- [ ] Add TypeScript types
- [ ] Create usage documentation
- [ ] Add unit tests
- [ ] Add integration tests

## B.3 Testing

- [ ] Test each A2A method via CapnWeb
- [ ] Test streaming with callbacks
- [ ] Test authentication flow
- [ ] Test error scenarios
- [ ] Test disconnection/reconnection
- [ ] Test performance (latency, throughput)
- [- [ ] Test security (auth, authorization)
- [ ] Test resource cleanup (disposal)
- [ ] Compare with JSON-RPC implementation
- [ ] Load testing
