#!/usr/bin/fish

# Remove node_modules
find . -name "node_modules" -type d -prune -exec rm -rf '{}' +

# Remove dist folders
find packages -name "dist" -type d -prune -exec rm -rf '{}' +

echo "Cleanup complete."
