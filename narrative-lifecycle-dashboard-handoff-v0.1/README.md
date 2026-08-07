# Narrative Lifecycle Dashboard

一个基于“名、资、定价、实、势、阻力、数据置信度”的 Narrative Lifecycle 研究系统。

Current project handoff: [`docs/HANDOFF.md`](docs/HANDOFF.md)

## What This Is

This project helps researchers classify market narratives into S0-S7 lifecycle stages, track stage transitions, discover early opportunities, identify old-theme reactivation, and avoid narrative traps.

中文定位：

> 这不是热点榜，也不是自动交易系统，而是一个 **Narrative State Change Detector：叙事状态变化识别系统**。

## What This Is Not

- Not a buy/sell signal system.
- Not an automated trading system.
- Not a black-box LLM scoring tool.
- Not a simple news summary dashboard.

## Core Modules

1. Domain: Evidence, Topic, Branch, Stage Gate, Scoring, Reactivation, and Diff rules.
2. Application: use-case orchestration for import, pipeline, diff, weekly brief, weekly run, and historical review.
3. Infrastructure: file repositories, YAML loading, schema validation, atomic writing, run history, and system clock adapters.
4. Interface: CLI commands that call Application use cases.

## Data Flow

```text
Raw source
→ Evidence extraction
→ Evidence Table
→ Narrative Memory lookup
→ Stage Gate rules
→ Scoring Engine
→ Dashboard Card / Early Radar / Weekly Brief
```

## Key Principle

```text
Evidence first. Rules second. LLM explanation third.
```

## Run The System

```bash
npm install
npm run evidence:validate
npm run evidence:import -- --file data/imports/evidence_draft.example.yaml
npm run pipeline
npm run diff
npm run report
npm run weekly
npm run review
npm run pilot:init
npm run pilot:review
npm run replay
npm run intake:workbench
npm run intake:prepare -- --file data/intake/examples/bci_branch_note.md
npm run intake:apply -- --decisions outputs/intake/latest_review_decisions.yaml
npm run intake:evaluate -- --decisions outputs/intake/latest_review_decisions.yaml
npm run intake:ai-shadow
npm run intake:ai-evaluate
npm run intake:agent -- --text "粘贴新闻或材料"
npm run topic:validate
npm run intake:learn -- --decisions outputs/intake/interactive_review_decisions.yaml
npm run intake:learning-cycle
npm run typecheck
npm test
```

The CLI layer is intentionally thin. It resolves the repo root, parses minimal arguments, calls Application use cases, and prints summaries. Business rules, artifact reads/writes, schema validation, and run-history mutation live behind Application and Infrastructure boundaries.

`npm run pipeline` executes the rule-based backend system and writes artifacts to `outputs/`:

- `outputs/dashboard_cards/*.json`
- `outputs/scores/*.json`
- `outputs/golden_case_results.json`
- `outputs/early_radar_candidates.json`
- `outputs/evaluation_summary.json`
- `outputs/system_summary.json`

The pipeline validates generated Dashboard Cards, Scores, and Early Radar candidates against JSON schemas before writing them.

`npm run report` reads the pipeline artifacts and writes an operator-facing weekly brief:

- `outputs/reports/weekly_brief.md`
- `outputs/reports/weekly_brief.json`

The report layer is a renderer / aggregator only. It does not reclassify stages, recalculate scores, infer new evidence, or upgrade parent narratives from branch evidence.

`npm run diff` compares current pipeline artifacts with the latest persisted stage snapshot and writes:

- `outputs/diffs/latest_stage_diff.json`
- `outputs/diffs/latest_stage_diff.md`
- `outputs/history/stage_snapshots/<snapshot_id>.json`

The diff layer only compares persisted stages, evidence IDs, branches, confidence bands, Early Radar references, and guardrails. It never classifies stages, recalculates scores, infers evidence, or emits trading actions. With no previous snapshot it saves a baseline; subsequent identical runs report `no_change`.

`npm run weekly` is the canonical operator workflow. It creates one unique run identity, then runs `pipeline -> diff -> report`, preserving immutable artifacts and a schema-valid manifest at `outputs/runs/<run_id>/run_manifest.json`. `outputs/runs/latest_run.json` only advances after a successful weekly run.

`npm run review` reads historical immutable run artifacts only:

- `outputs/runs/*/run_manifest.json`
- `outputs/runs/*/stage_diff.json`
- `outputs/runs/*/weekly_brief.json`

It writes:

- `outputs/reviews/latest_operator_review.json`
- `outputs/reviews/latest_operator_review.md`
- `outputs/reviews/history/operator_review_<run_id>.json`

The review layer aggregates historical operator evidence: run success/failure counts, stage trend history, evidence changes, Data Confidence changes, `why_not_higher_stage` changes, branch mutations, Early Radar changes, guardrail regressions, repeated issues, consecutive `no_change` topics, and research-only next actions. It does not reclassify narratives, recalculate scores, infer evidence, mutate history, or lift a parent narrative because a branch changed.

`npm run pilot:init` creates the manual pilot seed files for a 4-6 week live research trial:

- `data/pilot/pilot_topics.yaml`
- `data/pilot/operator_observations.yaml`

`npm run pilot:review` reads existing run, weekly brief, diff, operator review, and pilot YAML files, then writes:

- `outputs/pilot/latest_research_ledger.json`
- `outputs/pilot/latest_research_ledger.md`
- `outputs/pilot/history/research_ledger_<run_id>.json`
- `outputs/pilot/pilot_evaluation_summary.json`

The Pilot layer only records, compares, and evaluates existing artifacts plus manual operator observations. It does not reclassify stages, rescore topics, infer evidence, produce precise probabilities, or upgrade a parent narrative because a branch changed. Each pilot topic must include a current hypothesis, competing hypothesis, falsification trigger, `why_not_higher_stage`, operator agreement, and outcome status. Allowed next actions are limited to `observe`, `wait`, `validate`, `review`, `monitor`, and `flag_risk`.

`npm run replay` runs Historical Narrative Replay against time-sliced historical cases:

- `data/replay/replay_cases.yaml`
- `outputs/replay/latest_replay_ledger.json`
- `outputs/replay/latest_replay_ledger.md`
- `outputs/replay/history/replay_ledger_<run_id>.json`

Replay uses only evidence whose `available_at` is on or before the slice date. It runs stage, diff, and Early Radar checks before revealing the outcome, then reports stage paths, misclassification, lead time, missed changes, false positives, and rule calibration suggestions. It does not use future evidence, price movement, branch-to-parent lift, or trading advice.

`npm run intake:workbench` starts the local Narrative Monitor on `127.0.0.1`. It is a connected operator workflow rather than a separate dashboard artifact:

The global navigation is intentionally limited to `总览`, `变化`, `主题`, `研究队列`, and `系统`, plus the primary `录入材料` action. Existing deep links remain compatible.

- `/` is the artifact-backed Overview for latest changes, review workload, provider/fallback state, freshness, and pipeline health.
- `/changes` explains previous/current state, trigger Evidence, change reason, and `why_not_higher_stage`.
- `/topics` and `/topics/:topic_id` show canonical Parent topics and independent Branch state.
- `/queue` is the Research Queue; its secondary navigation includes `/inbox` candidate Evidence and Early Radar.
- `/system` is the system overview.
- `/runs` separates provider/Agent status from canonical pipeline run history.
- `/sources` explicitly marks automatic ingestion and OCR as not configured while exposing the usable manual source path.
- `/methodology` exposes the deterministic formulas, Stage-first computation order, calibration status, and Agent cost/safety gates.
- `/governance` shows advisory Learning Profile status, no-change themes, and immutable guardrails.
- `/intake` is opened through `录入材料` and retains the interactive Evidence Intake Workbench and formal import workflow.

The monitor does not classify, score, infer evidence, or let a branch change upgrade its parent. It distinguishes observed artifacts, pending review, stale data, fallback operation, and unconfigured capabilities. Unless `NARRATIVE_RUN_MODE=research` or `NARRATIVE_RUN_MODE=test` is supplied, runs are shown as unlabelled rather than inferred.

The `/intake` workbench supports:

- drag/drop TXT, Markdown, DOCX, HTML, or text-based PDF
- paste raw text
- inspect source text with quote highlights
- edit Evidence Cards in the browser
- select Topic resolution status: existing, alias, new branch, reactivation, provisional, or unresolved
- accept, modify, reject, or split candidates
- run Validate / Import / Weekly without editing YAML
- inspect imported evidence impact, stage, confidence, diff, and `why_not_higher_stage`

The interactive workbench is still research-only. It writes review decisions and audit artifacts under `outputs/intake/`, but formal Evidence still goes through the existing validator/import/weekly path.

`npm run intake:prepare` remains the CLI-compatible static workbench path for pasted text or local documents:

- TXT
- Markdown
- DOCX
- HTML
- text-based PDF

It writes:

- `outputs/intake/latest_raw_document.json`
- `outputs/intake/latest_chunks.json`
- `outputs/intake/latest_candidates.json`
- `outputs/intake/latest_provenance.json`
- `outputs/intake/latest_review_decisions.yaml`
- `outputs/intake/latest_workbench.html`

`npm run intake:apply -- --decisions <review_yaml>` applies human review decisions, writes `outputs/intake/reviewed_evidence_draft.yaml`, runs the existing evidence import workflow, and then runs `weekly` after a successful import. Candidate Evidence is never imported automatically; every accepted, modified, or split candidate must pass human review, duplicate detection, schema validation, Parent/Branch guardrails, and the existing import flow.

`npm run topic:validate` validates the Canonical Topic Registry, Alias Registry, Branch Registry, Provisional Topic queue, and latest intake candidates. It writes:

- `outputs/intake/latest_topic_resolution_audit.json`
- `outputs/intake/latest_topic_resolution_audit.md`
- `outputs/intake/latest_unresolved_queue.json`
- `outputs/intake/latest_topic_registry_validation.json`

Topic resolution is intentionally conservative. Each candidate is classified as `existing_topic`, `alias_of`, `new_branch`, `reactivation`, `new_provisional_topic`, or `unresolved`. The resolver does not force ambiguous candidates into active topics, does not let provisional topics inherit high stages, and does not let branch changes upgrade parent narratives.

`npm run intake:evaluate -- --decisions <review_yaml>` evaluates candidate quality after human review. It writes:

- `outputs/intake/latest_evaluation.json`
- `outputs/intake/latest_evaluation.md`

The evaluation reports acceptance, modification, rejection, and split rates; field accuracy; review time; duplicate prevention; Parent/Branch error rate; unresolved candidates; and rule-vs-AI-shadow differences. The optional AI candidate generator is shadow-only: it can propose alternatives with provenance and uncertainty notes, but cannot import evidence, create active topics, upgrade stages, or modify rules.

`npm run intake:ai-shadow` runs the provider-neutral Real AI Shadow Validation path against the latest prepared intake session. It compares rule-based candidates with AI-shadow candidates and writes:

- `outputs/intake/latest_ai_shadow_candidates.json`
- `outputs/intake/latest_candidate_comparisons.json`
- `outputs/intake/latest_ai_shadow_audit.json`
- `outputs/intake/latest_ai_shadow_validation_report.json`
- `outputs/intake/latest_ai_shadow_validation_report.md`

The AI adapter is configured through environment variables and defaults to disabled fallback mode:

```bash
NARRATIVE_AI_SHADOW_PROVIDER=custom
NARRATIVE_AI_SHADOW_ENDPOINT=https://example.com/v1/chat/completions
NARRATIVE_AI_SHADOW_API_KEY=...
NARRATIVE_AI_SHADOW_MODEL=...
NARRATIVE_AI_SHADOW_TIMEOUT_MS=30000
```

Model output must match the existing Evidence Candidate contract and include source quote, position, suggested reason, uncertainty notes, alternative mappings, `model_version`, and `prompt_version`. Every AI candidate is checked for schema shape, quote consistency, Parent/Branch scope, E0-E4 bounds, and no-trading-advice language before it is shown. If the provider is missing, times out, or returns invalid output, the system records an audit event and falls back to the rule-based candidate.

`npm run intake:ai-evaluate` runs Real AI Shadow Validation across the local pilot corpus and writes:

- `outputs/intake/latest_real_ai_shadow_evaluation.json`
- `outputs/intake/latest_real_ai_shadow_evaluation.md`

The v0.5.7 pilot corpus lives under `data/intake/pilot_documents/` and contains 50 bounded local documents covering existing topics, aliases, new branches, reactivation, provisional topics, unresolved candidates, duplicate checks, multi-evidence documents, and Chinese policy / traditional Chinese medicine planning text. The Chinese policy path is intentionally conservative: it can create a `traditional_chinese_medicine_revival` provisional topic candidate, but it does not create an active topic or inherit a high stage without human audit and Evidence Table support.

The v0.6.0 cross-industry Evidence Intake foundation adds a universal OpenAI-compatible Agent contract and explicit industry packs. It generates source-quoted candidates, separates supported facts from interpretation, suggests Topic/Branch and E0-E4 fields, and writes verification and audit artifacts under `outputs/intake/`. Industry matching is conservative: matched packs may guide extraction, ambiguous matches remain provisional, and unknown industries remain unresolved. The system prompt is kept under 1000 characters. Agent output must pass the Validator, provenance, duplicate, Topic/Branch, and automatic-publication policy path before it can become formal Evidence. A model cannot directly classify Stage, score, activate topics, mutate registries or rules, or provide trading advice.

The v0.6.1 Workbench UI follows the mandatory source-first design system in `docs/23_ui_design_system.md`: four visible research steps, explicit evidence/AI separation, semantic status text, accessible focus states, responsive desktop/mobile layout, no nested cards or gradients, and visual QA for long text, fallback, empty, loading, and error states.

Operator-facing pages use a researcher language layer: lifecycle and evidence codes are paired with concise meanings, implementation enums are translated for display, and intermediate IDs are collapsed under `技术详情`. Raw values remain unchanged in schemas, artifacts, and API payloads.

The v0.6.2 Agent learning loop keeps the Agent candidate-first and multi-fact. It preserves valid Agent-only facts as Evidence Cards, records human field corrections and rejection patterns in `outputs/intake/latest_learning_profile.json`, and passes that profile into later Agent requests as advisory context. `npm run intake:learn` never changes rules, Topic Registry, Stage, Score, or import permission automatically.

The v0.7.3 governed active-learning loop makes that feedback continuous. A completed `intake:apply` automatically updates the cumulative profile, builds an information-prioritized review queue, proposes repeated correction patterns for Shadow validation, applies minimum-sample and safety promotion gates, and records a rollback profile. Outputs live in `outputs/intake/latest_learning_cycle.json`, `latest_learning_proposals.json`, and `latest_active_learning_queue.json`. Eligibility means only “ready for human promotion review”; canonical rules and registries are never changed automatically. See `docs/26_governed_active_learning.md`.

### Source operations

```bash
npm run sources:inventory
npm run sources:sync -- --mode sandbox
npm run sources:sync -- --mode live --max 20 --max-candidates 30
npm run research:search -- --topic bci
npm run research:campaign -- --max-tasks 60 --max-queries 12
npm run research:baseline
npm run research:triage
npm run research:retrieve -- --max 6
npm run agent:run -- --kind manual --operation DirectClinicalTrialsGovStudies --force
npm run autonomy:run -- --no-publish
```

`sources:inventory` reads the sibling `worldmonitor-main` OpenAPI contracts and writes `outputs/sources/latest_source_inventory.json`. The current reference exposes 199 World Monitor operations across 35 services; this project also registers eight direct public upstreams documented by that reference implementation. A catalogued operation is not reported as connected unless its runtime access state supports it.

Each operation also carries a governed-use contract: source class, terms state, attribution, redistribution policy, sensitivity, raw-payload handling, retention, freshness window, and automated-polling permission. Live sync fails closed unless the operation is `research_ready`; public access never implies permission to redistribute raw data. Raw payloads are processed transiently and only their hashes, bounded citations, provenance, counts, and sanitized status are retained.

The eight direct public operations use source-specific normalizers. They distinguish event time from `available_at`, resolve event-level URLs, extract bounded metrics and location fields, and produce readable fact summaries. Normalization remains a source-parsing step only: it cannot assign Topic/Branch, raise Evidence strength, change Stage, or bypass review.

Source synchronization also maintains `outputs/sources/latest_fact_state.json`. Only new or updated facts enter Intake; unchanged observations are recorded without creating review work. The closed-loop contract and identifier chain are documented in `docs/29_source_change_and_research_loop.md`.

Sandbox sync validates eight deterministic fixtures and never creates Evidence. Live sync can use the public no-key adapters immediately; World Monitor-hosted operations additionally require `WORLDMONITOR_API_KEY`. Live records create bounded Intake candidates only. They begin as `unknown_topic`, E1, low confidence, and `maintain`, then pass through Topic Resolver and human review. No source response can directly classify, score, import, or upgrade a narrative.

Repeated live observations are compared with persistent Fact State. New facts remain reviewable; revised facts enter Intake only when an explicit source-specific materiality policy is met. Every revision, including suppressed revisions, retains its policy, reason, and metric deltas in the Change Ledger. This routing decision is not Evidence and cannot change Stage.

If Evidence import succeeds but Weekly fails, the Intake page exposes `重试 Weekly`. The recovery path reruns Weekly against the already imported Evidence and never repeats import. Apply and recovery states are retained under `outputs/intake/history/`.

DeepSeek is supported through the same interface. When `DEEPSEEK_API_KEY` is present, the adapter defaults to `https://api.deepseek.com/chat/completions` and `deepseek-v4-flash`; explicit `NARRATIVE_AGENT_*` values take precedence. The key is read only from the process environment and is never written to artifacts.

## v0.9 Controlled Autonomous Research Loop

`npm run agent:run` is the controlled operational loop: source change detection -> deterministic source normalization -> Agent drafting -> Topic/Branch audit -> evidence publication policy -> operational Stage/Diff/Weekly -> review and learning artifacts. Its canonical live artifacts are separate from Golden Cases under `outputs/operator_runs/`; Golden Case artifacts remain regression fixtures.

- A provenance-complete primary/official record can be published only through the explicit `rule_verified` policy path. News, conflicting material, unresolved mappings, weak evidence, risky Parent/Branch cases, and large parent-stage jumps remain held for review.
- An Agent can assist with extraction but cannot overwrite deterministic verified-source Topic, Scope, E0-E4, or evidence fields; it cannot alter rules, score, or classify a Stage.
- `npm run autonomy:run -- --no-publish` rebuilds the live operational snapshot without publishing the latest candidates. Use it after an audit correction or to record a valid no-change run.
- Manual records are operational only when their IDs occur in the explicit `data/audit/operational_evidence_admission.jsonl` ledger. Earlier exploratory rows, including older bulk imports with a legacy audit entry, remain preserved for recovery but cannot drive a live Stage until re-imported through the current controlled flow.

See [`docs/31_controlled_autonomous_research_loop.md`](docs/31_controlled_autonomous_research_loop.md) for the operating procedure and current verified run.

## v0.11 Autonomous Narrative Operations

The scheduled Agent loop now completes the controlled autonomous path: source sync -> source-quoted candidates -> Parent/Branch/asset discovery -> policy-gated Evidence Table -> independent-source graph promotion -> deterministic Stage/Diff/Weekly/Review.

- A new direction is automatically registered as `provisional/S0`. It becomes an active Topic only after two independent, eligible **parent-scope** formal Evidence sources pass the configured policy.
- A new application, mechanism, named product, molecular asset, or SKU is a separate `watch` Branch. It becomes active only after two independent, eligible **branch-scope** formal Evidence sources. It never upgrades the parent narrative.
- Insufficient, duplicate, unresolved, weak, conflicting, negative, or unsafe material is held with an explicit reason. No-change and hold are valid completed outcomes.
- Inspect `outputs/autonomy/latest_narrative_graph_promotion.json` (or the Chinese Agent page) to see supporting Evidence IDs, independent-source counts, activation decisions, and holds.
- The model cannot set a Stage, calculate a Score, change a policy, mutate rules, or produce trading advice. Those actions remain deterministic and evidence-bound.

See [`docs/33_autonomous_graph_promotion.md`](docs/33_autonomous_graph_promotion.md) for the promotion policy and audit contract.

## v0.12 Source-Backed Naming and Web Research

The registry now separates stable machine identifiers from the Chinese market names shown to researchers. A Topic or Branch can carry `market_name_zh`, English retrieval name, naming status, and source citations. New nodes without a source-backed Chinese market name remain visible as unverified and cannot be automatically activated merely because they accumulated Evidence.

`npm run research:search -- --topic <topic_id>` writes provenance-preserving external research leads to `outputs/research/`. The keyless `free` provider is the default discovery baseline and aggregates public indexes with bounded, best-effort coverage; Brave, Tavily, or an MCP HTTP Bridge can be configured via `NARRATIVE_WEB_SEARCH_*` when governed source-page retrieval is required. No search provider is implied by a configured OpenAI-compatible model. Every lead is strictly `context_only`: a search summary cannot enter the Evidence Table, set Stage/Score, import Evidence, or lift a parent from a branch. The Agent page exposes the same capability. See [`docs/34_source_backed_naming_and_web_research.md`](docs/34_source_backed_naming_and_web_research.md).

The first reviewed baseline is `data/imports/bci_market_baseline_2026_08.yaml`. It gives the parent “脑机接口” a formal S4 evidence basis (stable label + capital confirmation) while keeping medical rehabilitation evidence isolated and explaining the remaining S5/S6 gaps.

## v0.13 Authoritative Source Mesh and Research Universe

`npm run research:campaign` turns the source atlas, cross-industry research universe, and company verification registry into a bounded coverage plan. The current atlas contains 43 authoritative sources across statutory bodies, regulators, filings, intergovernmental organisations, academic indexes, and company disclosure; the universe contains 40 market-recognisable research seeds across technology, health, energy, financial, and cross-industry domains. The company registry holds 30 China, Hong Kong, U.S., and global official/IR verification targets. Each 6-hour coverage window reserves space for research seeds so existing Topics and Branches cannot permanently crowd out new-topic discovery.

The Topic Registry also contains an operator-curated monitoring baseline: 17 formal monitored Topics, of which 14 begin explicitly at `S0`. This curation only makes a market-recognisable topic eligible for recurring coverage. It does not create formal Evidence, alter a Stage/Score, activate a Branch, or override a provisional naming status. The auditable baseline record is `data/audit/core_topic_curation_20260803.json`; S0 core topics rotate through the formal-topic budget while established topics retain a small recurring reserve.

Each task records the Topic, Branch, or research seed; source targets and allowed domains; intended lifecycle layers; and whether the node is formal, provisional, a watch branch, or only a research seed. A seed has no inherited Stage and can only enter the resolver as a `provisional_*` S0 candidate. The term-addressable public APIs, including ClinicalTrials.gov, PubMed, Europe PMC, Crossref, OpenAlex, arXiv, GitHub, Hugging Face, SEC EDGAR, and the Federal Register, also write original-source leads to `outputs/research/latest_direct_source_research.{json,md}` and E1/low review candidates with exact title offsets and URLs. Direct APIs have an independent bounded budget from web search; general records must repeat the campaign concept in the visible title and future-dated results are rejected. A compact SEC filing title additionally requires both a mapped U.S. company and a concept-bearing filing description; a server-side index hit alone is rejected. They remain `context_only` and cannot enter the Evidence Table until original-source verification, Topic Resolver, Narrative Memory, duplicate checks, human review, Stage Gate, and scoring have all run. See [`docs/35_authoritative_source_mesh_and_research_universe.md`](docs/35_authoritative_source_mesh_and_research_universe.md).

Every campaign now also writes `outputs/research/latest_lead_triage.{json,md}`. This deterministic, schema-validated queue combines web and direct-source leads, preserves Topic/Branch/seed scope, folds only same-scope URL duplicates, classifies source quality and freshness, and labels items as priority review, normal review, background reference, or hold. It never creates Evidence, activates a Topic/Branch, changes Stage/Score, or gives trading advice. `npm run research:triage` rebuilds the same read-only report from the latest research artifacts.

`npm run research:retrieve -- --max 6` may then fetch a bounded set of official, company-primary, or academic leads already marked for review. It writes `outputs/research/latest_source_retrieval.{json,md}` with the original URL, page identity, content hash, and at most three readable excerpts per source. ClinicalTrials study links are read through the public structured study-record endpoint; arXiv pages use the published abstract; generic HTML excludes navigation and footer chrome. These are still `context_only` materials displayed as “可复核的原文摘录” in the Agent page. They cannot import Evidence, repair a Stage, activate a Topic/Branch, or turn branch material into parent evidence.

`npm run research:baseline` writes `outputs/research/latest_baseline_completion.{json,md}`. It turns an active parent with `S0` and zero parent-scope formal Evidence into a high-priority evidence-baseline research task, and separately lists unverified Topic/Branch market names. Every `research:campaign` invokes this plan automatically, raises only the research priority for missing parent evidence, then runs triage and bounded source-page retrieval. It never changes a Stage, generates a name, imports Evidence, or mutates the registry.

An active Topic at `S0` with zero parent-scope formal Evidence is displayed as “待完成阶段基准核验”, rather than being described as an early market conclusion. This is an evidence-baseline gap, not a claim that a well-known external theme is immature. A mature Stage must still be supported by formal, parent-scope Evidence through the normal Intake and Gate path.

## Self-Iterating Knowledge Loop

The Agent is now able to maintain research context through governed proposals. Each run can read the Topic Registry, Narrative Memory IDs, the Evidence Table, the latest canonical Diff, and the advisory Learning Profile. It can then produce:

- `outputs/intake/latest_topic_discovery_proposals.json` for new Topic, Branch, alias, reactivation, or unresolved proposals.
- `outputs/intake/latest_evidence_chain.json` for candidate Evidence Chain relations such as supports, contradicts, updates, duplicates, branch-only, and fills-gap.
- `outputs/intake/latest_narrative_discovery.json` for source-grounded Parent/Branch graph discovery, duplicate checks, support counts, and watch/provisional registration actions.

The Discovery layer matches registry IDs, aliases, Narrative Memory, model suggestions, and source language to find a Parent first, then a concrete application/mechanism/indication/user/geography/value-chain/product/scenario Branch. Broad labels remain unresolved. New Topics are provisional at S0 and new Branches are watch-only; branch candidates are explicitly rewritten as branch scope and cannot promote a Parent. Under the v0.11 policy, verified formal Evidence can accumulate automatically and promote a qualifying provisional Topic or watch Branch after the independent-source threshold. Learning feedback is reused only as advisory context. See [`docs/30_self_iterating_agent_loop.md`](docs/30_self_iterating_agent_loop.md), [`docs/32_autonomous_narrative_discovery.md`](docs/32_autonomous_narrative_discovery.md), and [`docs/33_autonomous_graph_promotion.md`](docs/33_autonomous_graph_promotion.md).

`npm run evidence:validate` checks a manual evidence draft before it can enter the pipeline. By default it reads:

- `data/imports/evidence_draft.example.yaml`

It writes:

- `outputs/imports/evidence_validation_report.json`
- `outputs/imports/evidence_validation_report.md`

`npm run evidence:import -- --file <path>` validates, normalizes, and imports accepted evidence. It writes:

- `outputs/imports/evidence_import_report.json`
- `outputs/imports/evidence_import_report.md`
- `data/imports/accepted/<import_id>.yaml`
- `data/sample_evidence/manual_imported_evidence.yaml`
- `data/audit/evidence_import_audit.jsonl`

The evidence import layer only validates, normalizes, rejects, accepts, and audits. Stage classification and scoring still only happen in `npm run pipeline`.

## MVP Scope

The MVP is a semi-automatic research system using YAML/Markdown/JSON schemas and explicit rule tests. It does not need full data automation or a web UI in Phase 1.

## Golden Cases

See `data/golden_cases/`:

- `bci.yaml`
- `humanoid_robotics.yaml`
- `innovative_drug_license_out.yaml`

## Current Executable Scope

1. Load YAML topics, evidence, golden cases, failure cases, and evaluations.
2. Run Stage Gate classification before scoring.
3. Generate Score outputs with stage snapshots and evidence IDs.
4. Generate Dashboard Cards with structured branches, structured key events, `why_not_higher_stage`, and research-only actions.
5. Generate Early Radar candidates only after Narrative Memory / Reactivation references.
6. Generate failure-case calibration summaries.
7. Generate an operator weekly brief from existing pipeline artifacts.
8. Validate and import manual evidence drafts before they enter the pipeline.
9. Compare current and previous report runs with schema-valid stage-diff history.
10. Preserve immutable per-run snapshot, diff, report, and run-manifest artifacts.
11. Generate historical operator reviews from immutable run artifacts.
12. Enforce v0.4 layered architecture boundaries and versioned public artifact metadata.
13. Generate a live research pilot ledger for 10-15 real topics without reclassification, rescoring, probability modeling, UI, database, or automated ingestion.
14. Run historical narrative replay with `available_at` time slicing and outcome reveal after each replay path.
15. Provide non-developer operator guides for evidence intake, weekly review, pilot recording, replay, and troubleshooting.
16. Generate candidate evidence from documents through a human-reviewed Evidence Intake Workbench.
17. Calibrate intake quality and resolve Topic/Branch ambiguity through registries, audit history, unresolved queues, and shadow-only AI comparisons.
18. Run an interactive local intake pilot without YAML editing while preserving validator, import, weekly, audit, and research-only boundaries.
19. Run provider-neutral Real AI Shadow Validation with rule-baseline comparison, blind-review-ready differences, guarded fallback, and 50-document corpus evaluation.
20. Monitor core narratives through a read-only strategic dashboard, drill into parent/branch evidence, triage research queues, and return to the controlled Intake workflow.

## v0.4 Product Core

Repository contracts are defined for Evidence, Topic, Artifact, Run, History, Failure Case, Review, and Golden Case access. File-system implementations back the current CLI, and InMemory implementations support fast use-case tests. PostgreSQL remains out of scope.

Stable public artifacts now include:

```json
{
  "artifact_type": "string",
  "schema_version": "1.0.0",
  "producer_version": "0.4.0",
  "rule_version": "string",
  "run_id": "string",
  "generated_at": "ISO_TIMESTAMP"
}
```

See `docs/21_schema_compatibility_and_migration.md` for compatibility and migration policy.

## v0.4.1 Service Cleanup

Legacy service inventory and migration status are tracked in:

- `docs/22_legacy_service_migration.md`
- `docs/legacy_service_inventory.json`

Migrated implementation code now lives in the layered core:

- Domain rules: evidence import validation, Evidence Table guards, Stage Classification, Scoring, Stage Diff, Dashboard Card guardrails, Memory/Reactivation, Early Radar, Failure Case rules, Evaluation calibration, and Versioning.
- Application logic: evidence import normalization and use-case orchestration.
- Infrastructure: evidence import YAML/schema/file/audit I/O and run context.

`src/services/*` remains as compatibility wrappers plus explicitly inventoried legacy-active files. New code should import from `src/domain`, `src/application`, or `src/infrastructure` directly.

See `docs/20_system_summary.md` for the system checklist and current architecture.

## Operator Guides

- `docs/QUICKSTART.md`
- `docs/OPERATOR_GUIDE.md`
- `docs/EVIDENCE_GUIDE.md`
- `docs/REPLAY_GUIDE.md`
- `docs/TROUBLESHOOTING.md`
