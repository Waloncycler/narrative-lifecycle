# 15 System Architecture

## Architecture Principles

1. Data and model decoupled.
2. Rules and code decoupled.
3. Evidence and conclusions decoupled.
4. Parent and branch decoupled.
5. LLM and core judgment decoupled.
6. Storage and application decoupled.

## Runtime Contract

```text
Data Source Layer
→ Raw Data Layer
→ Research Lead / Bounded Source Package
→ Evidence Candidate + Topic/Branch Resolution
→ Review Queue or Explicit Controlled Publication
→ Evidence Table
→ Stage Gate
→ Score, Diff, Weekly Brief and Operator Review
```

Search results, snippets and bounded source packages are context-only. They cannot change Stage or Score. The default path is review-only; automatic publication requires both an explicit policy and an explicit execution request.

## Implemented Feature-Sliced Architecture

The repository is a modular monolith organized by feature:

```text
src/
├── features/
│   ├── evidence/       # Evidence Table, import, provenance and duplicate rules
│   ├── stages/         # S0-S7 gates, confidence caps, snapshots and diffs
│   ├── scoring/        # Evidence-bound quantitative scoring
│   ├── narrative/      # Registry, memory, reactivation and graph promotion
│   ├── intake/         # Document parsing, candidates, review and learning
│   ├── research/       # Campaigns, lead triage, retrieval and agent loop
│   ├── worldmonitor/   # Source catalog, sync and fact normalization
│   └── reporting/      # Weekly, review, replay, pilot and view models
├── app/                # Use-case orchestration and application ports
├── platform/           # Filesystem, artifacts, runs, schema and clock adapters
└── cli/                # Thin command entry points
```

Dependency direction is `Interface → Application → Feature Domain → I/O adapters`. Feature domain code must not access files, environment variables, YAML, CLI arguments or output paths directly.

## Evidence Publication Modes

| Mode | Trigger | May write Evidence Table | May activate Topic/Branch |
| --- | --- | --- | --- |
| `review_required` | Default UI, CLI, scheduler and Agent loop | No | No |
| `policy_auto` | `--publish-auto` plus enabled versioned policy | Only after deterministic gates pass | Only after independent-source graph gates pass |

Both modes preserve original URLs, citation offsets, Schema validation, Parent/Branch separation, Stage First / Score Second and the no-trading-advice boundary.

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
