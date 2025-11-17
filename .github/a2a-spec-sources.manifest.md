# Spec Sources for a2aWebCap

<!--toc:start-->
- [Spec Sources for a2aWebCap](#spec-sources-for-a2awebcap)
  - [a2a Protocol](#a2a-protocol)
  - [capnweb Transport](#capnweb-transport)
  - [WebSockets Layer](#websockets-layer)
  - [How Automation Should Use This File](#how-automation-should-use-this-file)
<!--toc:end-->

This file is the single source of truth for which upstream specs a2aWebCap **intends** to conform to,
and where this repository’s agents should look for updates or announcements.

The values here are used by automation (e.g., the `a2a-protocol-change-sentinel` agent) to:
- detect when upstream specs change,
- compare those changes against this implementation,
- and open/update tracking issues.

> NOTE: All URLs and versions are placeholders and should be updated to the correct official locations
> once they are known.

---

## a2a Protocol

- `name`: `a2a`
- `current_version`: `"v1.0.0"`  
- `status`: `"tracking"`  <!-- "tracking"|"pinned"|"legacy" -->
- `official_spec_url`:  
  `https://example.com/a2a/spec`
- `changelog_url`:  
  `https://example.com/a2a/changelog`
- `news_and_updates_urls`:
  - `https://example.com/a2a/blog`
  - `https://example.com/a2a/releases`

**Notes**

- This repository is expected to conform to the `v1.0.0` semantics of the a2a protocol,
  including message envelopes, error codes, and transport-level expectations that are delegated to capnweb.
- Changes to the a2a message schema or semantics must be reflected in the TypeScript implementation under `src/`.

---

## capnweb Transport

- `name`: `capnweb`
- `current_version`: `"v0.1.0"`  
- `status`: `"tracking"`  <!-- "tracking"|"pinned"|"legacy" -->
- `official_spec_url`:  
  `https://example.com/capnweb/spec`
- `changelog_url`:  
  `https://example.com/capnweb/changelog`
- `news_and_updates_urls`:
  - `https://example.com/capnweb/blog`
  - `https://example.com/capnweb/releases`

**Notes**

- a2aWebCap provides a capnweb-based transport layer for a2a; behavior such as framing,
  backpressure, error propagation, and serialization must follow the capnweb spec.
- When new capnweb versions introduce breaking changes, this repo should create tracking issues and
  plan upgrades, rather than silently diverging from the spec.

---

## WebSockets Layer

a2aWebCap may rely on WebSockets as an underlying substrate for some usages. The baseline
behavior is defined by RFC 6455 plus any project-specific profiles.

- `name`: `websockets`
- `current_profile`: `"rfc6455-baseline"`
- `status`: `"pinned"`  <!-- usually stable RFCs -->
- `reference_urls`:
  - `https://www.rfc-editor.org/rfc/rfc6455`
- `news_and_updates_urls`:
  - `https://www.rfc-editor.org/rfc/`  <!-- general RFC index; agent should search here as needed -->

**Notes**

- The WebSocket layer is mostly stable, but errata or security guidance may still appear.
- Project-specific constraints (message size limits, ping/pong behavior, retry semantics)
  should be documented in [`docs/architecture.md`](docs/architecture.md) and kept
  in sync with the implementation.

---

## How Automation Should Use This File

- Agents should **not** modify historical values here directly without creating a tracking
  issue or PR that explains the version bump.
- When a new upstream version is detected:
  1. Create/Update a “Track upgrade to \<spec\> \<version\>” issue.
  2. Once changes are implemented and verified, bump the `current_version`/`current_profile`
     fields in this file via a PR.
- If a spec is no longer being followed, change `status` to `"legacy"` and add a note
  explaining the rationale.
