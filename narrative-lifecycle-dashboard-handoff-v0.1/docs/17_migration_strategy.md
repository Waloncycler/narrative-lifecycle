# 17 Migration Strategy

## Stage 1: Local MVP

- YAML / Markdown / JSON
- Local files
- Manual evidence input
- Markdown export

## Stage 2: Lightweight Cloud

- PostgreSQL
- Simple web dashboard
- scheduled jobs
- login
- evidence management

## Stage 3: Platform

- PostgreSQL + pgvector
- object storage
- background workers
- API services
- multi-user workspace
- versioned reports

## Avoid Lock-in

Do not hard-code:

- database queries
- file paths
- model provider
- scoring rules
- frontend business logic

Use interfaces:

- LLMProvider
- EvidenceRepository
- RuleProvider
- ReportRenderer
- DataSourceConnector
