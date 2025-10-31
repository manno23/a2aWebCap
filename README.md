# a2aWebCap: A2A Protocol with Cap'n Proto Web Transport

This project implements the Agent-to-Agent (A2A) communication protocol using Cloudflare's Cap'n Proto Web (capnweb) as the underlying transport
layer. It provides a robust, efficient, and secure alternative to traditional JSON-RPC or REST-based A2A implementations.

The repository is structured as a monorepo containing:
- **`packages/server`**: A server implementation built with TypeScript and the Bun runtime.
- **`packages/client`**: A client implementation built with TypeScript and the Bun runtime.
- **`packages/shared`**: A shared TypeScript library used by both the client and server.

This implementation is based on the formal analysis and design outlined in the [design document](./.opencode/knowledge/research/design.md).

## Core Architecture & Key Features

The project leverages the unique capabilities of `capnweb` to enhance the A2A protocol:

- **Native Bidirectional Communication**: Eliminates the need for webhook infrastructure. The server can directly invoke callback methods on the
client over a single connection, reducing latency and complexity.
- **Promise Pipelining**: Chains dependent remote procedure calls into a single network round trip, significantly improving performance for
sequential operations.
- **Capability-Based Security**: Implements a fine-grained access control model where authentication yields a temporary, capability-secured object.
This aligns with the principle of least privilege and removes the need to send credentials with every request.
- **Modern Tooling**: Utilizes **Bun** for fast performance and an all-in-one toolchain for both the client and server.

## Getting Started

### Prerequisites

- [**Bun**](https://bun.sh/): Install the Bun runtime.

### Setup

1. **Install Dependencies**
   This project uses Bun as its package manager.
   ```bash
   bun install
   ```

2. **Run the Test Script**
   The test script builds the shared library, client, and server, then starts the server, runs the client against it, and finally shuts down the server.
   ```bash
   bun test
   ```

### Development Scripts

- `bun run build`: Builds all packages (`shared`, `client`, and `server`).
- `bun run lint`: Lints the entire project.
- `bun run clean`: Removes all `node_modules` and `dist` folders.
