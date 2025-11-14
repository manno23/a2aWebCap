# A2A WebCap Communication Visualization Suite

Complete documentation of socket connections, RPC layers, and message flows with color-coded event tracking.

## Documentation Structure

### 📁 1. Connection Layer Visualization
**File:** `connection-visualization.md`

Covers the foundational communication layers:
- **Architecture Overview** - Complete client-server stack from application to network layer
- **Layer 1: TCP Socket Layer** - TCP connection establishment (SYN, SYN-ACK, ACK)
- **Layer 2: WebSocket Layer** - HTTP upgrade handshake and frame format
- **Layer 3: RPC Protocol Layer** - CapnWeb RPC over JSON-RPC pattern
- **Layer 4: Application Layer** - A2A Service methods and TaskManager
- **Connection Lifecycle** - Complete flow from connection to teardown
- **Concurrent Connections** - Multi-user connection pooling

**Use this when:**
- Understanding system architecture
- Debugging connection issues
- Learning how WebSocket and RPC layers interact
- Planning scaling strategies

---

### 📁 2. Message Flow Visualization
**File:** `message-flow-visualization.md`

Detailed request/response flows with color-coded event lists:
- **Color Coding Legend** - Complete reference for all event types
- **Example 1: Simple sendMessage()** - Request/response with full event log
- **Example 2: Streaming Message Flow** - Server-push notifications via StreamingTask
- **Event Timeline Format** - Shows WebSocket frames, RPC calls, and A2A protocol events
- **Both HTTP/WebSocket and RPC Information** - Dual-layer visibility

**Use this when:**
- Debugging specific API calls
- Understanding streaming/push notifications
- Tracing message flow through all layers
- Learning the timing of events

**Key Features:**
- ✅ Shows exact WebSocket frame format (FIN, opcode, mask, payload)
- ✅ Shows JSON-RPC request/response structure
- ✅ Shows timing information (milliseconds)
- ✅ Color-coded by event type (connection, RPC, task, status, etc.)
- ✅ Separates synchronous RPC from async processing

---

### 📁 3. Advanced Scenarios Visualization
**File:** `advanced-scenarios-visualization.md`

Complex patterns and edge cases:
- **Scenario 1: Authentication Flow** - Capability-based security with authenticated stubs
- **Scenario 2: RPC Timeout** - Network failure and client-side timeout handling
- **Scenario 3: Server-Side Error** - Error propagation from server to client
- **Scenario 4: Concurrent Connections** - Multi-user timeline with ownership enforcement
- **Scenario 5: Connection Close During Streaming** - Cleanup during active operations
- **Event Type Reference** - Quick lookup table for all symbols and colors

**Use this when:**
- Implementing authentication
- Handling errors gracefully
- Managing multi-user scenarios
- Dealing with connection failures
- Understanding capability-based security

---

## Color Coding System

### Connection Events
- 🔵 **BLUE** - TCP/WebSocket connection establishment
- 🟢 **GREEN** - Successful connection/handshake
- 🔴 **RED** - Connection errors/failures
- ⚫ **BLACK** - Connection termination

### RPC Layer
- 🟡 **YELLOW** - RPC request sent
- 🟠 **ORANGE** - RPC response received
- 🟣 **PURPLE** - RPC error/exception
- 🔷 **CYAN** - RPC method invocation (server-side)

### A2A Protocol
- 🟢 **GREEN** - Task created (submitted state)
- 🟡 **YELLOW** - Task working (processing)
- 🔵 **BLUE** - Status update event
- 🟣 **PURPLE** - Artifact update event
- ✅ **GREEN CHECK** - Task completed successfully
- ❌ **RED X** - Task failed/rejected
- ⏸️ **GRAY** - Task canceled

### HTTP/WebSocket
- 📤 **CYAN** - Outgoing message/frame
- 📥 **MAGENTA** - Incoming message/frame
- 🔐 **ORANGE** - Authentication/authorization
- ⚠️ **YELLOW** - Warning/non-critical error

---

## Understanding the Event Log Format

All event logs follow this structure:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ EVENT LOG: [Description of scenario]                                        │
├────┬──────────┬──────────┬────────────────────────────────────────────────────┤
│ #  │ TIME     │ TYPE     │ EVENT DETAILS                                     │
├────┼──────────┼──────────┼────────────────────────────────────────────────────┤
│    │          │          │                                                    │
│ 01 │ 00:00.00 │ 🟡 RPC   │ [Event description]                                │
│    │          │    REQ   │ ┌────────────────────────────────────────────────┐ │
│    │          │          │ │ [Detailed information box]                     │ │
│    │          │          │ │ • Sub-item 1                                   │ │
│    │          │          │ │ • Sub-item 2                                   │ │
│    │          │          │ └────────────────────────────────────────────────┘ │
│    │          │          │                                                    │
└────┴──────────┴──────────┴────────────────────────────────────────────────────┘
```

### Column Definitions:
1. **#** - Sequential event number
2. **TIME** - Timestamp in MM:SS.MS format (relative to scenario start)
3. **TYPE** - Event category with color emoji and label
4. **EVENT DETAILS** - Description and data

### Detail Boxes:
Each event includes an expanded box showing:
- **WebSocket Level:** Frame format, opcodes, masks, payload size
- **RPC Level:** Request/response IDs, methods, parameters
- **A2A Level:** Task states, messages, artifacts
- **Application Level:** Business logic events

---

## Example Usage Scenarios

### Debugging a Failed Request

1. Start with `message-flow-visualization.md`
2. Find the request type (e.g., "sendMessage")
3. Compare your event sequence to the documented flow
4. Look for missing events or errors
5. Check `advanced-scenarios-visualization.md` for error handling patterns

### Understanding Streaming

1. Read `connection-visualization.md` Layer 4 for StreamingTask overview
2. Study Example 2 in `message-flow-visualization.md`
3. Note the bidirectional push pattern (server calls client callback)
4. See how `final=true` flag terminates streaming

### Implementing Authentication

1. Review Scenario 1 in `advanced-scenarios-visualization.md`
2. Understand the capability-based pattern:
   - One `authenticate()` call
   - Returns new authenticated stub
   - All future calls use that stub (no credentials needed)
   - Disposal revokes access
3. Note how userId is embedded in stub context
4. See automatic ownership enforcement

### Handling Concurrent Users

1. Study Scenario 4 in `advanced-scenarios-visualization.md`
2. Note separate WebSocket connections per user
3. See shared TaskManager with ownership filtering
4. Understand authenticated vs unauthenticated access

---

## Key Architectural Patterns

### 1. Layered Communication

```
Application (A2A Protocol)
    ↕
RPC Layer (CapnWeb/JSON-RPC)
    ↕
WebSocket (Bidirectional)
    ↕
TCP Socket (Connection)
```

Each layer has specific responsibilities and error handling.

### 2. Asynchronous Processing

```
Client Request → Server Creates Task → Returns Immediately
                      ↓
              (Background Processing)
                      ↓
              Updates via Streaming or Polling
```

Server doesn't block on task processing - returns task immediately in "working" state.

### 3. Capability-Based Security

```
Unauthenticated Stub → authenticate() → Authenticated Stub
                                             ↓
                                    All calls have user context
                                             ↓
                                    dispose() revokes access
```

No need to pass credentials with every request.

### 4. Bidirectional Streaming

```
Client ←──────────── Server
   ↓                    ↑
subscribe(callback)     │
   ↓                    │
   └─ Registers callback stub with server
                        │
Server calls callback methods:
  • onStatusUpdate()
  • onArtifactUpdate()
```

True server-push via RPC method calls on client-side callback objects.

---

## Common Questions

### Q: Why both WebSocket frames AND RPC messages?
**A:** WebSocket provides the transport (reliable bidirectional byte stream). RPC provides the application protocol (method calls, promises, error handling).

### Q: What's the difference between sendMessage() and sendMessageStreaming()?
**A:**
- `sendMessage()` returns Task immediately, client polls with `getTask()` for updates
- `sendMessageStreaming()` returns StreamingTask stub, server pushes updates to client callback

### Q: How does the server know which user made a request?
**A:** Via capability-based security. After authentication, client gets AuthenticatedA2AService stub. That stub has userId embedded. All calls to that stub automatically include user context.

### Q: What happens if connection drops during streaming?
**A:** See Scenario 5 in `advanced-scenarios-visualization.md`. Server cleans up streaming subscriptions, but task continues processing. Client can reconnect and call `getTask()` to get final result.

### Q: How are errors propagated?
**A:**
1. Server catches error
2. Serializes to JSON-RPC error response: `{id, error: {code, message, data}}`
3. Sends via WebSocket
4. Client rejects pending promise with error
5. Application catches via try/catch or .catch()

---

## Implementation Notes

### For Client Developers:
- Always handle connection errors (timeouts, network failures)
- Use streaming for real-time updates (e.g., long-running tasks)
- Dispose authenticated stubs when done to free server resources
- Handle task state transitions (submitted → working → completed)

### For Server Developers:
- Return tasks immediately, process asynchronously
- Emit TaskManager events for streaming subscribers
- Clean up subscriptions on connection close
- Enforce ownership in AuthenticatedA2AService methods
- Include user context in task metadata

### For Ops/DevOps:
- Monitor WebSocket connection count
- Track pending requests and timeouts
- Watch for abandoned StreamingTask subscriptions
- Set up connection pooling/load balancing
- Configure WebSocket timeouts appropriately

---

## Related Documentation

- **A2A Protocol Specification** - Official protocol docs
- **CapnWeb Documentation** - RPC framework details
- **WebSocket RFC 6455** - WebSocket protocol standard
- **JSON-RPC 2.0 Specification** - RPC message format

---

## Visualization Legend

### Box Types

```
╔══════╗  Double border - Major headers/sections
║      ║
╚══════╝

┌──────┐  Single border - Individual events/components
│      │
└──────┘

╭──────╮  Rounded border - Grouping/describe blocks
│      │
╰──────╯
```

### Arrows

```
───────►  Request/outgoing message
◄───────  Response/incoming message
   ↕      Bidirectional communication
   ↓      Data flow / delegation
```

### Special Symbols

```
✓  Success
✗  Failure
⚠️  Warning
⏰  Timeout
⚫  Closed/terminated
🔐  Authentication required
```

---

## Version History

- **v1.0** (2025-11-14) - Initial visualization suite
  - Connection layer diagrams
  - Message flow examples
  - Advanced scenario coverage
  - Color-coded event logs

---

## Contributing

When adding new scenarios:
1. Use consistent color coding
2. Include both diagram and event log
3. Show all layers (WebSocket + RPC + A2A)
4. Add timing information
5. Document edge cases and errors

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────┐
│ LAYER                  │ KEY CONCEPTS                       │
├────────────────────────┼────────────────────────────────────┤
│ TCP                    │ SYN, SYN-ACK, ACK handshake        │
│ WebSocket              │ HTTP upgrade, frames, opcodes      │
│ RPC (CapnWeb)          │ Request ID, method, params, result │
│ A2A Protocol           │ Tasks, messages, states, artifacts │
│                        │                                    │
│ PATTERN                │ USE CASE                           │
├────────────────────────┼────────────────────────────────────┤
│ Request/Reply          │ Quick operations (getTask)         │
│ Streaming              │ Real-time updates (long tasks)     │
│ Capability Stubs       │ Authentication & authorization     │
│ Async Processing       │ Non-blocking task execution        │
│                        │                                    │
│ TROUBLESHOOTING        │ CHECK                              │
├────────────────────────┼────────────────────────────────────┤
│ Timeout                │ Network connectivity, server load  │
│ Auth failure           │ Token validity, permissions        │
│ Task error             │ State transitions, ownership       │
│ Connection drops       │ Cleanup, pending requests cleared  │
└────────────────────────┴────────────────────────────────────┘
```
