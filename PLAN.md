# Plan

1. Consolidate the repository into a lean library that centers on sturdy references.
2. Keep a single shared types package (`@a2a/types`) and a focused CapnWeb transport package (`@a2a/capnwebrpc`).
3. Provide in-process test doubles for sturdy refs so unit tests never depend on a Workers runtime.
4. Ensure tooling matches current standards (Biome for linting, Vitest for tests) and remove redundant packages.
