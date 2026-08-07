# 15 System Architecture

## Architecture Principles

1. Data and model decoupled.
2. Rules and code decoupled.
3. Evidence and conclusions decoupled.
4. Parent and branch decoupled.
5. LLM and core judgment decoupled.
6. Storage and application decoupled.

## Layered Architecture

```text
Data Source Layer
→ Raw Data Layer
→ Evidence Layer
→ Domain Rules Layer
→ Scoring Layer
→ Reasoning Layer
→ Product Layer
```

## Recommended First Architecture

Use a **modular monolith** first:

```text
src/
├── domain/
├── rules/
├── services/
├── repositories/
├── llm/
├── api/
└── ui/
```

## Future Services

- Evidence Service
- Scoring Service
- Memory Service
- Report Service
- Ingestion Service

## Storage Strategy

MVP:

- YAML / Markdown / JSON
- optional SQLite

Later:

- PostgreSQL
- JSONB
- pgvector
- object storage for raw sources
