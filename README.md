<div align="center">

# Narrative Lifecycle

**A rule-based research system for classifying market narratives into lifecycle stages.**

[![CI](https://github.com/Waloncycler/narrative-lifecycle/actions/workflows/ci.yml/badge.svg)](https://github.com/Waloncycler/narrative-lifecycle/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js >= 20](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-orange.svg)](CONTRIBUTING.md)

[What This Is](#what-this-is) · [Quickstart](#quickstart) · [Architecture](#architecture) · [Contributing](#contributing) · [Docs](docs/README.md)

</div>

---

> **This is a research tool. It does not produce trading advice, buy/sell signals, or investment recommendations.**

## What This Is

Narrative Lifecycle is a **Narrative State Change Detector** — a deterministic, evidence-first research system that answers four questions about any market narrative:

1. What lifecycle stage is this narrative currently in?
2. Why did it change?
3. Why can't it be rated higher?
4. What should be verified next?

It classifies narratives into **S0–S7 stages** based on the "Name / Capital / Pricing / Reality / Momentum / Resistance / Data Confidence" framework, with full evidence traceability, human-review gates at every step, and zero automated trading actions.

```
Evidence first.  Rules second.  LLM explanation third.
```

## What This Is Not

- ❌ Not a buy/sell signal system
- ❌ Not an automated trading system
- ❌ Not a black-box LLM scoring tool
- ❌ Not a simple news summary dashboard

## Quickstart

```bash
git clone https://github.com/Waloncycler/narrative-lifecycle.git
cd narrative-lifecycle
npm install
cp .env.example .env   # configure your AI provider key (optional)
npm run intake:workbench
```

Open `http://localhost:4177` — drag in a document or paste text, review Evidence candidates, then run the pipeline.

Prefer the command line? Jump straight to [Run The System](#run-the-system) below, or work through the fixtures in [Golden Cases](#golden-cases-sample-data) to see a fully worked example end to end.

## Key Features

| Feature | Description |
|---|---|
| **S0–S7 Stage Gate** | Deterministic lifecycle classification with configurable minimum-evidence thresholds |
| **Evidence Intake Workbench** | Browser UI for drag-and-drop document ingestion with human review before any import |
| **AI Shadow Validation** | Optional OpenAI-compatible AI candidate layer (MiniMax by default) — shadow-only, never auto-imports |
| **Autonomous Research Loop** | Controlled multi-source intelligence gathering with anti-scraping retry, RSS/API feeds, and 56 authoritative sources |
| **Stage Diff & Weekly Brief** | Immutable per-run snapshots, stage-change diffs, and operator-facing research briefs |
| **Topic/Branch Registry** | Canonical topic + branch separation; no branch can auto-promote its parent |
| **Historical Replay** | `available_at` time-sliced replay to evaluate classification accuracy against known outcomes |
| **Governed Active Learning** | Human-correctable learning profile that feeds advisory context into later Agent requests |

## Architecture

The codebase is organized as **feature slices**: each capability owns its full stack — pure domain logic, rules, I/O, types, and UI — in one folder. A shared `platform/` layer holds cross-cutting infrastructure, and a thin `app/` composition root wires features together into use cases.

```
src/
├── features/          one folder per capability, each self-contained:
│   ├── evidence/      Evidence Table, import, validation, chain, strength rules
│   ├── stages/        S0–S7 classifier, Stage Gate rules, diff, evolution timeline
│   ├── scoring/       scoring engine, quantitative framework
│   ├── narrative/     narrative tree/graph, memory, reactivation, topic resolution
│   ├── intake/        intake agent, learning, workbench server + UI
│   ├── research/      autonomous research agent, web/direct-source research
│   ├── worldmonitor/  source catalog, feed parsing, change detection
│   └── reporting/     dashboard cards, weekly brief, operator review, pilot, replay
│                      (each: domain/ rules/ io/ types/ pipeline/ ui/)
├── platform/          shared infrastructure: file adapters, run context, versioning
├── app/               composition root: use cases, ports, pipeline orchestration
└── cli/               thin command entrypoints (one file per `npm run <script>`)
```

**The rule that matters most:** `domain/` and `rules/` inside every feature are pure — no filesystem, no YAML, no network. Only `io/` and `pipeline/` touch the outside world. This boundary is enforced by [`tests/test_architecture_boundaries.ts`](tests/test_architecture_boundaries.ts), not just convention.

### Data Flow

```
Raw source (RSS · API · Document)
  → [worldmonitor] Feed parsing + normalization
  → Evidence candidates (with source quote + provenance)
  → Human review (Intake Workbench)
  → Evidence Table
  → Narrative Memory lookup
  → Stage Gate rules
  → Scoring Engine
  → Dashboard Card · Early Radar · Weekly Brief
```

## Intelligence Sources

The system integrates **56 authoritative sources** across:

- Global macro & markets: Investing.com, Reuters, WSJ, Bloomberg (via RSS)
- Chinese financial media: 财联社, Wind Data, 新时空
- Regulatory / statutory: SEC EDGAR, Federal Register, SAMR, CAC, US BIS
- Academic indexes: PubMed, arXiv, OpenAlex, ClinicalTrials.gov, Europe PMC
- Tech / research: GitHub Trending, Hugging Face, Crossref
- Company disclosures: 30-company IR registry (A-share, HK, US)

> Raw payloads are **never stored**. Only fingerprints, bounded citations, and source attribution links are retained.

## Run The System

```bash
# Interactive workbench (recommended starting point)
npm run intake:workbench

# Core pipeline
npm run evidence:validate
npm run evidence:import -- --file data/imports/evidence_draft.example.yaml
npm run pipeline
npm run diff
npm run report

# Canonical weekly run (pipeline → diff → report in one step)
npm run weekly

# Intelligence source sync
npm run sources:inventory
npm run sources:sync -- --mode sandbox
npm run sources:sync -- --mode live --max 20

# Research campaign (full autonomous research loop)
npm run research:campaign -- --max-tasks 60 --max-queries 12
npm run research:triage
npm run research:retrieve -- --max 6
npm run research:baseline

# Autonomous agent loop
npm run agent:run -- --kind manual --operation DirectClinicalTrialsGovStudies
npm run autonomy:run -- --no-publish

# AI Shadow validation
npm run intake:ai-shadow
npm run intake:ai-evaluate

# Review, pilot, replay
npm run review
npm run pilot:init && npm run pilot:review
npm run replay

# Quality gates
npm run typecheck
npm test
```

## Outputs

After `npm run pipeline`, artifacts are written to `outputs/`:

| Path | Description |
|---|---|
| `outputs/dashboard_cards/*.json` | Per-topic lifecycle stage cards |
| `outputs/scores/*.json` | Scoring breakdown (E0–E4 per layer) |
| `outputs/early_radar_candidates.json` | Early-opportunity radar |
| `outputs/system_summary.json` | Pipeline health |
| `outputs/diffs/latest_stage_diff.md` | Human-readable stage changes |
| `outputs/reports/weekly_brief.md` | Operator research brief |
| `outputs/autonomy/latest_narrative_graph_promotion.json` | Autonomous graph promotion audit |

## AI Provider Configuration

The AI Shadow layer is **optional**. Without it, the system runs fully on deterministic rules.

```bash
# .env (copy from .env.example)
MINIMAX_API_KEY=your_key_here     # MiniMax is the default provider
MINIMAX_MODEL=MiniMax-M3          # default model
```

To use a different OpenAI-compatible provider:

```bash
NARRATIVE_AGENT_PROVIDER=custom
NARRATIVE_AGENT_ENDPOINT=https://your-endpoint/v1/chat/completions
NARRATIVE_AGENT_API_KEY=your_key
NARRATIVE_AGENT_MODEL=your-model
```

The AI layer is **shadow-only**: it proposes Evidence candidates with provenance and uncertainty notes, but every candidate must pass human review, schema validation, duplicate detection, and Topic/Branch guardrails before entering the Evidence Table. A model cannot classify Stage, score, activate topics, mutate registries, or produce trading advice.

## Contributing

We are actively looking for contributors! Here are the best ways to get involved:

### Good first issues

- 🔌 **Add a new RSS/API source adapter** in [`src/features/worldmonitor/io/worldmonitor_source_adapter.ts`](src/features/worldmonitor/io/worldmonitor_source_adapter.ts)
- 📝 **Add sample evidence YAML files** for new industry domains under `data/sample_evidence/`
- 🌐 **Improve feed parsing heuristics** in [`src/features/worldmonitor/domain/worldmonitor_feed_parsing.ts`](src/features/worldmonitor/domain/worldmonitor_feed_parsing.ts)
- 🔍 **Expand the industry pack definitions** for the Intake Agent in [`src/features/reporting/domain/industry_packs.ts`](src/features/reporting/domain/industry_packs.ts)
- 📖 **Translate documentation** into English (most docs are currently in Chinese)
- 🧪 **Write test cases** for edge cases in Stage Gate rules

### Roadmap (help wanted)

- [ ] **PostgreSQL backend** — replace file-system repos with a proper DB layer
- [ ] **Web dashboard** — read-only research dashboard for teams (currently CLI + local workbench only)
- [ ] **More authoritative source adapters** — Bloomberg Terminal API, Wind API, Refinitiv
- [ ] **Multi-language support** — English evidence intake and classification
- [ ] **Docker / self-hosted deployment** — containerized production setup
- [ ] **Export integrations** — Notion, Obsidian, Roam Research

### How to contribute

1. Read [CONTRIBUTING.md](CONTRIBUTING.md) — especially the architecture principles and safety guardrails
2. Open an issue to discuss your idea before building large features
3. Fork → branch → `npm run typecheck && npm test` → PR

## Documentation

The full set lives in [`docs/`](docs/README.md), organized by theme. Highlights:

| Doc | Description |
|---|---|
| [docs/01_theory_name_capital_reality_momentum.md](docs/01_theory_name_capital_reality_momentum.md) | The underlying theory |
| [docs/02_lifecycle_states_S0_S7.md](docs/02_lifecycle_states_S0_S7.md) | Stage definitions |
| [docs/03_minimum_evidence_standards.md](docs/03_minimum_evidence_standards.md) | Evidence rules |
| [docs/06_scoring_system_v0_2.md](docs/06_scoring_system_v0_2.md) | Scoring formula |
| [docs/15_system_architecture.md](docs/15_system_architecture.md) | Architecture deep-dive |
| [docs/EVIDENCE_GUIDE.md](docs/EVIDENCE_GUIDE.md) | How to write evidence YAML |
| [docs/27_worldmonitor_data_sources_integration_map.md](docs/27_worldmonitor_data_sources_integration_map.md) | Intelligence source map |
| [docs/26_governed_active_learning.md](docs/26_governed_active_learning.md) | Governed active learning |

## Golden Cases (Sample Data)

Three fully worked example narratives are included:

- `data/golden_cases/bci.yaml` — Brain-Computer Interface (BCI)
- `data/golden_cases/humanoid_robotics.yaml` — Humanoid Robotics
- `data/golden_cases/innovative_drug_license_out.yaml` — Innovative Drug License-Out

These are used as regression fixtures in `npm test`. They also show exactly how evidence, stages, branches, and scoring work in practice.

## License

MIT — see [LICENSE](LICENSE).

Data from external sources (Reuters, WSJ, Investing.com, etc.) is subject to each provider's terms. Raw payloads are never stored; only fingerprints and bounded citations are retained. This software must not be used to produce trading advice or investment recommendations.

---

<div align="center">
Built with ❤️ for researchers who believe evidence should come before narrative.
</div>
