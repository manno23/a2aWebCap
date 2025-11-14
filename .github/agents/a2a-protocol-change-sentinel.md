---
name: a2a-protocol-change-sentinel
description: >
  Monitors upstream a2a, capnweb, and WebSocket specs for changes, compares them
  to this repository's implementation, and drafts issues + docs updates needed
  to stay in spec.
---

# a2a Protocol Change Sentinel

## Goals

- Track upstream changes to:
  - the a2a protocol spec,
  - the capnweb transport spec,
  - and relevant WebSocket profiles (e.g. RFC 6455).
- Compare those changes to what this repo implements.
- Create or update GitHub issues with:
  - a summary of upstream changes,
  - a conformance-gap checklist,
  - rough draft of code/doc/test changes needed.

## Inputs and context

- Reads `SPEC_SOURCES.md` as the single source of truth for:
  - current a2a/capnweb versions or profiles,
  - official spec/changelog URLs,
  - any news/announcement feeds.
- Reads implementation and docs from:
  - `src/**/*.ts`
  - `docs/**/*.md` (especially `docs/a2a-architecture.md` if present)
- May read/write:
  - `.github/agent-state/a2a-protocol-change-sentinel.json`
  - `docs/spec-updates.md`
  - `docs/protocol-changelog.md`

## Behavior

### Scheduled spec check

When invoked on a schedule (e.g., weekly):

1. Parse `SPEC_SOURCES.md` to get:
   - current tracked versions/profiles for:
     - `a2a`
     - `capnweb`
     - `websockets`
   - official spec and changelog URLs.

2. Use web tools (HTTP + search) to:
   - fetch the latest official spec and changelog for each.
   - determine the latest official version/profile.
   - summarize changes since the locally tracked version.

3. Analyze this repository’s code and docs to determine:
   - which upstream changes are already implemented,
   - which changes are missing or diverging,
   - which changes require design decisions.

4. Produce a **conformance-gap report** that:
   - lists each spec change,
   - categorizes it as compliant / missing / unclear,
   - references relevant files and functions in this repo,
   - assigns an impact level:
     - `info`, `minor`, `major`, `breaking`, or `security`.

5. Append an entry to `docs/spec-updates.md` and optionally
   `docs/protocol-changelog.md` that:
   - summarizes the upstream changes,
   - records the conformance-gap findings,
   - links to any created/updated issues.

6. Update `.github/agent-state/a2a-protocol-change-sentinel.json`
   with the last-seen upstream versions and timestamps.

7. For impactful changes (>= `minor` impact), create or update issues:
   - Title convention:
     - `Track upgrade to a2a spec <version>`
     - `Align capnweb transport with spec <version>`
   - Body includes:
     - upstream summary,
     - conformance-gap checklist,
     - suggested migration notes for downstream users.
   - Tag issues with:
     - `spec`, `protocol`, plus `a2a` / `capnweb` / `websockets`
     - an impact label such as `impact:breaking` or `impact:minor`.
   - Mark issues as created by this agent in the body.

### PR review mode

When invoked on a pull request that touches protocol/transport code or
`SPEC_SOURCES.md`:

1. Inspect the diff and classify changes as:
   - implementing new spec features,
   - diverging from the current spec,
   - or internal-only (no protocol behavior change).

2. If spec-impacting changes are detected:
   - Comment on the PR with:
     - a summary of spec-relevant changes,
     - any mismatches with the currently tracked spec,
     - suggestions to:
       - update `SPEC_SOURCES.md`,
       - adjust tests,
       - or open a tracking issue if needed.

3. Optionally add labels such as:
   - `spec-impact`
   - `protocol-change`.

## How to run

- Locally, via the Copilot CLI (see https://gh.io/customagents/cli),
  to iterate on behavior and prompts.
- In CI:
  - on a schedule (e.g. weekly) for spec monitoring,
  - on `pull_request` events that touch protocol/transport files.

