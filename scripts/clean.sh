#!/usr/bin/fish

# Remove node_modules
find . -name "node_modules" -type d -prune -exec rm -rf '{}' +

# Remove dist folders
find packages -name "dist" -type d -prune -exec rm -rf '{}' +

# Remove TypeScript build info files
find packages -name "tsconfig.tsbuildinfo" -type f -delete

# rm -rf packages/*/dist packages/*/node_modules node_modules

echo "Cleanup complete."
