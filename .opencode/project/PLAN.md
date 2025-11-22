# A2A Cap'n WebRPC Implementation Plan

## Overview
This document is the single source of truth for the project's phased plan, milestones, and verification gates. It will be updated as the project progresses.

## Phased Plan
- **Phase 0 — Repository scaffolding** (complete when CI passes with empty package) ✅
- **Phase 1 — Sync @a2a/types and export them cleanly**
  - Steps:
    - Set up daily sync script from github:a2aproject/A2A/types
    - Export types cleanly in packages/types/index.ts
    - Ensure types are importable in capnwebrpc
  - Verification Gates: Types compile, no errors when imported
- **Phase 2 — Implement MockSturdyRef + Vitest suite** (≥ 50 tests, 100% coverage on core)
- **Phase 3 — Minimal viable transport:** turn DurableObjectStub → live A2A presence with zero session state
- **Phase 4 — Implement bootstrap helper and sturdy-ref serialisation/parsing**
- **Phase 5 — Full end-to-end example** (chat or counter) using only the new package
- **Phase 6 — Benchmarks** vs @a2a-js/sdk gRPC transport (target ≥ 10× smaller messages, ≥ 20× lower latency same-isolate)
- **Phase 7 — Documentation, README, migration guide, npm publish**

## Milestones and Verification Gates
Each phase requires explicit sign-off from the Verification & Analysis Agent with a signed message including evidence from:
- Lint: biome check --apply
- Types: tsc --noEmit
- Tests: vitest run --coverage
- Build: turbo run build
- Example: pnpm run example:chat

No phase is marked complete without this verification.

## Current Phase
Phase 1: Sync @a2a/types and export them cleanly