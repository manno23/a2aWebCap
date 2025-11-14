# Claude Code Environment Variables Reference

This document lists all environment variables you can use to configure Claude Code for consistent behavior across local and web environments.

## Quick Setup

### Local Environment (Desktop)
Add these to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.) or create a `.env` file:

```bash
# Core Configuration
export ANTHROPIC_API_KEY="your-api-key-here"
export ANTHROPIC_MODEL="claude-sonnet-4-5-20250929"

# Project-specific
export PROJECT_NAME="a2aWebCap"
export NODE_ENV="development"

# Performance
export BASH_DEFAULT_TIMEOUT_MS=120000
export MAX_THINKING_TOKENS=10000
```

### Web Environment (Claude Code on Web)
Configure in `.claude/settings.json`:

```json
{
  "env": {
    "ANTHROPIC_MODEL": "claude-sonnet-4-5-20250929",
    "PROJECT_NAME": "a2aWebCap",
    "NODE_ENV": "development",
    "BASH_DEFAULT_TIMEOUT_MS": "120000",
    "MAX_THINKING_TOKENS": "10000"
  }
}
```

## Environment Variable Categories

### 1. Authentication & API

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key | `sk-ant-...` | ✅ (Local) |
| `ANTHROPIC_AUTH_TOKEN` | Custom authorization header | `Bearer token` | No |
| `AWS_BEARER_TOKEN_BEDROCK` | AWS Bedrock authentication | `token` | No |

### 2. Model Configuration

| Variable | Description | Default | Notes |
|----------|-------------|---------|-------|
| `ANTHROPIC_MODEL` | Primary model to use | `claude-sonnet-4-5-20250929` | Override default |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | Default Sonnet model | Latest Sonnet | For Sonnet requests |
| `ANTHROPIC_DEFAULT_OPUS_MODEL` | Default Opus model | Latest Opus | For Opus requests |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL` | Default Haiku model | Latest Haiku | For Haiku requests |
| `CLAUDE_CODE_SUBAGENT_MODEL` | Model for subagents | Inherits from parent | Subagent tasks |
| `CLAUDE_CODE_USE_BEDROCK` | Use AWS Bedrock | `false` | Set to `true` to enable |
| `USE_VERTEX` | Use Google Vertex AI | `false` | Set to `true` to enable |

### 3. Command & Output Control

| Variable | Description | Default | Range |
|----------|-------------|---------|-------|
| `BASH_DEFAULT_TIMEOUT_MS` | Default timeout for bash commands | `120000` (2 min) | Up to 600000ms |
| `BASH_MAX_OUTPUT_LENGTH` | Max characters before truncation | `30000` | Any positive int |
| `CLAUDE_CODE_MAX_OUTPUT_TOKENS` | Maximum output tokens | Model default | Up to model limit |
| `MAX_THINKING_TOKENS` | Budget for extended thinking | `10000` | Increase for complex reasoning |

### 4. MCP (Model Context Protocol)

| Variable | Description | Example | Notes |
|----------|-------------|---------|-------|
| `MCP_TIMEOUT` | MCP server startup timeout | `10000` (10s) | In milliseconds |
| `MAX_MCP_OUTPUT_TOKENS` | Max tokens from MCP tools | `25000` | Default 25k, warning at 10k |
| `OPENAI_API_KEY` | For MCP servers using OpenAI | `sk-...` | Required by Sourcerer MCP |
| `SOURCERER_WORKSPACE_ROOT` | Sourcerer MCP workspace | `/path/to/project` | For semantic code search |
| `GITHUB_PERSONAL_ACCESS_TOKEN` | GitHub MCP authentication | `ghp_...` | For local GitHub MCP |

### 5. Feature Control

| Variable | Description | Default | Effect |
|----------|-------------|---------|--------|
| `DISABLE_TELEMETRY` | Opt out of usage analytics | `false` | Set to `true` to disable |
| `DISABLE_AUTOUPDATER` | Prevent automatic updates | `false` | Desktop only |
| `DISABLE_ERROR_REPORTING` | Disable error tracking | `false` | Set to `true` to disable |
| `DISABLE_PROMPT_CACHING` | Turn off caching | `false` | May increase costs |
| `CLAUDE_CODE_DISABLE_TOOLS` | Disable specific tools | `Bash,Write` | Comma-separated list |

### 6. Network & Proxy

| Variable | Description | Example | Notes |
|----------|-------------|---------|-------|
| `HTTP_PROXY` | HTTP proxy server | `http://proxy:8080` | For corporate networks |
| `HTTPS_PROXY` | HTTPS proxy server | `https://proxy:8080` | For corporate networks |
| `NO_PROXY` | Bypass proxy for these hosts | `localhost,127.0.0.1` | Comma-separated |

### 7. Session & Hook Variables

| Variable | Description | Availability | Notes |
|----------|-------------|--------------|-------|
| `CLAUDE_ENV_FILE` | File for persistent env vars | Session hooks only | Write exports here |
| `CLAUDE_PROJECT_DIR` | Current project directory | Hooks | Always use in hook scripts |
| `CLAUDE_SESSION_ID` | Current session ID | Runtime | Passed to hooks via stdin |

### 8. Project-Specific (a2aWebCap)

| Variable | Description | Recommended Value |
|----------|-------------|-------------------|
| `PROJECT_NAME` | Project identifier | `a2aWebCap` |
| `PROJECT_TYPE` | Project type | `typescript-monorepo` |
| `NODE_ENV` | Node environment | `development` or `production` |
| `PORT` | Server port | `8080` |
| `HOST` | Server host | `localhost` |
| `AGENT_URL` | A2A agent URL | `http://localhost:8080` |
| `AGENT_NAME` | A2A agent name | `A2A Test Agent` |

## Complete Setup Examples

### Example 1: Local Development (Desktop)

**~/.claude/settings.json**:
```json
{
  "env": {
    "ANTHROPIC_MODEL": "claude-sonnet-4-5-20250929",
    "MAX_THINKING_TOKENS": "15000",
    "BASH_DEFAULT_TIMEOUT_MS": "180000",
    "MCP_TIMEOUT": "15000",
    "DISABLE_TELEMETRY": "false"
  },
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

**~/.bashrc or ~/.zshrc**:
```bash
# Claude Code Configuration
export ANTHROPIC_API_KEY="sk-ant-api03-..."
export OPENAI_API_KEY="sk-..."  # For Sourcerer MCP
export GITHUB_PERSONAL_ACCESS_TOKEN="ghp_..."  # For GitHub MCP
```

### Example 2: Web Environment

**Project .claude/settings.json**:
```json
{
  "env": {
    "ANTHROPIC_MODEL": "claude-sonnet-4-5-20250929",
    "PROJECT_NAME": "a2aWebCap",
    "PROJECT_TYPE": "typescript-monorepo",
    "NODE_ENV": "development",
    "MAX_THINKING_TOKENS": "10000",
    "BASH_DEFAULT_TIMEOUT_MS": "120000"
  },
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

### Example 3: Minimal Setup (Just Works)

If you only want the basics:

```bash
# Local
export ANTHROPIC_API_KEY="your-key-here"

# Optional: Use Haiku for faster/cheaper responses
export ANTHROPIC_MODEL="claude-haiku-3-5-20250314"
```

## Best Practices

### Security
- ✅ **Never commit API keys** to version control
- ✅ Use `.claude/settings.local.json` for sensitive values (add to `.gitignore`)
- ✅ Use environment-specific secrets management in production
- ✅ Rotate API keys regularly

### Performance
- 🚀 Set `MAX_THINKING_TOKENS` higher (15000-20000) for complex reasoning tasks
- 🚀 Increase `BASH_DEFAULT_TIMEOUT_MS` for long-running builds/tests
- 🚀 Use `ANTHROPIC_MODEL=claude-haiku-3-5-20250314` for simple tasks (faster/cheaper)
- 🚀 Keep `DISABLE_PROMPT_CACHING=false` to reduce costs

### Development
- 🔧 Use project-specific `.claude/settings.json` for team-shared config
- 🔧 Use `~/.claude/settings.json` for personal preferences
- 🔧 Use `CLAUDE_PROJECT_DIR` in hooks for portability
- 🔧 Test hooks independently before committing

### MCP Servers
- 🔌 Set `MCP_TIMEOUT` to at least 10000ms (10s) for reliable startup
- 🔌 Monitor `MAX_MCP_OUTPUT_TOKENS` to avoid context overload
- 🔌 Prefer remote HTTP MCP servers over local stdio when available
- 🔌 Store MCP credentials in environment variables, not config files

## Troubleshooting

### Issue: "Session hook failed"
- Check hook script is executable: `chmod +x .claude/hooks/*.sh`
- Verify `$CLAUDE_PROJECT_DIR` is used for paths
- Test script manually: `./.claude/hooks/session-start.sh < /dev/null`

### Issue: "MCP server timeout"
- Increase `MCP_TIMEOUT` to 15000 or higher
- Check network connectivity for remote MCP servers
- Verify credentials are set correctly

### Issue: "Command timeout"
- Increase `BASH_DEFAULT_TIMEOUT_MS` to 300000 (5 min) for builds
- Split long operations into smaller steps
- Use background processes for very long operations

### Issue: "API key not found"
- Ensure `ANTHROPIC_API_KEY` is exported in your shell
- Check `.claude/settings.json` has correct key name
- Verify key hasn't expired or been revoked

## References

- [Official Claude Code Settings Documentation](https://code.claude.com/docs/en/settings.md)
- [Hooks Documentation](https://code.claude.com/docs/en/hooks.md)
- [MCP Documentation](https://code.claude.com/docs/en/mcp.md)
- [Model Context Protocol](https://modelcontextprotocol.io/)
