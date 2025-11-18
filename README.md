# a2aWebCap

**A2A Protocol implementation using CapnWeb (Cap'n Proto) transport**

A production-ready implementation of the A2A (Agent-to-Agent) Protocol v0.4.0 using CapnWeb as the transport layer, featuring capability-based security and bidirectional streaming.

---

## 🚀 Quick Start

```bash
# Install dependencies
bun install

# Run tests
bun test

# Start server
bun run packages/server/src/index.ts
```

---

## 📚 Documentation

### Reference Documentation
- **[Specifications](docs/specifications.md)** - A2A protocol specs, authentication, and compliance
- **[Architecture](docs/architecture.md)** - System design, patterns, and mathematical framework
- **[Testing Strategy](docs/testing-strategy.md)** - Testing approaches and coverage
- **[Security Analysis](docs/security.md)** - Security analysis and transport satisfiability
- **[Integrations](docs/integrations.md)** - Integration patterns and ideas

### Project Status & Tracking
- **[Phase Reports](.opencode/context/project/phase-reports.md)** - Completed phases and next steps
- **[Compliance Status](.opencode/context/project/compliance-status.md)** - A2A compliance coverage
- **[Implementation Inventory](.opencode/context/project/implementation-inventory.md)** - Feature status
- **[Implementation Analysis](.opencode/context/project/implementation-analysis.md)** - Detailed analysis
- **[Spec Monitoring](.opencode/context/project/spec-monitoring.md)** - Tracking specification sources

### For Contributors & Agents
- **[Project Context](.opencode/context/project-context.md)** - Task planning structure
- **[Project Plan](.opencode/context/project/project-plan.md)** - Implementation roadmap
- **[Design Research](.opencode/knowledge/research/)** - Design exploration & analysis
- **[Key Decisions](.opencode/knowledge/decisions/)** - Architectural & compliance decisions
- **[Domain Knowledge](.opencode/knowledge/subject/)** - Protocol & technology knowledge
- **[Project Notes](.opencode/memory/project-notes.md)** - Architecture notes & gotchas

---

## 🎯 Features

### ✅ A2A Protocol v0.4.0 Compliance
- All required data types (Message, Task, TaskStatus, AgentCard)
- All protocol methods (message/send, message/stream, tasks/*)
- Agent card discovery (/.well-known/agent.json)
- Full test coverage (41/42 tests passing)

### ✅ CapnWeb Transport
- WebSocket-based RPC (superior to SSE)
- Bidirectional streaming with callbacks
- Capability-based security model
- Promise pipelining for low latency
- Native error handling and backpressure

### ✅ Production-Ready
- TypeScript monorepo structure
- Comprehensive test suite
- Structured logging with context
- Error handling and recovery
- In-memory task management

---

## 📦 Project Structure

```
a2aWebCap/
├── packages/
│   ├── shared/         # Shared A2A types and interfaces
│   ├── server/         # A2A server implementation
│   └── client/         # A2A client implementation
├── docs/               # Reference documentation (5 files)
├── .opencode/          # Project context for agents
│   ├── context/        # Project tracking & progress
│   ├── knowledge/      # Research & decisions
│   └── memory/         # Project notes
├── examples/           # Usage examples
└── scripts/            # Build and utility scripts
```

---

## 🔧 Development

### Prerequisites
- Bun runtime (latest)
- Node.js v18+ (for tooling)
- TypeScript 5+

### Commands
```bash
# Install dependencies
bun install

# Run all tests
bun test

# Run specific test suite
bun test packages/server/tests/e2e
bun test packages/server/tests/integration
bun test packages/server/tests/unit

# Build packages
bun run build

# Lint
bun run lint

# Type check
bun run typecheck
```

---

## 🧪 Testing

**Test Coverage:** 41/42 tests passing (1 intentionally skipped)

- **E2E Tests:** Basic flow, agent card, task management
- **Integration Tests:** Streaming, callbacks, task completion
- **Unit Tests:** Task manager, state transitions, history

---

## 🔐 Security

- **Capability-based security** - Authorization through object capabilities
- **Transport security** - TLS-ready WebSocket transport
- **No webhook infrastructure** - Native RPC callbacks
- **Formal analysis** - Transport satisfiability proofs in docs/

---

## 📊 Status

**Phase 0-3:** ✅ Complete (MVP)  
**Current Status:** Production-ready for Phase 1 MVP  
**Next:** Phase 4+ enhancements (persistence, deployment, observability)

See [Phase Reports](.opencode/context/project/phase-reports.md) for details.

---

## 🤝 Contributing

This project uses OpenCode for agent-assisted development. Key locations:

- **Task tracking:** `.opencode/context/project/`
- **Knowledge base:** `.opencode/knowledge/`
- **Project notes:** `.opencode/memory/`

---

## 📄 License

[Add license information]

---

## 🔗 Links

- [A2A Protocol Specification](https://a2a-protocol.org/)
- [CapnWeb Documentation](https://github.com/cloudflare/capnweb)
- [Project Documentation](docs/)
