# AGENTS.md - a2aWebCap Development Guide

## Commands

```bash
npm test                    # Run all tests once
npm run test:watch        # Run tests in watch mode
npm run test:coverage     # Run tests with coverage report
npm run lint              # Lint all TypeScript files
npm run build             # Clean, install, and build all packages
npm run dev:server        # Start dev server (tsx watch)
npm run demo:capnweb      # Run CapnWeb example
```

## Architecture & Structure

**Monorepo with 3 packages** (TypeScript/Node.js):
- **shared** - A2A protocol types, interfaces, utilities (used by server & client)
- **server** - A2A server implementation with CapnWeb transport, task management, logging (pino), JWT auth
- **client** - A2A client implementation with WebSocket support

**Key Tech:**
- CapnWeb (RPC transport), WebSocket (ws), TypeScript 5, Vitest, ESLint
- Runtime: Node.js 20+, Bun (preferred) or npm
- No database; in-memory task storage

**Key Concepts:**
- A2A Protocol v0.4.0: message/send, message/stream, tasks/*, agent.json discovery
- Capability-based security model, promise pipelining for low latency
- Bidirectional streaming with callbacks, comprehensive test coverage

## Code Style & Conventions

**TypeScript:** Strict mode, ES2022 target, ESNext modules
- **ESLint:** @typescript-eslint/recommended ruleset (root: true)
- **Formatting:** Follow ESLint rules; use @typescript-eslint conventions
- **Imports:** Use named exports from @a2a-webcap/shared; relative paths within packages
- **Types:** All code must be strictly typed; avoid any; use interfaces/types
- **Error Handling:** Structured logging with pino; throw typed errors with context
- **Naming:** camelCase for vars/functions, PascalCase for types/classes, UPPER_SNAKE_CASE for constants
- **Async:** Prefer async/await; handle Promise rejections explicitly
