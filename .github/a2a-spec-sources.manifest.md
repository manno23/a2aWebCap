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
- `current_version`: `"v0.2.0"`  
- `status`: `"tracking"`  <!-- "tracking"|"pinned"|"legacy" -->
- `official_spec_url`:  
  `https://github.com/cloudflare/capnweb`
- `changelog_url`:  
  `https://github.com/cloudflare/capnweb/releases`
- `news_and_updates_urls`:
  - `https://github.com/cloudflare/capnweb`
  - `https://www.npmjs.com/package/capnweb`

### Build Compatibility Matrix

| Feature | capnweb | a2aWebCap | Status |
|---------|---------|-----------|---------|
| Node Engines | `>=18` | `>=18` | ✅ Aligned |
| TypeScript | `^5.9.3` | `^5.9.3` | ✅ Aligned |
| Module System | ESM (`"type": "module"`) | ESM (`"type": "module"`) | ✅ Aligned |
| Module Resolution | `NodeNext` | `NodeNext` | ✅ Aligned |
| JS Target | `ES2020` (ESNext dev) | `ES2022` | ⚠️ Compatible |
| Build Tool | `tsup` (ESM+CJS) | `tsc` | ⚠️ Different |
| Export Maps | Full conditional exports | Basic | ⚠️ Consider upgrade |
| Workers Support | `workerd` conditionals | Planned | 🔄 In Progress |

### Implementation Notes

- **Module System**: Both projects use pure ESM with conditional exports for Workers runtime
- **Target Alignment**: Our ES2022 target is compatible with capnweb's ES2020 minimum
- **Build Tooling**: We use tsc for simplicity, capnweb uses tsup for dual ESM/CJS output
- **Workers Support**: capnweb provides special builds for `workerd` environment
- **TypeScript**: We maintain compatibility with TS 5.6+ features

### Tracking Requirements

- Monitor capnweb's `engines.node` for minimum Node version changes
- Track module type changes (ESM vs CJS)
- Watch for TypeScript version requirements
- Note any breaking changes in export maps
- Validate Workers runtime compatibility

### Update Schedule

- Check capnweb releases monthly
- Update manifest when major version changes
- Validate compatibility in CI pipeline
- Review build tool alignment quarterly

### Action Items

1. **Short Term**: Maintain current tsc-based build for development simplicity
2. **Medium Term**: Consider tsup for dual ESM/CJS output if publishing to npm
3. **Long Term**: Implement export maps similar to capnweb for Workers compatibility
4. **Ongoing**: Monitor capnweb's Workers-specific optimizations

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

