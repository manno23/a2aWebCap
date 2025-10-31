#!/bin/bash
set -e

bun run clean
bun install

echo "Building all packages..."
bun packages/shared/build.ts
bun packages/client/build.ts
bun packages/server/build.ts
echo "All packages built successfully."
