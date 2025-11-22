#!/usr/bin/env ts-node

/**
 * Architectural design guard script.
 *
 * This script runs in CI to catch obvious violations of the high-level design rules:
 *  - HTTP edge should be thin and not own runtimes.
 *  - Core capability/runtimes should not depend on HTTP.
 *  - No raw local file paths leaked from HTTP APIs.
 *  - No new single-process global registries bypassing capabilities.
 *
 * It is intentionally conservative: if it is unsure, it should warn but not fail.
 */

import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

type Violation = {
  rule: string;
  message: string;
  files: string[];
};

function getChangedFiles(): string[] {
  // Compare against the merge base, or fall back to HEAD^ if needed.
  const diffRange = "origin/main...HEAD";
  try {
    execSync("git fetch origin main --depth=1", { stdio: "ignore" });
  } catch {
    // ignore
  }
  try {
    const output = execSync(`git diff --name-only ${diffRange}`, {
      encoding: "utf8",
    }).trim();
    if (!output) {
      // Fallback to last commit diff in case main is not available (e.g. local runs)
      return execSync("git diff --name-only HEAD~1", {
        encoding: "utf8",
      })
        .trim()
        .split("\n")
        .filter(Boolean);
    }
    return output.split("\n").filter(Boolean);
  } catch {
    // final fallback
    return [];
  }
}

function readFileIfExists(path: string): string {
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf8");
}

/**
 * Rule 1: HTTP edge should not directly depend on core runtime internals.
 *
 * For example, files under packages/server/http or similar should not import
 * low-level runtime implementation modules directly; they should go through
 * capability interfaces / service abstractions.
 */
function checkHttpEdgeImports(files: string[]): Violation | null {
  const httpFiles = files.filter(
    (f) =>
      f.startsWith("packages/server") &&
      (f.includes("/http/") ||
        f.includes("/routes/") ||
        f.includes("/api/")) &&
      f.endsWith(".ts"),
  );

  const suspectImports: string[] = [];

  for (const file of httpFiles) {
    const source = readFileIfExists(file);
    if (!source) continue;

    // Heuristics: look for imports of modules that look like runtime/agent internals.
    const patterns = [
      /from\s+["'].*runtime["'];?/,
      /from\s+["'].*conversation["'];?/,
      /from\s+["'].*process["'];?/,
      /from\s+["'].*agent.*["'];?/,
    ];

    if (patterns.some((p) => p.test(source))) {
      suspectImports.push(file);
    }
  }

  if (suspectImports.length === 0) return null;

  return {
    rule: "HTTP edge imports runtime internals",
    message:
      "HTTP layer files appear to import runtime/agent internals directly. " +
      "Prefer going through capability-based interfaces or service abstractions.",
    files: suspectImports,
  };
}

/**
 * Rule 2: No new global registries bypassing capabilities.
 *
 * We flag new uses of top-level Maps/Sets in server code as suspicious.
 * This is heuristic but can catch regressions toward ID-based registries.
 */
function checkGlobalRegistries(files: string[]): Violation | null {
  const serverFiles = files.filter(
    (f) => f.startsWith("packages/server") && f.endsWith(".ts"),
  );
  const suspects: string[] = [];

  for (const file of serverFiles) {
    const source = readFileIfExists(file);
    if (!source) continue;

    // naive detection of top-level Map/Set declarations
    if (
      /\bconst\s+\w+\s*=\s*new\s+Map\s*</.test(source) ||
      /\bconst\s+\w+\s*=\s*new\s+Set\s*</.test(source)
    ) {
      suspects.push(file);
    }
  }

  if (suspects.length === 0) return null;

  return {
    rule: "Global registry heuristic",
    message:
      "New top-level Maps/Sets in server code may represent ad-hoc registries " +
      "that bypass capability-based addressing. Consider modeling these as " +
      "capability-aware services instead.",
    files: suspects,
  };
}

/**
 * Rule 3: No raw local filesystem paths leaked from HTTP APIs.
 *
 * We look for obvious patterns of returning `filePath` or similar from HTTP
 * handlers in server code.
 */
function checkFilePathLeaks(files: string[]): Violation | null {
  const serverFiles = files.filter(
    (f) => f.startsWith("packages/server") && f.endsWith(".ts"),
  );
  const suspects: string[] = [];

  for (const file of serverFiles) {
    const source = readFileIfExists(file);
    if (!source) continue;

    // Look for typical patterns like `filePath` in response bodies.
    if (
      /filePath\s*[:=]\s*/.test(source) ||
      /localPath\s*[:=]\s*/.test(source)
    ) {
      suspects.push(file);
    }
  }

  if (suspects.length === 0) return null;

  return {
    rule: "File path leak heuristic",
    message:
      "HTTP responses appear to include raw filesystem paths (e.g. filePath/localPath). " +
      "Prefer returning opaque FileRef capabilities or URLs managed by a dedicated file service.",
    files: suspects,
  };
}

/**
 * Rule 4: Shared/core types polluted with HTTP-specific concerns.
 *
 * We look for imports of express/fastify/http related modules inside shared
 * package code.
 */
function checkSharedHttpCoupling(files: string[]): Violation | null {
  const sharedFiles = files.filter(
    (f) => f.startsWith("packages/shared") && f.endsWith(".ts"),
  );
  const suspects: string[] = [];

  for (const file of sharedFiles) {
    const source = readFileIfExists(file);
    if (!source) continue;

    if (
      /from\s+["']express["']/.test(source) ||
      /from\s+["']http["']/.test(source) ||
      /from\s+["']fastify["']/.test(source)
    ) {
      suspects.push(file);
    }
  }

  if (suspects.length === 0) return null;

  return {
    rule: "Shared/core HTTP coupling",
    message:
      "Shared/core types are importing HTTP libraries. Core capability models " +
      "should remain independent of HTTP; move HTTP-specific concerns to the edge layer.",
    files: suspects,
  };
}

function main() {
  const changedFiles = getChangedFiles();
  if (changedFiles.length === 0) {
    console.log("No changed files detected for design review.");
    return;
  }

  const violations: Violation[] = [];
  const maybe = (v: Violation | null) => v && violations.push(v);

  maybe(checkHttpEdgeImports(changedFiles));
  maybe(checkGlobalRegistries(changedFiles));
  maybe(checkFilePathLeaks(changedFiles));
  maybe(checkSharedHttpCoupling(changedFiles));

  if (violations.length === 0) {
    console.log("Design review: no violations detected.");
    return;
  }

  console.error("Design review: potential violations detected:");
  for (const v of violations) {
    console.error(`- Rule: ${v.rule}`);
    console.error(`  Message: ${v.message}`);
    console.error(`  Files:`);
    for (const f of v.files) {
      console.error(`    - ${f}`);
    }
  }

  // For now, fail the build if we see any violations.
  process.exit(1);
}

main();
