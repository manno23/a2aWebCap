# a2aWebCap: A2A Protocol with Cap'n Proto Web Transport

**Status:** ✅ **MVP Complete** - Phases 1-3 implemented and tested

This project implements the Agent-to-Agent (A2A) communication protocol using Cloudflare's Cap'n Proto Web (capnweb) as the underlying transport
layer. It provides a robust, efficient, and secure alternative to traditional JSON-RPC or REST-based A2A implementations.

## Project Status

- ✅ **Phase 0:** Foundation reset (complete type system, test infrastructure)
- ✅ **Phase 1:** Minimal working example (client-server communication)
- ✅ **Phase 2:** Streaming & bidirectional callbacks
- ✅ **Phase 3:** Tool execution with approval workflows
- ⏳ **Phase 4:** Production readiness (authentication, persistence, monitoring)

**Total Implementation:** ~3,800 lines of production code + comprehensive test suite

See [PHASE-1-2-3-COMPLETE.md](./PHASE-1-2-3-COMPLETE.md) for detailed implementation summary.

The repository is structured as a monorepo containing:
- **`packages/server`**: A2A server implementation with task management, streaming, and tool execution
- **`packages/client`**: A2A client with WebSocket-based communication
- **`packages/shared`**: Complete A2A Protocol v0.4.0 type definitions and utilities

This implementation is based on the formal analysis and design outlined in the [design document](./.opencode/knowledge/research/design.md).

## Core Features (Implemented ✅)

The project leverages the unique capabilities of `capnweb` to enhance the A2A protocol:

### Communication
- ✅ **Native Bidirectional Communication**: Server directly invokes callback methods on clients over a single WebSocket connection
- ✅ **Real-Time Streaming**: Bidirectional task updates with automatic lifecycle management
- ✅ **WebSocket Transport**: JSON-RPC over WebSocket for efficient communication

### Task Management
- ✅ **Complete Task Lifecycle**: Create, read, update, cancel operations with state transitions
- ✅ **Message History**: Conversation tracking with optional limiting
- ✅ **Artifact Support**: Creation and update tracking
- ✅ **Context Propagation**: Consistent taskId/contextId across operations

### Tool Execution
- ✅ **Tool Registry**: Built-in tools (calculator, echo, read_file, http_request)
- ✅ **Approval Workflow**: Permission-required tools with approve/reject flow
- ✅ **Schema Validation**: Input validation against tool parameter schemas
- ✅ **Event-Driven**: Real-time status updates during execution

### Security & Architecture
- ✅ **Capability-Based Security**: Authentication yields capability-secured objects (stub implementation)
- ✅ **AgentCard Discovery**: Standard `/.well-known/agent.json` endpoint
- ✅ **Protocol Compliance**: All 5 A2A protocol invariants verified

### Testing
- ✅ **Comprehensive Test Suite**: Unit, integration, and end-to-end tests
- ✅ **80%+ Coverage**: Configured coverage thresholds
- ✅ **Protocol Assertions**: Built-in invariant validation utilities

## Getting Started

### Prerequisites

- **Node.js v22+**: This project uses Node.js with npm workspaces
- **npm 10+**: Package manager

### Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Build All Packages**
   ```bash
   npm run build
   ```

3. **Run Tests**
   ```bash
   npm test
   ```

4. **Start the Server**
   ```bash
   cd packages/server
   npm start
   ```

5. **Run the Client** (in another terminal)
   ```bash
   cd packages/client
   npm start
   ```

### Development Scripts

- `npm run build` - Build all packages (shared, server, client)
- `npm test` - Run all tests with coverage
- `npm run lint` - Lint the entire project
- `npm run clean` - Remove all `node_modules` and `dist` folders

### Environment Configuration

Create a `.env` file in `packages/server/`:

```bash
PORT=8080
HOST=localhost
AGENT_URL=http://localhost:8080
AGENT_NAME=A2A Test Agent
AGENT_DESCRIPTION=A2A protocol implementation over capnweb
```

## Architecture Overview

```
Client (WebSocket) → Server (HTTP/WS)
                     ├── A2AService (RpcTarget)
                     │   ├── TaskManager (state)
                     │   ├── StreamingTask (callbacks)
                     │   └── ToolExecutor (tools)
                     └── ToolRegistry (catalog)
```

**Key Components:**
- **TaskManager** - Task CRUD, state management, event emission
- **A2AService** - Main RPC target implementing A2A protocol methods
- **StreamingTask** - Bidirectional streaming with callback management
- **ToolExecutor** - Tool execution lifecycle with approval workflow
- **ToolRegistry** - Tool catalog with schema validation

See [PHASE-1-2-3-COMPLETE.md](./PHASE-1-2-3-COMPLETE.md) for detailed architecture.

## Testing

The project includes comprehensive test coverage:

- **Unit Tests**: TaskManager (30+ test cases)
- **Integration Tests**: Streaming (13 tests), Tool Execution (13 tests)
- **E2E Tests**: Basic flow (6+ tests)

Run tests:
```bash
npm test                  # Run all tests
npm test -- --coverage    # With coverage report
npm test -- --watch       # Watch mode
```

## Protocol Compliance

This implementation is fully compliant with **A2A Protocol v0.4.0**:

- ✅ All message types (Message, Part variants, Task, Artifact)
- ✅ All required methods (sendMessage, getTask, listTasks, cancelTask, getAgentCard)
- ✅ Streaming support (StatusUpdateEvent, ArtifactUpdateEvent)
- ✅ Tool execution (with approval workflow)
- ✅ All 5 protocol invariants verified in tests

## Documentation

- [PHASE-0-COMPLETE.md](./PHASE-0-COMPLETE.md) - Foundation reset
- [PHASE-1-2-3-COMPLETE.md](./PHASE-1-2-3-COMPLETE.md) - Implementation summary
- [README-INVESTIGATION.md](./README-INVESTIGATION.md) - Original investigation report
- [A2A-COMPLIANCE-REPORT.md](./A2A-COMPLIANCE-REPORT.md) - Protocol compliance analysis
- [docs/](./docs/) - Design documents and research
