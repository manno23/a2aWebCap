# Prompts for the world-class, slow, precise coding agent (GPT-5.1-Codex-Max)

These prompts assume the agent has hours to work carefully. They bake in the repository norms (AGENTS.md), the Cap'n Web + A2A goal, and the "build, then simplify" ethos. Send them sequentially.

## Prompt 1 — Align on mission, constraints, and guardrails
```
You are GPT-5.1-Codex-Max working in /workspace/a2aWebCap.
Mission: map the A2A protocol onto capnwebrpc, with an initial sturdy ref design and Cloudflare Durable Object servers.
Guardrails (from AGENTS.md):
- Never implement a session state machine (runtime already provides identity, pipelining, streaming, revocation).
- Import only from "cloudflare:capnweb" and "@a2a/types".
- Keep package size < 15 kB gzipped.
- Use MockSturdyRef for tests; never require Miniflare/wrangler.
- Run `biome check --apply` before commits.
- Maintain PLAN.md and STATUS.md (do not delete/replace).
- Verification format: "VERIFICATION PASSED — Phase X" with Evidence.
Culture: build the feature, then refactor and simplify aggressively.
Task: propose a phased plan (with evidence criteria per phase) to land sturdy ref support and capnweb A2A integration. End with a checklist of files to inspect (respect AGENTS scopes).
```

## Prompt 2 — Inventory and design choices
```
Read AGENTS.md (already summarized) and scan docs/ for existing design notes on capnweb, A2A, sturdy refs. List:
- Key design decisions already made.
- Gaps to close for sturdy ref mint/resolve.
- Proposed minimal TypeScript surface (types, functions) consistent with imports rule.
Output a short design brief + file edit plan. Do NOT write code yet.
```

## Prompt 3 — Implement sturdy ref core (focused, minimal)
```
Implement the minimal sturdy ref helpers in the proper package (respect AGENTS.md import rules). Deliver:
- mintSturdyRef(config, bindingName, id)
- resolveSturdyRef(config, refString, serviceClass)
Use cloudflare:capnweb Rpc.bootstrap and DurableObjectNamespace.idFromString/get; no session state machine. Keep the file small. Add focused unit tests using MockSturdyRef; no Miniflare/wrangler. Run `biome check --apply` and tests.
Return:
- Patched files summary
- Test commands + results
- gzipped size check (`du -h dist/` or equivalent after build)
- Verification line.
```

## Prompt 4 — Wire Cap'n Web A2A boundary to internal OCL
```
Add a boundary adapter that converts incoming capnweb:// sturdy refs (from Agent Cards/A2A identity) into internal capability descriptors (OCL strings). Keep logic minimal: parse URI -> binding -> id -> Rpc.handle, and expose an intent descriptor for internal plugins. Update docs to show the flow (Agent Card → capnweb sturdy ref → OCL → plugin/effect). Tests with MockSturdyRef only. Run biome + tests. End with Verification line.
```

## Prompt 5 — Plugin/examples + refactor/simplify
```
Add one minimal example plugin (Effect.ts style) that declares and uses an OCL path backed by sturdy ref resolution. Keep it tiny. Refactor for brevity and clarity; delete duplication. Re-run biome + tests. Provide Verification line and note any size impact.
```

## Prompt 6 — Retrospective + next steps
```
Summarize what landed, what remains, and propose the next simplification passes. Confirm package size, test status, and any debt. Close with a final "VERIFICATION PASSED — Phase N" line.
```

## Usage notes
- Always follow prompts in order; do not skip biome/tests.
- Keep responses concise and actionable; prefer bullet lists over prose.
- When unsure, prioritize minimal viable implementation that respects the guardrails.
