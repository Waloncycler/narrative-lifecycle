# Contributing to Narrative Lifecycle

Thank you for your interest in contributing! This is a research tool for analysts and developers who study market narrative lifecycles.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Architecture Principles](#architecture-principles)
- [Submitting Changes](#submitting-changes)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

We follow the [Contributor Covenant](https://www.contributor-covenant.org/) Code of Conduct. Be respectful, constructive, and collaborative.

**Hard limits that apply in all contributions:**

- No trading advice, buy/sell signals, or investment recommendations — in code, prompts, or documentation.
- No automated import of Evidence without human review gates.
- No Stage or Score mutation without Evidence Table support.
- No branch-to-parent automatic promotion.

These are not style preferences. They are system safety guardrails.

## How to Contribute

### Good first issues

- Adding new RSS/API data source adapters in `src/infrastructure/worldmonitor_source_adapter.ts`
- Improving evidence extraction heuristics in `src/domain/worldmonitor_feed_parsing.ts`
- Expanding the industry pack definitions for the Intake Agent
- Adding sample evidence YAML files for new domains under `data/sample_evidence/`
- Translating UI strings or documentation

### Feature contributions

Before building a large feature, open an issue first describing:

1. What problem it solves
2. Which layer (Domain / Application / Infrastructure / Interface) it touches
3. Whether it adds any new AI-generated output, and if so how it is gated

### What we do NOT accept

- Features that allow automatic Evidence import without human review
- Features that produce trading advice or price targets
- Changes that bypass the Stage Gate rules or Evidence scoring system
- Storing raw external payload data (hashed fingerprints only)

## Development Setup

```bash
git clone https://github.com/Waloncycler/narrative-lifecycle.git
cd narrative-lifecycle
npm install
npm run typecheck
npm test
```

Run the full local workbench:

```bash
npm run intake:workbench
```

Open `http://localhost:4177` in your browser.

Run a sample pipeline:

```bash
npm run pipeline
npm run diff
npm run report
```

## Architecture Principles

This project follows a strict layered architecture:

```
Interface (CLI / Web UI)
    ↓
Application (Use Cases)
    ↓
Domain (Rules, Stage Gate, Scoring, Evidence)
    ↓
Infrastructure (File repos, adapters, YAML, schema)
```

Rules:
- **Domain** has zero dependencies on Infrastructure or Interface.
- **Application** orchestrates use cases but never accesses files directly.
- **Infrastructure** implements adapters and repositories.
- **Interface** is thin — it parses args, calls Application use cases, and prints.

File size limits: > 300 lines → consider splitting. > 500 lines → must split.

## Submitting Changes

1. Fork the repository and create a feature branch: `git checkout -b feature/my-feature`
2. Run `npm run typecheck` and `npm test` — both must pass.
3. Write a clear commit message explaining the *why*, not just the *what*.
4. Open a pull request with a description that includes:
   - Which layer(s) are changed
   - Test commands you ran
   - Any new config or env vars needed

## Reporting Issues

When filing a bug report, include:

- Node.js version (`node --version`)
- npm version (`npm --version`)
- Steps to reproduce
- Expected vs. actual output
- Relevant log lines or output files from `outputs/`

For security issues, please email the maintainers privately rather than opening a public issue.
