# Quickstart

> **This is a research tool. It does not produce trading advice or buy/sell signals.**

## Requirements

- Node.js >= 20
- npm >= 9

## Install

```bash
git clone https://github.com/Waloncycler/narrative-lifecycle.git
cd narrative-lifecycle
npm install
```

Copy the environment template:

```bash
cp .env.example .env
# Edit .env if you want AI shadow validation or custom feed settings
```

## Run the interactive workbench (recommended)

```bash
npm run intake:workbench
```

Open `http://localhost:4177` in your browser.

You can drag-and-drop TXT, Markdown, DOCX, HTML, or text-based PDF files, or paste raw text. The workbench extracts Evidence candidates for your review before anything is imported.

## Run the full research pipeline

```bash
# 1. Validate existing evidence
npm run evidence:validate

# 2. Import a sample evidence draft
npm run evidence:import -- --file data/imports/evidence_draft.example.yaml

# 3. Run the lifecycle classification pipeline
npm run pipeline

# 4. Run the change diff (compare to last snapshot)
npm run diff

# 5. Generate the weekly research brief
npm run report
```

Or run all three in one canonical weekly run:

```bash
npm run weekly
```

## Explore outputs

After `npm run pipeline`, look in `outputs/`:

| File | Description |
|------|-------------|
| `outputs/dashboard_cards/*.json` | Per-topic lifecycle stage cards |
| `outputs/scores/*.json` | Scoring breakdown |
| `outputs/early_radar_candidates.json` | Early-opportunity radar results |
| `outputs/system_summary.json` | Run health summary |
| `outputs/diffs/latest_stage_diff.md` | Human-readable stage changes |
| `outputs/reports/weekly_brief.md` | Weekly operator brief |

## Sync intelligence sources

```bash
# Show all configured sources
npm run sources:inventory

# Fetch latest feeds (sandbox mode — no imports)
npm run sources:sync -- --mode sandbox
```

## Type check & test

```bash
npm run typecheck
npm test
```

## Where to go next

- [`docs/00_project_overview.md`](docs/00_project_overview.md) — full system overview
- [`docs/02_lifecycle_states_S0_S7.md`](docs/02_lifecycle_states_S0_S7.md) — stage definitions
- [`docs/03_minimum_evidence_standards.md`](docs/03_minimum_evidence_standards.md) — evidence rules
- [`docs/EVIDENCE_GUIDE.md`](docs/EVIDENCE_GUIDE.md) — how to write evidence
- [`docs/15_system_architecture.md`](docs/15_system_architecture.md) — architecture deep-dive
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — contribution guide
