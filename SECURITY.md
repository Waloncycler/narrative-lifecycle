# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.13.x  | ✅ Current |
| < 0.13  | ❌ Unsupported |

## Reporting a Vulnerability

**Please do not file public GitHub issues for security vulnerabilities.**

If you discover a security vulnerability, please:

1. Email the maintainers privately (use the email listed in the GitHub repository contact info).
2. Include a clear description of the vulnerability, steps to reproduce, and potential impact.
3. Allow up to 72 hours for an initial response.

## Security Scope

### In scope

- Authentication bypass in the local web server (`intake:workbench`)
- Path traversal vulnerabilities in file read/write operations
- Injection vulnerabilities in evidence YAML parsing
- Issues with the anti-scraping bypass logic leaking private data

### Out of scope

- Issues with upstream data sources (RSS feeds, APIs) — report those to the respective providers
- Rate limiting by external APIs (expected behavior)
- Data quality issues in AI-generated content (this is a research tool, not a production trading system)

## Data Handling

This system processes external news feeds and research documents. Key design decisions that limit data exposure:

- **No raw payload storage**: External feed content is processed in-memory. Only fingerprints (hashes), summary statistics, and source attribution links are persisted.
- **Local-only by default**: The workbench server binds to `127.0.0.1` only. Do not expose it to the public internet without adding authentication.
- **API keys in environment variables**: Never hardcode API keys. Use `.env` (already in `.gitignore`) or a secrets manager.

## Environment Variables

The following environment variables may contain sensitive credentials. Never commit these to version control:

```
NARRATIVE_AI_SHADOW_API_KEY
WORLDMONITOR_PROXY_URL
WORLDMONITOR_USER_AGENT_OVERRIDE
```

Ensure your `.env` file is listed in `.gitignore` (it already is by default).
