# GitHub Workflows Guide for a2aWebCap

**Date:** 2025-11-17
**Context:** Migrating from broken spec checks to functional validation

---

## Summary of Changes

### What Was Broken

The project had a workflow checking for `@a2aproject/a2a-types@0.4.0` which **does not exist on npm**. This was causing all CI builds to fail.

```bash
Error: Cannot find module '@a2aproject/a2a-types/package.json'
```

### What Was Fixed

1. ✅ Removed non-existent package check
2. ✅ Switched from `npm` to `pnpm` in workflows (matching local dev)
3. ✅ Kept the **capnweb compatibility check** which actually validates useful things
4. ✅ Added build step to catch compilation errors

---

## Understanding the Architecture

### A2A Protocol vs capnweb Transport

```
┌─────────────────────────────────────┐
│      A2A Protocol Layer             │
│  (Your types in shared/a2a-types)   │
├─────────────────────────────────────┤
│      capnweb Transport Layer        │
│  (Cloudflare's capability model)    │
├─────────────────────────────────────┤
│      WebSocket/HTTP Layer           │
│  (Network transport)                │
└─────────────────────────────────────┘
```

**Your codebase:**
- **Implements A2A protocol** using custom types (`packages/shared/src/a2a-types.ts`)
- **Uses capnweb** as the transport layer (Cloudflare's capability-based networking)
- **NOT consuming** an upstream `@a2aproject/a2a-types` package (it doesn't exist)

---

## Current Workflow Setup

### `.github/workflows/validation.yml`

```yaml
name: Validation
on:
  push:
    branches: [main, '**']
  pull_request:

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Build packages
        run: pnpm run build

      - name: Run tests
        run: pnpm test

      - name: Check capnweb build compatibility
        run: pnpm run capnweb:compat-check
```

**What this validates:**
- ✅ Code compiles (build step)
- ✅ Tests pass
- ✅ Build configuration matches capnweb requirements (Node version, TS version, module system, etc.)

---

## Wrangler GitHub Actions Integration

### Yes, Wrangler Has Official GitHub Actions!

Cloudflare provides `cloudflare/wrangler-action@v3` for deploying Workers.

### Option 1: Deploy on Push to Main

```yaml
# .github/workflows/deploy.yml
name: Deploy to Cloudflare Workers

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    name: Deploy
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Build
        run: pnpm run build

      - name: Deploy Server to Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          workingDirectory: 'packages/server'
          command: deploy
```

### Option 2: Preview Deployments for PRs

```yaml
# .github/workflows/preview.yml
name: Preview Deployment

on:
  pull_request:

jobs:
  preview:
    runs-on: ubuntu-latest
    name: Preview
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Build
        run: pnpm run build

      - name: Deploy Preview
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          workingDirectory: 'packages/server'
          command: deploy --env preview

      - name: Comment PR with Preview URL
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '🚀 Preview deployed! Check it out.'
            })
```

### Option 3: Deploy Multiple Workers

```yaml
- name: Deploy Server
  uses: cloudflare/wrangler-action@v3
  with:
    apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    workingDirectory: 'packages/server'
    command: deploy

- name: Deploy Client Assets
  uses: cloudflare/wrangler-action@v3
  with:
    apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    workingDirectory: 'packages/client'
    command: deploy
```

---

## Setting Up Cloudflare Secrets

### 1. Get API Token

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Create Token → Custom Token
3. Permissions needed:
   - **Account** → Workers Scripts → Edit
   - **Account** → Workers Routes → Edit
   - **Zone** → Workers Routes → Edit (if using routes)

### 2. Add to GitHub

1. Go to your repo → Settings → Secrets and variables → Actions
2. New repository secret
3. Name: `CLOUDFLARE_API_TOKEN`
4. Value: `<your-token>`

### 3. Optional: Account ID

Some commands need your Account ID:

```yaml
- name: Deploy with Account ID
  uses: cloudflare/wrangler-action@v3
  with:
    apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
    workingDirectory: 'packages/server'
```

---

## Better Validation Strategies

### Strategy 1: Schema Validation (Recommended)

Instead of checking against a non-existent upstream package, validate your own schema:

```yaml
# Add to validation.yml
- name: Validate A2A Type Schema
  run: |
    # Ensure types compile
    pnpm --filter @a2awebcap/shared run build

    # Optional: JSON schema validation
    pnpm run validate-a2a-schema
```

Create a script to validate your types match your schema:

```typescript
// scripts/validate-a2a-schema.ts
import { z } from 'zod';
import type * as A2A from '../packages/shared/src/a2a-types';

// Define expected schema structure
const A2AMessageSchema = z.object({
  // Define your expected A2A message structure
});

// Validate runtime data against schema
export function validateA2AMessage(msg: unknown): msg is A2A.Message {
  return A2AMessageSchema.safeParse(msg).success;
}
```

### Strategy 2: Integration Tests

Test actual A2A protocol communication:

```yaml
- name: Run Integration Tests
  run: pnpm run test:integration
  env:
    TEST_SERVER_URL: http://localhost:8787
```

### Strategy 3: capnweb Compatibility (Already Have This!)

Your `capnweb:compat-check` script is excellent - it validates:
- ✅ Node version compatibility
- ✅ TypeScript version alignment
- ✅ Module system (ESM vs CJS)
- ✅ Module resolution strategy
- ✅ JavaScript target compatibility
- ✅ Build tool differences

**Keep this!** It's more valuable than checking a non-existent package.

---

## Recommended Workflow Structure

```
.github/workflows/
├── validation.yml       # ✅ Already updated - runs on all branches
├── deploy.yml           # New: Deploy to production on main
├── preview.yml          # New: Preview deployments for PRs
└── release.yml          # New: Versioning and releases
```

### Minimal Production Setup

If you just want basic CI/CD:

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD

on:
  push:
    branches: [main]
  pull_request:

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm run build
      - run: pnpm test
      - run: pnpm run capnweb:compat-check

  deploy:
    needs: validate
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm run build
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          workingDirectory: 'packages/server'
```

---

## Wrangler CLI in Workflows

Wrangler can do more than just deploy:

### Run Tests in Workers Runtime

```yaml
- name: Test in Workers Runtime
  run: pnpm --filter @a2awebcap/server exec wrangler dev --test
```

### Type Check Workers Bindings

```yaml
- name: Check Workers Types
  run: pnpm --filter @a2awebcap/server exec wrangler types
```

### Tail Logs (for debugging)

```yaml
- name: Tail Deployment Logs
  run: pnpm --filter @a2awebcap/server exec wrangler tail
```

---

## Next Steps

### Immediate (Do Now)

1. ✅ **Already done**: Removed broken `a2a:spec-check`
2. ✅ **Already done**: Updated validation workflow to use pnpm
3. ⏳ **Optional**: Add Wrangler deployment workflow

### Short Term (This Week)

1. Create `CLOUDFLARE_API_TOKEN` secret if deploying
2. Test the validation workflow on a PR
3. Consider adding schema validation script

### Medium Term (This Month)

1. Set up preview deployments for PRs
2. Add integration tests against deployed Workers
3. Set up monitoring/alerting for deployments

---

## Resources

- **Wrangler Action**: https://github.com/cloudflare/wrangler-action
- **Wrangler CLI Docs**: https://developers.cloudflare.com/workers/wrangler/
- **pnpm GitHub Actions**: https://pnpm.io/continuous-integration
- **Cloudflare Workers**: https://developers.cloudflare.com/workers/
- **capnweb GitHub**: https://github.com/cloudflare/capnweb

---

## FAQ

### Q: Why remove the A2A spec check?

**A:** The package `@a2aproject/a2a-types` doesn't exist on npm. The check was referencing a placeholder that was never updated. Your types in `packages/shared/src/a2a-types.ts` are your source of truth.

### Q: Should I publish my own `@a2awebcap/a2a-types` package?

**A:** Only if you want to share your A2A type definitions with other projects. For a monorepo where types are only used internally, keeping them in `packages/shared` is fine.

### Q: How do I validate my A2A implementation?

**A:** The capnweb compatibility check validates your build configuration. For protocol compliance, add integration tests that actually send/receive A2A messages.

### Q: Can Wrangler deploy to multiple environments?

**A:** Yes! Use `wrangler.toml` environments:

```toml
# packages/server/wrangler.toml
name = "a2a-server"

[env.preview]
name = "a2a-server-preview"

[env.staging]
name = "a2a-server-staging"
```

Then deploy with: `wrangler deploy --env preview`

---

## Summary

**Before:**
- ❌ Checking non-existent npm package
- ❌ Using npm instead of pnpm
- ❌ All CI builds failing

**After:**
- ✅ Validating actual build configuration
- ✅ Using pnpm consistently
- ✅ Builds passing
- ✅ Ready for Wrangler deployment integration

**Your validation now checks:**
1. Code compiles (`pnpm run build`)
2. Tests pass (`pnpm test`)
3. Configuration matches capnweb (`pnpm run capnweb:compat-check`)

This is **more valuable** than checking against a non-existent upstream package!
