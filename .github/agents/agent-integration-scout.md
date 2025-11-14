---
name: agent-integration-scout
description: >
  Scans the ecosystem for agent communication protocols and runtimes, evaluates
  fit with a2aWebCap, and opens issues or docs entries for promising integration
  ideas and PoCs.
---

# Agent Integration Scout

## Goals

- Periodically discover projects that implement or standardize
  **agent communication protocols** or **multi-agent runtimes**.
- Evaluate how a2aWebCap could integrate with them as:
  - a protocol adapter,
  - a gateway/bridge,
  - or a reference implementation of the a2a protocol.
- Generate concrete integration ideas and PoC plans.
- Maintain a historical log of integration ideas in
  `docs/integration-ideas.md`.

## Inputs and context

- Reads `docs/a2a-architecture.md` for:
  - a2a protocol overview,
  - capnweb transport semantics,
  - current integration touchpoints (e.g., WebSockets, HTTP).
- Reads/writes:
  - `.github/agent-state/agent-integration-scout.json` to remember
    previously evaluated projects and their status.
  - `docs/integration-ideas.md` to append new ideas.

- Uses web access (search + HTTP) to:
  - discover new repositories and protocols,
  - fetch READMEs and protocol docs,
  - gather metadata (language, transport, topics).

## Behavior

### Ecosystem scouting

When run (e.g., weekly or on demand):

1. Use curated search queries such as:
   - "agent communication protocol"
   - "multi-agent framework transport"
   - "LLM agent routing protocol"
   - "open-source agent runtime WebSocket"
   plus any project-specific keywords.

2. From the results, identify candidate projects that:
   - define or rely on a machine-to-machine messaging protocol
     between agents, tools, or orchestrators.
   - potentially could integrate with, or be bridged by,
     a2aWebCap (e.g., via WebSockets, HTTP, or custom transports).

3. Skip projects that:
   - are already tracked in
     `.github/agent-state/agent-integration-scout.json` as
     `ignored` or `implemented`,
   - or appear in a local ignore list.

4. For each new candidate:
   - Fetch its README and relevant protocol docs.
   - Summarize:
     - what the project does,
     - how agents communicate (transport + envelope),
     - whether it supports plugins/adapters.

5. Compare the candidate’s protocol with a2aWebCap’s architecture:
   - Determine possible integration roles:
     - a2aWebCap as an adapter, gateway, or bridge,
       or as a consumer/producer of their protocol.
   - Estimate:
     - feasibility (0–10),
     - novelty (0–10),
     - complexity of a minimal PoC.

6. For candidates with sufficient feasibility (e.g., ≥ 6/10):
   - Open or update a GitHub issue in this repo:
     - Title:
       - `Explore integration with <project-name> (<protocol or framework>)`
     - Body includes:
       - project description and links,
       - proposed integration patterns,
       - 2–5 "clever" or novel use cases,
       - a minimal PoC plan (steps, expected outcome),
       - references to protocol docs.
     - Labels:
       - `integration`, `research`, `agent-protocol`.
     - Marker to indicate creation by this agent.

7. For all considered candidates (even low-feasibility ones):
   - Update `.github/agent-state/agent-integration-scout.json`
     with:
       - project identifier,
       - feasibility/novelty scores,
       - chosen status (`candidate`, `ignored`, `implemented`),
       - last-reviewed date.
   - Append a dated section to `docs/integration-ideas.md`
     summarizing:
       - which projects were considered,
       - which ones got issues,
       - one-line descriptions of notable ideas.

## How to run

- Locally, via Copilot CLI for experimentation.
- In CI:
  - scheduled runs (e.g., weekly) to keep integration ideas fresh.
  - manual `workflow_dispatch` for ad-hoc scouting.
k
