# Spec Updates and Conformance Log

This document is maintained (partly) by automation to track how `a2aWebCap` reacts to
upstream spec changes in:

- the **a2a protocol**
- the **capnweb** transport layer
- the **WebSockets** layer (RFC 6455 and project-specific profiles)

Each entry should be **append-only** to preserve history. Agents may add new sections
but should not rewrite past entries, except to fix typos.

---

## Legend

- **Specs**:
  - `a2a`: core protocol semantics, message shapes, error model.
  - `capnweb`: transport semantics, framing, serialization details.
  - `websockets`: baseline wire protocol behavior (RFC 6455 + project profile).
- **Impact levels** (rough guideline for automation):
  - `info`: documentation clarification, no code changes required.
  - `minor`: small, backwards-compatible behavior/field additions.
  - `major`: larger behavior changes, but migration can be mostly automatic.
  - `breaking`: incompatible changes requiring careful rollout / version negotiation.
  - `security`: changes related to vulnerabilities, mitigations, or hardening.

---

## 2025-11-14 – Initial baseline

**Specs checked**

- `a2a` – assumed baseline `v1.0.0`
- `capnweb` – assumed baseline `v0.1.0`
- `websockets` – profile `rfc6455-baseline`

**Summary**

- This is the initial baseline entry for the spec monitor.
- `SPEC_SOURCES.md` has been created with placeholder versions and URLs.
- No upstream diffs have been evaluated yet; future runs of the spec-monitoring agent
  should add new entries below.

**Impact**

- `impact_level`: `info`
- No code changes required at this time.

**Related Issues**

- _None yet_ (initial setup).

---

## Template for Future Entries (for agents and humans)

Agents should use the following structure when appending new entries:

```markdown
## YYYY-MM-DD – <Short description of change>

**Specs checked**

- `a2a` – from `<old_version>` to `<new_version>` (if changed)
- `capnweb` – from `<old_version>` to `<new_version>` (if changed)
- `websockets` – profile `<old_profile>` → `<new_profile>` (if applicable)

**Summary**

- High-level description of upstream changes, focusing on what is relevant for
  a2aWebCap.
- Bullet points for major new features, deprecations, or behavior changes.

**Conformance Gap**

- `a2a`:
  - ✅ Items already compliant.
  - ⚠️ Items requiring changes (with brief notes).
  - ❓ Items requiring design decisions.
- `capnweb`:
  - same pattern as above.
- `websockets`:
  - note any errata, security guidance, or profile changes.

**Impact**

- `impact_level`: `info | minor | major | breaking | security`
- Notes on downstream impact (for consumers of a2aWebCap).

**Related Issues**

- `#<issue-number>` – description
- `#<issue-number>` – description
```
