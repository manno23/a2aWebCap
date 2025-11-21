# @a2a-webcap/server

This package now focuses on the shared runtime pieces needed to host A2A over CapnWeb. It exports:

- Core services (authentication, task/session management, streaming utilities)
- Sturdy ref abstractions that make it possible to target different persistent endpoints
- An in-memory sturdy ref factory for fast, dependency-free testing
- An opt-in `startStandaloneServer` helper that wires the HTTP/WebSocket server without running on import

To run the standalone server locally:

```bash
npm run dev:server
```

To consume the library components:

```ts
import { InMemorySturdyRefFactory, startStandaloneServer } from '@a2a-webcap/server';
```
