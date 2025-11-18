# AGENTS.md — top of the file

## Mandatory for all agents working on @a2a/capnwebrpc
- Never implement a session state machine. The runtime already provides identity, pipelining, streaming, and revocation.
- All code must import only from "cloudflare:capnweb" and "@a2a/types" (workspace).
- Note this is NOT capnproto, but a web library by cloudlfare at github.com/cloudflare/capnweb
- Package size must stay < 15 kB gzipped — check with `du -h dist/` after every build.
- Never mark a phase complete until the Verification agent signs with the exact format:
  VERIFICATION PASSED — Phase X
  Evidence: ...
- Maintain exactly two living documents at the repository root: PLAN.md and STATUS.md
- Biome is the only linter/formatter. Run `biome check --apply` before any commit.
- Tests must use the in-process MockSturdyRef — never require Miniflare or wrangler in unit tests.

