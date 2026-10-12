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
- No unattended Evidence import in the default workflow. Any controlled automatic publication must require an explicit versioned policy, an explicit execution request, complete provenance, and regression tests.
- No Stage or Score mutation without Evidence Table support.
- No branch-to-parent automatic promotion.

These are not style preferences. They are system safety guardrails.

## How to Contribute

### Good first issues

- Adding new RSS/API data source adapters in `src/features/worldmonitor/io/`
- Improving evidence extraction heuristics in `src/features/worldmonitor/domain/`
- Expanding the industry pack definitions for the Intake Agent
- Adding sample evidence YAML files for new domains under `data/sample_evidence/`
- Translating UI strings or documentation

### Feature contributions

Before building a large feature, open an issue first describing:

1. What problem it solves
2. Which layer (Domain / Application / Infrastructure / Interface) it touches
3. Whether it adds any new AI-generated output, and if so how it is gated

### What we do NOT accept

- Features that make automatic Evidence publication implicit, default-on, or unverifiable
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

This project uses Feature-Sliced modules while preserving a strict dependency direction:

```
Interface (`src/cli`, feature UI)
    ↓
Application (`src/app/use_cases`)
    ↓
Feature domain (`src/features/*/domain`)
    ↓
Feature/platform I/O (`src/features/*/io`, `src/platform/io`)
```

Rules:
- **Domain** has zero dependencies on Infrastructure or Interface.
- **Application** orchestrates use cases but never accesses files directly.
- **Feature/platform I/O** implements adapters, repositories, YAML, JSON Schema and HTTP.
- **Interface** is thin — it parses args, calls Application use cases, and prints.

File size limits: > 300 lines → consider splitting. > 500 lines → must split.

### Evidence publication changes

The default command and UI paths are review-only. A pull request touching `RunAutonomousResearchUseCase`, publication policy, or a source-to-Evidence conversion must test all of the following:

- default execution leaves the formal Evidence Table unchanged;
- `--publish-auto` still requires `auto_publish_evidence=true` in the policy;
- schema, provenance, duplicate and Parent/Branch guards remain active;
- a branch cannot promote its parent or set its Stage;
- a held candidate appears in the operator review queue.

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
