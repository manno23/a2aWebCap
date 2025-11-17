# A2A/CapnWeb Project - Workflow Ideas & Status

## Current Situation

**Your local master:** `851a914` (with design guard workflow)  
**Last commit before workflow work:** `09887ad` (Merge PR #10)  
**Origin/master:** `fdbb77d` (has all docs - "Rename test-agents.yml to agent-integration-scout-cron.yml")

**Note:** Your local changes have **deleted documentation files** (unstaged). These files still exist in `origin/master` (commit `fdbb77d`).

## Deleted Documentation (unstaged, can be recovered)

- `docs/design.md` - Original design document
- `docs/leibniz.md` - Leibniz mathematical framework (also exists as docs/leibniz.md committed)
- `docs/integration-ideas.md` - Integration ideas
- `docs/spec-updates.md` - Specification updates
- `docs/testing-*.md` - Various testing docs
- `PHASE-*.md` files - Phase completion markers
- `A2A_IMPLEMENTATION_*.md` - Implementation analysis docs

## New/Consolidated Documentation (untracked)

- `docs/architecture.md` - Consolidated architecture (includes design.md content)
- `docs/specifications.md` - Consolidated specs
- `docs/security.md` - Security analysis
- `docs/integrations.md` - Integration ideas
- `docs/testing-strategy.md` - Testing strategy

---

## Agentic Workflow Ideas to Implement

### 1. ✅ A2A/CapnWeb Design Guard (CREATED - but removing for now)
**Status:** Created but not deployed  
**File:** `.github/workflows/a2a-capnweb-design-guard.md`  
**Purpose:** Enforce 7 architectural design principles on PRs  
**Triggers:** Pull requests to packages/\*\*/\*.ts, docs/architecture.md, docs/specifications.md  

**Features:**
- Detects violations of capability-based architecture
- Posts line-specific review comments
- Recommends BLOCK/WARN/APPROVE
- Enforces principles:
  1. HTTP as thin edge
  2. Capability-based addressing (no ID registries)
  3. Streams via capability channels
  4. No raw filesystem paths in APIs
  5. Authorization via capability possession
  6. Core types independent of HTTP
  7. No god objects

---

### 2. 📋 A2A Protocol Change Sentinel
**Status:** Planned (agent config exists: `.github/agents/a2a-protocol-change-sentinel.md`)  
**Purpose:** Monitor upstream A2A/CapnWeb/WebSocket spec changes  
**Triggers:** Weekly schedule, workflow_dispatch  

**Features:**
- Track upstream spec versions (from SPEC_SOURCES.md or .opencode/context/project/spec-monitoring.md)
- Compare with local implementation
- Create conformance-gap reports
- Open issues for spec upgrades needed
- Categorize impact: info/minor/major/breaking/security

**Tools needed:**
- web-fetch, web-search
- github (issues, repos)
- edit (for updating spec-monitoring.md)

**Safe outputs:**
- create-issue (for spec upgrade tracking)
- add-comment (for PR reviews touching protocol code)

---

### 3. 📋 Integration Scout
**Status:** Planned (agent config exists: `.github/agents/integration-scout.md`)  
**Purpose:** Discover agent communication projects on GitHub  
**Triggers:** Twice weekly (Mon/Thu), workflow_dispatch  

**Features:**
- Search GitHub for agent protocol implementations
- Evaluate integration feasibility (0-10 scale)
- Assess novelty (0-10 scale)
- Track candidates in `.github/agent-state/integration-scout.json`
- Create issues for high-feasibility candidates (>= 7)
- Update docs/integrations.md

**Tools needed:**
- github (search_repositories, search_code)
- edit (for state file and docs updates)

**Safe outputs:**
- create-issue (for integration proposals)

**Search queries:**
- `"agent communication protocol" stars:>20 NOT is:archived`
- `topic:agents stars:>20 language:typescript`
- `"multi-agent framework" in:readme stars:>20`

---

### 4. 📋 Weekly Research Report
**Status:** Idea  
**Purpose:** Research latest developments in A2A/agent protocols  
**Triggers:** Weekly schedule (Monday 9AM)  

**Features:**
- Review recent commits and issues in this repo
- Search for industry trends in agent communication
- Summarize findings in an issue or discussion
- Track emerging protocols/standards

**Tools needed:**
- github (repos, issues, commits)
- web-fetch, web-search
- edit

**Safe outputs:**
- create-discussion (for weekly reports)

---

### 5. 📋 Workflow Improvement Bot
**Status:** Idea  
**Purpose:** Analyze GitHub Actions runs and suggest improvements  
**Triggers:** Weekly schedule, after failed workflow runs  

**Features:**
- Download logs from recent workflow runs
- Identify common failure patterns
- Find performance bottlenecks
- Suggest optimizations
- Create issues with improvement recommendations

**Tools needed:**
- agentic-workflows MCP server (status, logs, audit)
- github (actions, workflows)

**Safe outputs:**
- create-issue (for improvement suggestions)

---

### 6. 📋 Issue Triage Bot
**Status:** Idea  
**Purpose:** Automatically categorize and label new issues  
**Triggers:** issues (opened, reopened)  

**Features:**
- Analyze issue content
- Categorize issue type (bug/feature/question/docs)
- Add appropriate labels
- Post helpful triage comment
- Assign to project boards

**Tools needed:**
- github (issues, labels)

**Safe outputs:**
- add-comment
- update-issue (labels)

---

### 7. 📋 PR Description Enhancer
**Status:** Idea  
**Purpose:** Automatically enhance PR descriptions with context  
**Triggers:** pull_request (opened)  

**Features:**
- Analyze PR diff
- Identify changed capabilities/interfaces
- Link to relevant design docs
- Suggest test cases
- Add checklist for reviewers

**Tools needed:**
- github (pull_requests, repos)

**Safe outputs:**
- add-comment (with enhanced description)

---

## Next Steps

### To recover your documentation:
```bash
# Option 1: Pull from origin (if origin/master has the docs)
git fetch origin
git checkout origin/master -- docs/

# Option 2: Revert to before workflow work
git checkout 09887ad -- docs/

# Option 3: Reset to origin/master (careful - will lose uncommitted work)
git fetch origin
git reset --hard origin/master
```

### To remove the design guard workflow:
```bash
# Remove workflow files
git rm .github/workflows/a2a-capnweb-design-guard.md
git rm .github/workflows/a2a-capnweb-design-guard.lock.yml
git rm test-design-guard.sh
git commit -m "chore: remove design guard workflow for now"
```

### To implement other workflows:
1. Start with **Protocol Change Sentinel** (most valuable for keeping in sync with specs)
2. Then **Integration Scout** (discover integration opportunities)
3. Consider **Workflow Improvement Bot** (analyze your GitHub Actions)

---

## Recommendations

**Priority 1:** Recover your documentation first  
**Priority 2:** Decide on consolidated docs structure (keep new consolidated files or restore old split files?)  
**Priority 3:** Implement Protocol Change Sentinel workflow  
**Priority 4:** Keep design guard workflow idea for later when you're ready to enforce architecture

The design guard workflow is excellent but might be too strict initially. Consider starting with "warning only" mode rather than blocking merges.
