# MODULE_NOT_FOUND Investigation

**Date:** 2025-11-17
**Error:** `Cannot find module '@a2aproject/a2a-types/package.json'`
**Context:** Running `pnpm run a2a:spec-check` (script: `tsx scripts/a2a-spec-check.ts`)

---

## Error Breakdown

### What the Error Means

```
Error: Cannot find module '@a2aproject/a2a-types/package.json'
Require stack:
- /home/jm/code/a2aWebCap/scripts/a2a-spec-check.ts
```

**Translation:**
1. The script `scripts/a2a-spec-check.ts` is trying to find the package `@a2aproject/a2a-types`
2. Specifically, it's trying to resolve the path to this package's `package.json` file
3. Node.js cannot find this package in `node_modules/`
4. The error occurs at line 20-23 of the script

---

## Root Cause Analysis

### The Script's Purpose

The `a2a-spec-check.ts` script:
1. Reads `.github/a2a-spec.json` which specifies:
   - Protocol: `"a2a"`
   - Official package: `"@a2aproject/a2a-types"`
   - Expected version: `"0.4.0"`

2. Tries to find the installed package using `require.resolve()`
3. Compares installed version vs expected version
4. Exits with error if there's a mismatch

### Why It's Failing

**The package `@a2aproject/a2a-types` is NOT installed anywhere in the monorepo.**

Evidence:
- ✗ Not in root `package.json` dependencies
- ✗ Not in root `package.json` devDependencies
- ✗ Not found in any workspace package (`packages/*/package.json`)
- ✗ Not in `pnpm list` output

---

## The Missing Package

### What is `@a2aproject/a2a-types`?

This appears to be the **official A2A protocol type definitions** package from the A2A project.

Expected location: https://www.npmjs.com/package/@a2aproject/a2a-types

### Current State

The project has its **own** type definitions in `packages/shared/src/a2a-types.ts`, which may be:
1. A custom implementation of A2A types
2. An extended/modified version of the official types
3. A completely independent implementation

---

## Solutions

### Option 1: Install the Official Package (Recommended if using official spec)

```bash
# Install at root for spec checking
pnpm add -D @a2aproject/a2a-types

# Or install in shared package
cd packages/shared
pnpm add @a2aproject/a2a-types
```

**When to choose this:**
- You want to track compliance with official A2A spec
- You want to ensure type compatibility
- You're building an A2A-compliant implementation

### Option 2: Remove the Spec Check (If not tracking official spec)

```bash
# Remove the script from package.json
# Delete .github/a2a-spec.json
# Delete scripts/a2a-spec-check.ts
```

**When to choose this:**
- You're building a custom A2A implementation
- You don't need to track the official spec version
- You're using your own type definitions

### Option 3: Update the Spec Check to Use Local Types

Modify `scripts/a2a-spec-check.ts` to check your local implementation:

```typescript
// Instead of checking @a2aproject/a2a-types
// Check packages/shared/package.json
const pkgJsonPath = path.join(repoRoot, 'packages/shared/package.json');
```

**When to choose this:**
- You maintain your own A2A types
- You want to track your own versioning
- You're not concerned with official spec compliance

---

## Investigation Questions

1. **Is this project meant to be A2A spec-compliant?**
   - If YES → Install `@a2aproject/a2a-types` and use it
   - If NO → Remove the spec check machinery

2. **Does `@a2aproject/a2a-types` exist on npm?**
   - Check: `npm view @a2aproject/a2a-types`
   - If it doesn't exist, the spec check is referencing a non-existent package

3. **Is `packages/shared/src/a2a-types.ts` based on the official types?**
   - If YES → Consider importing from official package
   - If NO → You're maintaining a fork/custom implementation

4. **When was `.github/a2a-spec.json` created?**
   - Was it part of a template/starter project?
   - Was it manually added with intention?
   - Is it orphaned configuration from a different workflow?

---

## Related Files

- `scripts/a2a-spec-check.ts` - The failing script (lines 20-23)
- `.github/a2a-spec.json` - Spec configuration
- `packages/shared/src/a2a-types.ts` - Local type definitions
- `package.json` - Root dependencies (missing `@a2aproject/a2a-types`)

---

## Recommended Next Steps

1. **Verify the package exists:**
   ```bash
   npm view @a2aproject/a2a-types
   ```

2. **If it exists, install it:**
   ```bash
   pnpm add -D @a2aproject/a2a-types@0.4.0
   ```

3. **If it doesn't exist:**
   - Remove `.github/a2a-spec.json`
   - Remove the `a2a:spec-check` script from `package.json`
   - Delete `scripts/a2a-spec-check.ts`
   - Update any GitHub workflows that reference this check

4. **Document the decision:**
   - Add to project README whether this is spec-compliant or custom
   - Document why you chose to use/not use official types

---

## Technical Details

### Error Location (scripts/a2a-spec-check.ts:20-23)

```typescript
const pkgJsonPath = require.resolve(
  path.join(spec.officialPackage, 'package.json'),  // '@a2aproject/a2a-types/package.json'
  { paths: [repoRoot] }  // Search from repo root
);
```

**What `require.resolve()` does:**
- Searches for a module using Node.js module resolution
- Looks in `node_modules/` directories
- Returns absolute path if found
- Throws `MODULE_NOT_FOUND` if not found

### The Resolution Path

Node looks for:
1. `/home/jm/code/a2aWebCap/node_modules/@a2aproject/a2a-types/package.json`
2. `/home/jm/code/node_modules/@a2aproject/a2a-types/package.json`
3. `/home/jm/node_modules/@a2aproject/a2a-types/package.json`
4. `/home/node_modules/@a2aproject/a2a-types/package.json`
5. `/node_modules/@a2aproject/a2a-types/package.json`

All of these fail → `MODULE_NOT_FOUND`

---

## Conclusion

**The error is clear:** The script expects `@a2aproject/a2a-types` to be installed, but it isn't.

**Decision needed:** Choose one of the three solutions above based on your project's relationship to the official A2A specification.

**Immediate workaround:** Comment out or remove the `a2a:spec-check` script from `package.json` until you decide how to handle this.
