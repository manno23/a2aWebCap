# Claude Code Configuration

This directory contains configuration for [Claude Code](https://claude.ai/code), Anthropic's AI coding assistant.

## Directory Structure

```
.claude/
├── README.md                    # This file
├── settings.json               # Project-wide Claude Code settings
├── settings.local.json         # Local settings (gitignored)
├── mcp.json                    # MCP server configuration
├── ENV_VARIABLES.md            # Comprehensive env var reference
└── hooks/
    └── session-start.sh        # Session initialization hook
```

## Files Explained

### `settings.json` (Committed)
Project-wide settings that apply to all team members. Contains:
- SessionStart hooks configuration
- Shared environment variables (non-sensitive)
- Tool preferences

**Example:**
```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/session-start.sh"
          }
        ]
      }
    ]
  }
}
```

### `settings.local.json` (Gitignored)
Personal settings that override `settings.json`. Use this for:
- API keys and tokens
- Personal preferences
- Local-only configuration

**Example:**
```json
{
  "env": {
    "ANTHROPIC_API_KEY": "sk-ant-api03-...",
    "OPENAI_API_KEY": "sk-...",
    "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_..."
  }
}
```

⚠️ **Never commit this file** - it's already in `.gitignore`.

### `mcp.json` (Committed with care)
Model Context Protocol server configuration. Defines which MCP servers are available:

```json
{
  "mcpServers": {
    "sourcerer": {
      "command": "/root/go/bin/sourcerer",
      "args": [],
      "env": {
        "OPENAI_API_KEY": "YOUR_API_KEY_HERE",
        "SOURCERER_WORKSPACE_ROOT": "/home/user/a2aWebCap"
      }
    },
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/"
    }
  }
}
```

**Configured MCP Servers:**
- **Sourcerer** - Semantic code search using vector embeddings
- **GitHub** - Repository management, issues, PRs, workflows

To use MCP servers:
1. Add your API keys to `settings.local.json` or environment
2. Use `/mcp` command in Claude Code to authenticate
3. MCP tools will be available automatically

### `ENV_VARIABLES.md` (Documentation)
Comprehensive reference for all Claude Code environment variables. Includes:
- Complete variable listing with descriptions
- Setup examples for local and web environments
- Best practices and troubleshooting
- Project-specific configuration

📖 **Read this file** for detailed environment setup instructions.

### `hooks/session-start.sh` (Executable)
Automatically runs when Claude Code starts a session. This hook:
- ✅ Checks Node.js version (requires >= 20.0.0)
- ✅ Installs dependencies if missing
- ✅ Builds packages if needed
- ✅ Runs linter for code quality check
- ✅ Displays project context and available commands
- ✅ Shows git status and branch information

**When it runs:**
- On Claude Code startup
- When resuming a session (`--resume`, `/resume`)
- After context compaction

**Testing the hook:**
```bash
# Make it executable
chmod +x .claude/hooks/session-start.sh

# Test manually
./.claude/hooks/session-start.sh < /dev/null
```

## Quick Start

### First Time Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure API keys** (create `.claude/settings.local.json`):
   ```json
   {
     "env": {
       "ANTHROPIC_API_KEY": "your-anthropic-key",
       "OPENAI_API_KEY": "your-openai-key"
     }
   }
   ```

3. **Make hooks executable:**
   ```bash
   chmod +x .claude/hooks/*.sh
   ```

4. **Test the setup:**
   ```bash
   ./.claude/hooks/session-start.sh < /dev/null
   ```

### For Web Environment

If using Claude Code on the web:
1. The hooks and settings in this directory will work automatically
2. You may need to configure API keys via web UI or environment variables
3. Remote MCP servers (like GitHub HTTP) are preferred over local stdio servers

## Usage

### Running Commands

The session-start hook displays available commands. Key ones:

```bash
npm run build          # Build all packages
npm test              # Run tests with coverage
npm run lint          # Lint the codebase
npm run dev:server    # Start the A2A server
npm run clean         # Clean build artifacts
```

### Working with MCP Servers

```bash
# List available MCP servers
/mcp

# Authenticate with GitHub MCP (if using remote HTTP)
/mcp

# MCP tools are automatically available in Claude Code
# Sourcerer provides semantic code search
# GitHub provides repo/issue/PR management
```

### Customizing Hooks

To add more session startup logic:

1. Edit `.claude/hooks/session-start.sh`
2. Add your commands (keep it fast!)
3. Test: `./.claude/hooks/session-start.sh < /dev/null`
4. Commit if it's useful for the whole team

## Environment Variables

See [`ENV_VARIABLES.md`](./ENV_VARIABLES.md) for the complete reference.

**Quick reference:**

| Variable | Purpose | Where to Set |
|----------|---------|--------------|
| `ANTHROPIC_API_KEY` | Claude API access | `settings.local.json` or shell |
| `OPENAI_API_KEY` | Sourcerer MCP | `settings.local.json` or shell |
| `ANTHROPIC_MODEL` | Model selection | `settings.json` or shell |
| `MAX_THINKING_TOKENS` | Extended reasoning | `settings.json` |
| `BASH_DEFAULT_TIMEOUT_MS` | Command timeout | `settings.json` |

## Troubleshooting

### Hook not running?
```bash
# Check if it's executable
ls -l .claude/hooks/session-start.sh

# Make it executable
chmod +x .claude/hooks/session-start.sh

# Test manually
./.claude/hooks/session-start.sh < /dev/null
```

### MCP servers not working?
```bash
# Check configuration
cat .claude/mcp.json

# Add API keys to settings.local.json
# Restart Claude Code
```

### Dependencies not installing?
```bash
# Manually install
npm install

# Check Node.js version (need >= 20)
node --version
```

## Team Guidelines

### What to Commit
✅ `settings.json` - Shared project settings
✅ `mcp.json` - MCP server definitions (mask sensitive values)
✅ `hooks/*.sh` - Shared session hooks
✅ `ENV_VARIABLES.md` - Documentation
✅ `README.md` - This file

### What NOT to Commit
❌ `settings.local.json` - Personal settings with secrets
❌ Any files with API keys or tokens

### Adding New Hooks

1. Create script in `.claude/hooks/`
2. Make it executable: `chmod +x .claude/hooks/your-hook.sh`
3. Register in `settings.json`
4. Test thoroughly
5. Document in this README
6. Commit and share with team

## Resources

- [Claude Code Documentation](https://code.claude.com/docs/)
- [Hooks Documentation](https://code.claude.com/docs/en/hooks.md)
- [MCP Documentation](https://code.claude.com/docs/en/mcp.md)
- [Settings Reference](https://code.claude.com/docs/en/settings.md)
- [Model Context Protocol](https://modelcontextprotocol.io/)

## Project Context

This is the **a2aWebCap** project - an A2A Protocol v0.4.0 implementation using Cap'n Proto Web transport.

**Current Status:**
- ✅ Phase 0-3 Complete: MVP with streaming & tool execution
- ⏳ Phase 4: Production readiness (authentication, persistence, monitoring)

**Architecture:**
- TypeScript monorepo with 3 packages
- packages/shared - Protocol types & utilities
- packages/server - A2A server implementation
- packages/client - A2A client implementation

For project details, see the main [README.md](../README.md).
