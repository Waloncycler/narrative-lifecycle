# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.13.x  | ✅ Current |
| < 0.13  | ❌ Unsupported |

## Reporting a Vulnerability

**Please do not file public GitHub issues for security vulnerabilities.**

Email the maintainers privately using the contact info in the GitHub repository. Include:

1. A clear description of the vulnerability
2. Steps to reproduce
3. Potential impact

Allow up to 72 hours for an initial response.

## Security Scope

**In scope:**
- Path traversal in file read/write operations
- Injection via evidence YAML parsing
- Authentication bypass in the local workbench server (`intake:workbench`)

**Out of scope:**
- Issues with upstream data sources (RSS/APIs) — report to respective providers
- Rate limiting by external APIs (expected behavior)
- Data quality of AI-generated candidates (research tool, not a trading system)

## Data Handling

- **No raw payload storage** — external feed content is processed in-memory only; fingerprints, counts, and source attribution links are retained
- **Local-only by default** — the workbench server binds to `127.0.0.1`; do not expose publicly without authentication
- **API keys in environment variables** — never hardcode credentials; use `.env` (already in `.gitignore`)

## Sensitive Environment Variables

Never commit these to version control:

```
MINIMAX_API_KEY
NARRATIVE_AGENT_API_KEY
WORLDMONITOR_PROXY_URL
```
