# PLANS.md

## v0.13.3 Research Lead Triage

- [x] Preserve Topic, Branch, and provisional-seed scope through wide-net web discovery.
- [x] Combine web and direct-source reports into a schema-validated, rule-based review queue.
- [x] Classify source class, visible relevance, freshness, same-scope duplicates, and review priority without making lifecycle judgments.
- [x] Run triage automatically after a coverage campaign and expose the read-only queue on the Agent page.
- [x] Reserve bounded web and direct-source query slots for a formal Topic, independent Branch, and research seed; retain cross-domain rotation for remaining capacity.
- [x] Lock the queue behind `context_only`, Evidence Table, Parent/Branch, and research-only guardrails with regression tests.
- [ ] Calibrate source-class and relevance rules against a reviewed corpus before changing any priority thresholds.

## v0.13 Authoritative Source Mesh and Research Universe

- [x] Add a governed authority atlas with source capability, access mode, terms, evidence ceiling, and connectivity status kept separate.
- [x] Add a cross-industry research universe with market-recognisable Chinese names, aliases, candidate branches, lifecycle gaps, and preferred sources.
- [x] Generate bounded Topic, Branch, provisional, and research-seed coverage campaigns with source-domain allowlists.
- [x] Route Agent web research through the campaign before the legacy generic search path, without treating a result as formal Evidence.
- [x] Add term-addressable public-API research for ClinicalTrials.gov, PubMed, Europe PMC, Crossref, OpenAlex, arXiv, GitHub, and Hugging Face; convert original records only into E1/low review candidates with provenance.
- [x] Separate direct-API and external-search budgets; rotate research-seed coverage and source calls so new-topic discovery receives regular capacity.
- [x] Require original-title concept consistency and reject future-dated API rows before model or operator review; persist seed identity to an S0 provisional candidate.
- [x] Reject unresolved or prompt-debris labels from future Branch campaigns.
- [x] Show coverage-plan status independently from external-search configuration in the Agent interface.
- [x] Add an audited operator-curated S0 monitoring baseline for market-recognisable core themes, map it to research-universe source preferences, and rotate it without inheriting Evidence or Stage.
- [x] Distinguish S0 records with no parent Evidence from an external-market early-stage conclusion, and display the resulting baseline-verification state in Chinese operator views.
- [x] Retrieve bounded readable excerpts from governed official/company-primary/academic pages after lead triage, with source-specific ClinicalTrials and arXiv extraction and no automatic Evidence path.
- [x] Hide unresolved or machine-generated branch labels from market-facing views while preserving the immutable registry record for naming audit.
- [x] Generate an auditable parent-evidence baseline and Topic/Branch naming-completion plan from current operational state; use it to prioritize coverage without changing lifecycle results.
- [x] Complete each research campaign through baseline plan → coverage → triage → bounded original-page retrieval, with every result remaining context-only until the existing Evidence Gate path.
- [x] Add cross-border company verification targets with official/IR domains and disclosure channels; reserve bounded query capacity without treating company pages as automatic Evidence.
- [x] Add SEC EDGAR full-text and Federal Register term-query adapters; static feeds must not be attached to an unrelated Topic merely because they share a broad domain.
- [ ] Configure a source-page retrieval bridge for regulator, policy, filing, and market-name research that lacks a lawful term-addressable public API.

## v0.12 Source-Backed Naming and Web Research

- [x] Separate stable IDs from source-backed Chinese market names and English retrieval aliases.
- [x] Keep new Topics/Branches unresolved until their Chinese market name has a cited source; block automatic graph activation otherwise.
- [x] Add provider-neutral external research leads through Brave, Tavily, optional GDELT, or a local/remote MCP HTTP Bridge.
- [x] Keep all search output `context_only`; require the existing source, Topic/Branch, Evidence, Stage Gate, and scoring flow for formal use.
- [x] Seed a reviewed parent-only BCI baseline through the existing Evidence Import admission ledger; S4 is evidence-derived and medical branches remain isolated.
- [ ] Configure a production search provider or MCP Bridge, record its terms/governance contract, and calibrate source-page retrieval before any automatic publication expansion.

## Current Source Change and Research Loop Extension

- Persist normalized Fact State and classify new, updated, unchanged, and not-observed records.
- Queue only new or updated facts; no-change is a valid completed result.
- Fail closed on disappearance from windowed, partial, stale, degraded, failed, or unpolled feeds.
- Correlate Source Sync, Intake, Topic Audit, Import, accepted Evidence IDs, Weekly, and Diff.
- Merge formal Evidence by ID and preserve prior imports.
- Reject stale review submissions and unrelated latest-artifact combinations.

## Current Source-Specific Normalization Extension

- Normalize the eight direct public operations with explicit operation-ID dispatch.
- Separate event time from information availability for Replay safety.
- Resolve event-level URLs and extract bounded metrics, geography, source-record IDs, and readable summaries.
- Persist normalizer ID/version and distinguish eligible from selected candidates.
- Keep all normalized output at unresolved E1/low/maintain until human review and formal import.

## Current Governed Source Operations Extension

- Maintain a machine-readable inventory of direct public and World Monitor-hosted operations.
- Require explicit `research_ready` governance and automated-polling permission before live sync.
- Record terms, attribution, redistribution, sensitivity, freshness, and retention policy per operation.
- Keep raw payloads transient and persist only hashes, bounded citations, provenance, counts, and sanitized status.
- Keep derived data context-only and all Evidence candidates behind Topic Resolver and human review.

## Phase 0: Documentation & Schema Setup

- Create core docs from the theory package.
- Create JSON schemas.
- Add golden case YAML files.
- Add initial tests for golden cases.
- No UI and no automated ingestion yet.

## Phase 1: Rule-based MVP

- Implement stage gate rules.
- Implement evidence strength rules.
- Implement parent vs branch separation.
- Implement scoring v0.2.
- Generate Markdown dashboard cards from structured YAML.

## Phase 2: Early Radar & Reactivation

- Implement Early Opportunity Radar.
- Implement Narrative Memory Bank.
- Implement Reactivation Engine.
- Add `repeated_old_story` detection.
- Add Narrative Delta Score.

## Phase 3: Evaluation & Failure Case Calibration

- Add failure case library.
- Add evaluation results.
- Add manual override audit trail.
- Add monthly review workflow.

## Phase 4: Dashboard Card and Example Output

- Generate Markdown Dashboard Cards from golden cases.
- Ensure every card includes `why_not_higher_stage`.
- Ensure research actions remain observation, tracking, validation, or risk-alert actions.
- Generate weekly narrative brief examples from structured evidence.

## Phase 5: Failure Case Library

- Add structured calibration failure cases.
- Include time period, peak stage, failed transition, false positives, missed warnings, corrective rules, and lessons.
- Use failure cases to calibrate misclassification rules.

## Phase 6: Architecture, Versioning, Audit, and Migration Readiness

- Add schemas and types for raw source, rule version, manual override, audit log, and evaluation result.
- Add audit log utilities, manual override records, rule version constants, and evaluation result scaffolding.
- Add incremental update markers such as `dirty_flag`, `event_hash`, `evidence_hash`, and `last_processed_at`.
- Preserve traceability from generated conclusions to evidence IDs.
- Keep the migration path from local YAML/Markdown/JSON MVP to PostgreSQL/Web Dashboard explicit.

## Phase 7: Final Integration and Quality Pass

- Run all available tests.
- Validate schemas, golden cases, examples, prompts, and failure cases.
- Check documentation consistency and no-trading-advice boundaries.
- Update `CHANGELOG.md`.
- Produce final implementation summary.

## Future Phase: Web Dashboard and Data Automation

- Add database.
- Add UI for topics, branches, evidence, scores, dashboard cards.
- Add semi-automated evidence extraction.
- Add source quality scoring and automated data confidence scoring.
- Add scheduled or incremental update pipelines.

## Current Executable Backend Extension

- Add `npm run pipeline` as the canonical local backend run command.
- Write schema-valid artifacts to `outputs/`.
- Keep Stage Snapshot, evidence IDs, score IDs, branch evidence, and reactivation references visible in generated outputs.
- Add CLI regression tests so the pipeline remains executable after future changes.

## Current Operator Report Extension

- Add `npm run report` as the canonical local operator brief command.
- Read existing pipeline artifacts from `outputs/` without reclassifying or rescoring.
- Write `outputs/reports/weekly_brief.md` and `outputs/reports/weekly_brief.json`.
- Validate `weekly_brief.json` against `schemas/weekly_brief.schema.json`.
- Preserve `why_not_higher_stage`, evidence IDs, reactivation references, and research-only actions in the report.
- Fail clearly with `Please run npm run pipeline first.` when pipeline artifacts are missing.

## Current Manual Evidence Import Extension

- Add `npm run evidence:validate` for manual evidence draft validation.
- Add `npm run evidence:import` for validate-normalize-import-audit workflow.
- Write validation and import reports under `outputs/imports/`.
- Write normalized accepted imports under `data/imports/accepted/`.
- Write rejected imports under `data/imports/rejected/`.
- Write imported pipeline fixture rows to `data/sample_evidence/manual_imported_evidence.yaml`.
- Write audit records to `data/audit/evidence_import_audit.jsonl`.
- Preserve parent vs branch scope separation before imported evidence can enter `npm run pipeline`.
- Keep import layer free of stage classification, scoring, dashboard generation, Early Radar generation, LLM scoring, and trading advice.

## Current Previous Report Diff Extension

- Add `npm run diff` to compare current artifacts with the latest stage snapshot.
- Persist deterministic stage snapshots and weekly report copies under `outputs/history/`.
- Detect stage upgrades, downgrades, state-band changes, evidence changes, `why_not_higher_stage` changes, Data Confidence changes, branch mutations, Early Radar changes, and guardrail regressions.
- Preserve display stage and Stage Gate stage separately in history.
- Keep diffing mechanical and research-only: no classification, scoring, evidence inference, parent lift, or trading advice.

## Current Run History and Report Integration Extension

- Add injected `RunContext` identity and unique per-run snapshot, diff, report, and manifest artifacts.
- Add `npm run weekly` as the shared-context `pipeline -> diff -> report` workflow.
- Keep `outputs/diffs/latest_stage_diff.*` and `outputs/reports/weekly_brief.*` as convenience paths while preserving immutable `outputs/runs/<run_id>/` records.
- Build diff snapshots directly from pipeline artifacts; build weekly brief stage changes only from canonical diff artifacts.
- Update the latest successful run pointer only after the full workflow completes successfully.

## Current Historical Operator Review Extension

- Add `npm run review` to aggregate immutable run history.
- Read only `outputs/runs/*/run_manifest.json`, `stage_diff.json`, and `weekly_brief.json`.
- Write latest and historical operator review artifacts under `outputs/reviews/`.
- Summarize review window, run success/failure counts, stage trends, evidence trends, `why_not_higher_stage`, Data Confidence, branch mutation, Early Radar, guardrail regression, repeated issues, consecutive `no_change` topics, high-priority operator alerts, and research-only next actions.
- Keep review historical and mechanical: no classification, scoring, evidence inference, history mutation, branch-to-parent lift, UI, database, automated ingestion, or trading advice.

## Current Product Core Hardening Extension

- Split the product core into Domain, Application, Infrastructure, and Interface layers.
- Add Application use cases for evidence import, pipeline, diff, weekly brief, operator review, and weekly orchestration.
- Add repository contracts for Evidence, Topic, Artifact, Run, History, Failure Case, Review, and Golden Case access.
- Add file-system adapters plus InMemory test adapters; PostgreSQL remains out of scope.
- Add versioned artifact metadata to stable public artifacts.
- Add schema compatibility and migration policy documentation.
- Add architectural boundary tests to keep Domain/Application free of direct filesystem, YAML, CLI, and output-path dependencies.
- Add v0.4 product scenarios for parent/branch separation, E4 S6 movement, downgrade on evidence removal, confidence drop, S7C branch mutation, old theme reactivation, idempotent import, guardrail regression, and old-schema rejection.

## Current Service-to-Layer Cleanup Extension

- Generate a machine-readable legacy service inventory.
- Migrate pure domain rules out of `src/services` while retaining compatibility wrappers.
- Move evidence import I/O into Infrastructure and evidence import normalization into Application.
- Move run context into Infrastructure.
- Add dependency-boundary tests, legacy inventory tests, parity tests, artifact semantic snapshot tests, and CLI compatibility coverage.
- Keep remaining legacy-active services explicitly categorized with migration target and reason.
- Preserve CLI commands, artifact shapes, schemas, parent/branch separation, Stage Gate behavior, guardrails, and research-only outputs.

## Current Live Research Pilot Extension

- Add `npm run pilot:init` to create manual pilot seed files for 10-15 research topics.
- Add `npm run pilot:review` to generate a schema-valid research ledger and evaluation summary from existing artifacts plus operator observations.
- Read only latest run, weekly brief, canonical stage diff, operator review, pilot topics, and operator observations.
- Track current and competing hypotheses, prior band, posterior direction, event intensity, tail structure, strongest evidence IDs, `why_not_higher_stage`, falsification triggers, validation windows, operator agreement, comments, and outcome status.
- Summarize research time saved, operator agreement, stage-change precision, Early Radar follow-through, false positives, missed changes, falsifications, and consecutive `no_change` runs.
- Mark early or unavailable metrics as `insufficient_history`; do not invent precision or probabilities.
- Keep Pilot mechanical and research-only: no classification, scoring, evidence inference, branch-to-parent lift, UI, database, automated ingestion, source-quality model, probability model, or trading advice.

## Current Historical Replay Extension

- Add `available_at` to Evidence and manual evidence import so historical replay can prevent future-evidence leakage.
- Add `npm run replay` to run time-sliced historical narrative cases.
- Read `data/replay/replay_cases.yaml` and write replay ledger JSON/Markdown under `outputs/replay/`.
- Run Stage, Diff, and Early Radar checks at T0-Tn using only evidence available at that slice.
- Reveal outcome only after the slice path is complete.
- Cover success, failure, S7B, S7C, parent/branch separation, and long `no_change` cases.
- Report stage paths, future evidence excluded, misclassification, lead time, missed changes, false positives, and calibration suggestions.
- Do not use future evidence, price movement, branch-to-parent lift, automated ingestion, UI, database, or trading advice.

## Current Friendly Operator Guide Extension

- Add non-developer guides: `docs/QUICKSTART.md`, `docs/OPERATOR_GUIDE.md`, `docs/EVIDENCE_GUIDE.md`, `docs/REPLAY_GUIDE.md`, and `docs/TROUBLESHOOTING.md`.
- Organize operator workflow around four steps: record evidence, run weekly, inspect changes, record outcomes.
- Keep technical details in appendices and foreground current state, change reason, `why_not_higher_stage`, and next validation.

## Current Evidence Intake Workbench Extension

- Add `npm run intake:prepare` to parse TXT, Markdown, DOCX, HTML, pasted text, and text-based PDF into RawDocument, DocumentChunk, EvidenceCandidate, and ProvenanceRecord artifacts.
- Add `npm run intake:apply` to apply human ReviewDecision YAML, create reviewed evidence drafts, run existing Evidence Import validation/import, and run weekly after successful import.
- Generate a static left/right workbench artifact with source text, highlighted quotes, Evidence Cards, Chinese field explanations, E0-E4 rationale, uncertainty notes, and accept/modify/reject/split controls.
- Keep candidate extraction rule-based and transparent; AI-style output is candidate draft only and never formal evidence.
- Preserve duplicate detection, schema validation, Parent/Branch guardrails, complete audit records, CLI compatibility, and no-trading-advice boundaries.
- Keep OCR, automated networking, database, unattended import, automatic rule changes, and trading advice out of scope.

## Current Intake Intelligence Calibration & Narrative Resolver Extension

- Add `npm run intake:evaluate` to evaluate Review Feedback after human decisions.
- Track candidate final decision, modified fields, rejection reason, review time, duplicate hits, field accuracy, and Parent/Branch errors.
- Report acceptance, modification, rejection, split, field-accuracy, review-time, duplicate-prevention, and Parent/Branch error metrics.
- Add Canonical Topic Registry, Alias Registry, Branch Registry, Provisional Topic queue, and Narrative Memory topic lookup under `data/topic_registry/`.
- Add `npm run topic:validate` to classify candidates as `existing_topic`, `alias_of`, `new_branch`, `reactivation`, `new_provisional_topic`, or `unresolved`.
- Keep topic resolution conservative: no forced mapping, no high-stage inheritance for provisional topics, no branch-to-parent lift, and audit history for alias/new-branch/reactivation/provisional decisions.
- Add a shadow-only AI Candidate Generator adapter that produces alternative mappings with quotes, reasons, uncertainty notes, and alternatives; AI cannot import, create active topics, upgrade stage, or change rules.
- Keep UI, database, automated ingestion, source-quality model, and trading advice out of scope.

## Current Interactive Intake Pilot Extension

- Add `npm run intake:workbench` to start a local browser-based Evidence Intake Workbench.
- Support drag/drop or pasted text, document parsing, Topic resolution, rule candidates, AI-shadow comparison, source highlighting, editable Evidence Cards, and human decisions without YAML editing.
- Provide in-browser fields for Topic, Branch, Topic resolution status, Scope, E0-E4, affected layers, summary, interpretation, limitation, confidence, accept/modify/reject/split, and Chinese field guidance.
- Add one-click Validate / Import / Weekly using the existing Evidence Import and Weekly use cases.
- Show post-import impact from latest weekly and diff artifacts, including stage, Data Confidence, and `why_not_higher_stage`.
- Keep AI shadow-only: no automatic import, active topic creation, stage upgrade, or rule mutation.
- Add a 24-document local pilot corpus covering existing topic, alias, new branch, reactivation, provisional topic, unresolved, duplicate, and multi-evidence cases.
- Keep full Dashboard, database, automated networking, OCR, unattended import, and automated rule changes out of scope.

## Current Real AI Shadow Validation Extension

- Add `npm run intake:ai-shadow` to run provider-neutral AI-shadow candidate generation against the latest intake session.
- Add `npm run intake:ai-evaluate` to compare the frozen v0.5.6 rule baseline with AI-shadow output across a 50-document pilot corpus.
- Require AI output to match the Evidence Candidate schema and include quote, source location, suggested reason, uncertainty notes, alternative mappings, `model_version`, and `prompt_version`.
- Validate model output for schema shape, quote consistency, Parent/Branch scope, E0-E4 bounds, no-trading-advice language, and unsupported E3/E4 overstatement before showing it to the operator.
- Add Workbench differences for Topic, Branch, Scope, Strength, Affected Layer, fact splitting, and Limitation, with operator choices: rule, AI, merge, manual, or unresolved.
- Keep AI shadow-only: it cannot import evidence, create active topics, upgrade stages, change registries, change rules, or bypass human review.
- Expand the local pilot corpus from 24 to 50 documents, including Chinese policy / traditional Chinese medicine planning examples, while preserving duplicate, unresolved, reactivation, branch, and multi-evidence cases.
- On provider failure, timeout, missing credentials, or invalid output, fall back to rule-based candidates and record the event in audit artifacts without persisting sensitive keys.

## Current Smart Evidence Intake Agent Extension

- Add `npm run intake:agent -- --file <path>` and `npm run intake:agent -- --text <text>` for the first bounded research assistant.
- Use an OpenAI-compatible Provider adapter with configurable endpoint, model, timeout, and environment-only API key.
- Produce Agent Candidates with exact source quotes and offsets, supported fact, separate interpretation, limitation, uncertainty, alternative mappings, Topic/Branch/Scope suggestions, and E0-E4 suggestions.
- Verify model output locally for schema shape, citation consistency, fact/interpretation separation, Parent/Branch scope, E0-E4 overstatement, and no-trading-advice language.
- Fall back to deterministic rule candidates on missing credentials, timeout, provider error, invalid JSON, invalid schema shape, unsupported citation, or guardrail failure.
- Write candidate, verification, audit, and Markdown review artifacts without importing Evidence.
- Require human review followed by the existing Validator, Evidence Import, and Weekly pipeline before any candidate can become formal Evidence.
- Keep the Agent read-only with respect to Topic Registry, Narrative Memory, Stage, Score, rules, and historical artifacts.
- Support DeepSeek through `DEEPSEEK_API_KEY`, with explicit `NARRATIVE_AGENT_*` configuration taking precedence; do not persist provider secrets.

## Product Roadmap

- v0.5 Live Research Pilot
- v0.5.1 Historical Narrative Replay
- v0.5.2 Friendly Operator Guide
- v0.5.4 Evidence Intake Workbench
- v0.5.5 Intake Intelligence Calibration & Narrative Resolver
- v0.5.6 Interactive Intake Pilot
- v0.5.7 Real AI Shadow Validation
- v0.5.8 Smart Evidence Intake Agent
- v0.6.0 Cross-Industry Evidence Intake Foundation
- v0.6.1 Pilot Iteration After 4-6 Weeks
- v0.6.2 Self-iterating Agent Feedback Loop
- v0.7 Read-Only Operator Interface
- v0.8 PostgreSQL Adapter

## v0.6.1 UI Design System

- Treat the Workbench as a source-first research tool with a visible four-step workflow.
- Use shared visual tokens, semantic status text, accessible focus states, stable layouts, and responsive desktop/mobile behavior.
- Keep AI Shadow, resolver, evidence validation, import, and lifecycle impact distinct in the visual hierarchy.
- Require UI QA for empty, loading, error, fallback, long-text, keyboard, desktop, and mobile states before future interface work is accepted.

## v0.6.2 Self-iterating Agent Feedback Loop

- Preserve multiple independent Agent facts as reviewable Evidence Cards, including Agent-only candidates not present in the rule baseline.
- Record human accept/modify/reject/split decisions, field corrections, Topic/Branch corrections, rejection patterns, duplicate hits, and guardrail incidents in a versioned Learning Profile.
- Feed only the advisory Learning Profile into future Agent prompts to improve review prioritization and alternative mappings.
- Keep learning read-only with respect to rules, registries, Stage, Score, and import permission; all rule or registry changes require a separately reviewed change.
- Expose the loop through `npm run intake:learn` and the Workbench `生成学习记录` action.

## v0.7 Core Narrative Monitoring Dashboard

- Make `/` the strategic, read-only view for core narratives instead of the evidence intake form.
- Aggregate only canonical run snapshot, weekly brief, stage diff, operator review, unresolved queue, and Learning Profile metadata; never reclassify, score, or infer evidence in the interface.
- Provide connected routes for theme detail (`/topics/:topic_id`), research queue (`/queue`), learning and guardrails (`/governance`), and controlled evidence intake (`/intake`).
- Keep parent stage and branch stage visibly separate. Branch changes, including S7 mutations, cannot alter the parent stage in the view model.
- Make `why_not_higher_stage`, Data Confidence, evidence count, and research-only next action visible in each relevant view.
- Verify the complete navigation and import path with route tests and desktop/mobile browser screenshots.

## v0.7.1 Intake Automation Flow

- Present one researcher-facing `智能解析材料` action for supported pasted or local document material.
- Chain parsing, rule candidates, AI Shadow, Topic/Branch validation, and citation/safety validation before cards become reviewable.
- Keep repeated technical actions available but secondary, and present automation status without implying that AI candidates are formal Evidence.
- Measure completion, review time, field modifications, resolver accuracy, citation accuracy, unsupported claims, duplicate prevention, and guardrail incidents before expanding autonomous behavior.

## v0.7.2 Quantitative Theory Core

- Formalize evidence quality with strength, authority, reviewed confidence, and recency decay.
- Aggregate independent sources with duplicate-resistant noisy-OR support and separate positive/negative evidence.
- Preserve the Stage Gate as a discrete hard constraint and apply Data Confidence as a maximum-stage cap.
- Treat Transition Readiness as uncalibrated until Historical Replay supplies enough labeled outcomes.
- Require Narrative Memory before calculating Narrative Delta.
- Evaluate Agent routing through citation, field, Resolver, recall, safety, latency, and cost metrics with hard promotion blockers.
- Add bounded retries and deterministic circuit-breaker conditions before any provider routing optimization.

## v0.7.3 Governed Active Learning

- Automatically convert every completed human review into an idempotent cumulative Learning Profile update.
- Prioritize candidate review using uncertainty, Rule/Agent disagreement, historical correction density, novelty, and high-impact Parent/Branch or E3/E4 risk.
- Require three consistent observations before a correction pattern becomes ready for Shadow validation.
- Require at least 50 reviewed candidates plus citation, unsupported-claim, Parent/Branch, E3/E4, and research-only gates before an Agent version can enter human promotion review.
- Keep all proposals advisory-only; never mutate canonical rules, Registry, Stage, Score, Evidence, or import permission automatically.
- Persist immutable learning cycles, proposal queues, promotion blockers, and rollback profile references.
- Surface learning progress and blockers on `/governance`.

## v0.7.4 Truthful Operator Dashboard

- Use existing JSON artifacts for Overview, Changes, Topics, Evidence Inbox, Review Queue, Agent Runs, Sources, Methodology, Governance, and Intake.
- Mark provider fallback, automatic ingestion, OCR, scheduling, stale artifacts, and unlabelled runs explicitly; never imply unavailable automation.
- Generate Agent and AI-shadow candidates before the unified Topic Resolver pass.
- Require matching `session_id` across intake session, topic audit, apply result, evaluation, and learning artifacts.
- Keep the dashboard read-only with respect to Stage, Score, Evidence inference, registries, and immutable run history.

## v0.7.5 Source Operations Adapter

- Treat the World Monitor OpenAPI contracts as the machine-readable capability registry; catalog presence never implies live connectivity.
- Inventory every published operation and mark it as production-ready, key-required, parameter-required, manual, sandbox-only, context-only, or unsupported.
- Add direct public upstream adapters where the reference implementation documents a stable, no-key JSON endpoint.
- Store source URL, fetch time, payload hash, record counts, degraded/stale state, candidate count, and sanitized errors without persisting credentials.
- Keep sandbox, forecasts, backtests, risk composites, and other derived outputs outside formal Evidence.
- Convert live source records only into E1, low-confidence, unresolved candidates; run Topic Resolver and require human review before existing import.

## v0.7.9 Source Materiality And Recovery

- Preserve every normalized semantic revision in Fact State while sending only material revisions to Intake.
- Apply explicit per-source thresholds to USGS, GDACS, NWS, Treasury, CFTC, and World Bank metrics; keep uncalibrated sources conservative and explain every decision.
- Treat materiality only as review routing. It cannot assign Topic/Branch, raise Evidence strength, classify Stage, or score a narrative.
- Recover `imported_pipeline_failed` by rerunning Weekly only; never repeat Evidence import.
- Persist each Apply/recovery state in immutable history and expose retry count and sanitized failure context.
- Next calibration work: time-series baselines across distinct upstream records, source-specific new-event thresholds, and recovery idempotency keys.

## v0.7.10 Operator Navigation

- Keep exactly five global destinations: Overview, Changes, Topics, Research Queue, and System.
- Keep `录入材料` as the only persistent global primary action.
- Group candidate Evidence under Research Queue and operational/reference pages under System without removing old URLs.
- Use local secondary navigation, grouped active states, and `aria-current`.
- Verify desktop and mobile layouts before adding another top-level destination.

## v0.7.11 Researcher Language Layer

- Default screens answer four questions: current state, what changed, why it changed, and what to validate next.
- Use Chinese research language for operator-visible labels; keep raw schema enums only as stable form values and artifact fields.
- Pair S0-S7 and E0-E4 codes with concise meanings instead of showing unexplained codes.
- Hide run, session, candidate, evidence, provider, prompt, and rule identifiers in collapsed `技术详情`.
- Preserve exact IDs for audit and debugging; never delete or rewrite them merely for presentation.
- Keep formulas and implementation details in Methodology or progressive disclosure, not in the primary workflow.

## v0.7.12 Chinese Operator Interface

- Use Simplified Chinese for all operator-facing navigation, actions, statuses, errors, methodology, governance, source operations, and empty states.
- Use readable Chinese fallbacks for unknown enum values instead of exposing implementation tokens.
- Preserve original evidence text, proper nouns, formulas, schema values, API contracts, and audit identifiers.
- Enforce the language boundary with interface regression tests and desktop/mobile browser review.

## v0.8.0 Self-Iterating Knowledge Loop

- Generate Topic Discovery Proposals when the resolver finds a new topic, branch, alias, reactivation, or unresolved mapping.
- Generate candidate Evidence Chain Entries that preserve scope, provenance, prior Evidence IDs, gate context, and relation type.
- Give the Agent compact context from the Canonical Topic Registry, Narrative Memory IDs, Evidence Table, latest canonical Diff, and advisory Learning Profile.
- Surface pending Topic and Evidence Chain proposals in the Research Queue; keep the formal import path unchanged.
- Require explicit human decisions before any candidate Evidence can enter the existing Validator, Import, and Weekly flow.

## v0.10.0 Autonomous Narrative Discovery

- Add a Domain-level, cross-industry Parent/Branch discovery engine that combines source quotes, rule/model candidates, canonical Topics, aliases, Narrative Memory, and duplicate similarity checks.
- Recognize a concrete application, mechanism, indication, user group, geography, value-chain link, product form, or scenario as a possible Branch only after a Parent match; keep broad labels unresolved.
- Normalize source-grounded new topic suggestions into provisional Topics instead of silently dropping unprefixed model topic IDs.
- Persist a versioned discovery report and source-document ledger; retain independent support counts while making reruns idempotent.
- Register new Topics only as `provisional/S0` and new Branches only as `watch`; rewrite Branch Evidence to isolated `branch` scope before the existing Topic Resolver, Validator, and publication policy.
- Keep Stage, Scoring, active Topic promotion, rule mutation, and trading advice outside the discovery layer.
- Keep Topic activation, Stage, Score, Parent/Branch, Narrative Memory, and rule changes outside Agent write access.
- Add regression coverage for branch-only proposals, idempotency, human-review import gates, golden fixture isolation, and advisory learning guardrails.

## v0.11.0 Autonomous Narrative Operations

- Complete the governed source -> candidate -> discovery -> formal Evidence -> graph promotion -> deterministic Stage/Diff/Weekly/Review loop.
- Register new directions automatically as `provisional/S0`; promote them to active only after two independent, eligible parent-scope Evidence sources satisfy the versioned policy.
- Register applications, mechanisms, named products, molecular assets, SKUs, and other source identifiers as `watch` Branches; promote each only after two independent, eligible branch-scope Evidence sources.
- Store each registry transition in a schema-valid promotion report and append-only audit ledger; make reruns idempotent.
- Automatically hold unresolved, duplicate, weak, conflicting, negative, unsafe, or source-insufficient material. A hold is a completed system outcome, not an implicit failure.
- Keep Branch/asset Evidence isolated from parent Stage; retain Evidence Table -> Stage Gate -> Score order and never permit model-controlled Stage, Score, policy, or rule changes.
- Surface activated topics, activated branches/assets, and holds in the local Agent dashboard and run manifest.

## v0.9 Controlled Autonomous Research Loop

- Keep Golden Case regression artifacts separate from the one canonical operational chain under `outputs/operator_runs/`.
- Publish only provenance-complete primary records that pass the explicit policy; hold news, conflicts, unresolved mappings, weak evidence, risky Parent/Branch mappings, and large parent-stage changes.
- Treat exact duplicate evidence imports as audited idempotent no-ops; reject changed content that reuses an Evidence ID.
- Admit manual evidence to live Stage Gates only after an explicit `operational_evidence_admission` entry. Preserve historical rows for revalidation rather than deleting or silently trusting legacy bulk imports.
- Support a no-publication rebuild through `npm run autonomy:run -- --no-publish` so an operator can write a valid no-change state after corrections.
- Next: establish a weekly review cadence, revalidate quarantined historical source records, and calibrate the independent-source threshold with measured false-positive and missed-discovery rates.
