#!/bin/bash
set -e

# Session Start Hook for a2aWebCap
# This hook runs when Claude Code starts, resumes, or after compaction
# It prepares the development environment and provides context

echo "🚀 Starting a2aWebCap development session..."

# Read session metadata from stdin
SESSION_INFO=$(cat)
SESSION_ID=$(echo "$SESSION_INFO" | grep -o '"id":"[^"]*"' | cut -d'"' -f4 || echo "unknown")

echo "📋 Session ID: $SESSION_ID"

# Set persistent environment variables via CLAUDE_ENV_FILE
if [ -n "$CLAUDE_ENV_FILE" ]; then
    echo "export PROJECT_NAME=a2aWebCap" >> "$CLAUDE_ENV_FILE"
    echo "export PROJECT_TYPE=typescript-monorepo" >> "$CLAUDE_ENV_FILE"
    echo "export NODE_ENV=development" >> "$CLAUDE_ENV_FILE"
fi

# Check Node.js version
NODE_VERSION=$(node --version 2>/dev/null || echo "not found")
echo "📦 Node.js version: $NODE_VERSION"

if [[ "$NODE_VERSION" == "not found" ]]; then
    echo "⚠️  Node.js not found. Please install Node.js >= 20.0.0"
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📥 Dependencies not found. Installing..."
    npm install --silent || {
        echo "⚠️  Failed to install dependencies. Run 'npm install' manually."
        exit 1
    }
    echo "✅ Dependencies installed"
else
    echo "✅ Dependencies already installed"
fi

# Check if packages are built
if [ ! -d "packages/shared/dist" ] || [ ! -d "packages/server/dist" ] || [ ! -d "packages/client/dist" ]; then
    echo "🔨 Building packages..."
    npm run build-packages --silent || {
        echo "⚠️  Build failed. Run 'npm run build' manually."
        exit 1
    }
    echo "✅ Packages built successfully"
else
    echo "✅ Packages already built"
fi

# Run quick health check (linting)
echo "🔍 Running linter..."
npm run lint --silent 2>&1 | grep -E "(error|warning)" || echo "✅ Linting passed"

# Display project context
echo ""
echo "📊 Project Context:"
echo "   • Monorepo with 3 packages: shared, server, client"
echo "   • A2A Protocol v0.4.0 implementation over Cap'n Proto Web"
echo "   • Phase 3 complete: MVP with streaming & tool execution"
echo "   • Phase 4 in progress: Production readiness"
echo ""
echo "🎯 Available Commands:"
echo "   • npm run build         - Build all packages"
echo "   • npm test             - Run tests with coverage"
echo "   • npm run lint         - Lint the codebase"
echo "   • npm run dev:server   - Start the server"
echo "   • npm run clean        - Clean build artifacts"
echo ""
echo "📁 Key Directories:"
echo "   • packages/shared/     - Protocol types & utilities"
echo "   • packages/server/     - A2A server implementation"
echo "   • packages/client/     - A2A client implementation"
echo ""

# Check for recent git changes
if [ -d ".git" ]; then
    UNCOMMITTED=$(git status --porcelain 2>/dev/null | wc -l)
    if [ "$UNCOMMITTED" -gt 0 ]; then
        echo "⚠️  You have $UNCOMMITTED uncommitted changes"
    fi

    CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
    echo "🌿 Current branch: $CURRENT_BRANCH"
fi

echo ""
echo "✨ Environment ready! Happy coding!"
