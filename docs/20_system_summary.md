# System Summary

For the current implementation status, operational risks, artifact freshness, and successor checklist, read `docs/HANDOFF.md`. The governed Agent loop is documented in `docs/30_self_iterating_agent_loop.md`; autonomous Topic/Branch graph discovery is documented in `docs/32_autonomous_narrative_discovery.md`; source-backed naming and external research are documented in `docs/34_source_backed_naming_and_web_research.md`; authoritative coverage planning is documented in `docs/35_authoritative_source_mesh_and_research_universe.md`.

## Mission

Narrative Lifecycle Dashboard is an evidence-first research decision-support system. It detects narrative state changes, validates lifecycle stages, separates parent and branch narratives, and produces traceable dashboard outputs.

It is not a trading system and does not produce buy/sell advice, target prices, position sizing, entries, exits, or execution instructions.

## Executable Backend

Run:

```bash
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
npm run intake:learning-cycle
npm run intake:apply -- --decisions outputs/intake/latest_review_decisions.yaml
npm run topic:validate
npm run intake:evaluate -- --decisions outputs/intake/latest_review_decisions.yaml
npm run intake:ai-shadow
npm run intake:ai-evaluate
npm run intake:learn -- --decisions outputs/intake/interactive_review_decisions.yaml
npm run research:search -- --topic bci
npm run research:campaign -- --max-tasks 60 --max-queries 12
npm run research:triage
```

## Source-Backed Naming and External Research

Topics and branches now retain their stable internal IDs while displaying a separate Chinese market name, English retrieval name, naming status, and naming-source citations. An internally generated label is not market consensus: unresolved names cannot be automatically activated.

`npm run research:search` produces source URLs and bounded discovery snippets under `outputs/research/`; every lead is context-only and must pass the normal original-source, resolver, Evidence, Stage Gate, and scoring sequence. The keyless `free` provider is available as a bounded public-index discovery baseline; governed source-page retrieval can use an explicitly configured Brave, Tavily, or MCP Bridge provider. A configured DeepSeek/OpenAI-compatible chat model does not itself imply web access. No keys are written to artifacts.

After deterministic lead triage, `npm run research:retrieve -- --max 6` writes `outputs/research/latest_source_retrieval.{json,md}`. It is a bounded original-page package, not an ingestion path: each item retains its original URL and hash and contains no more than three readable excerpts. ClinicalTrials pages are resolved through their public structured study record, arXiv pages through the abstract, and generic pages have navigation chrome removed. The Agent view labels these excerpts as review material; they cannot create Evidence, change a Stage/Score, activate a Topic/Branch, or cross a branch into a parent.

For operator clarity, an active parent at `S0` with no formal parent Evidence is a `baseline_required` record in the view model. The Chinese UI says “待完成阶段基准核验”; it does not assert the real-world narrative is at an early stage. Formal evidence remains required before a mature lifecycle stage can be claimed.

`npm run research:baseline` builds the next operational closure layer: `outputs/research/latest_baseline_completion.{json,md}` lists missing parent-evidence baselines, Topic-name verification, and Branch-name verification separately. A campaign invokes it before coverage and boosts only missing parent-evidence Topics to the top of the research order. After web/direct discovery, the same campaign runs deterministic lead triage and bounded original-page retrieval. This changes only the research queue: the plan is `context_only`, cannot name a node, import Evidence, modify the registry, set a Stage/Score, or use a branch to lift a parent.

The reviewed BCI parent baseline in `data/imports/bci_market_baseline_2026_08.yaml` has been admitted through the standard Evidence Import ledger. It supports S4 through a stable official Chinese label plus capital confirmation. It intentionally does not use medical-rehabilitation branch material to claim parent pricing adoption or hard reality, so S5/S6 remain gated.

## Authoritative Source Mesh and Research Universe

The authority atlas at `data/source_atlas/authoritative_sources.yaml` records 43 sources across statutory, regulatory, filing, intergovernmental, academic, and company-disclosure channels. It records source capability and governance separately from actual connectivity. A listed source is not assumed to be scraped, queried, or licensed for automation.

The cross-industry research universe at `data/research_universe/core_topics.yaml` records 40 market-recognisable Chinese research seeds and candidate branches. `npm run research:campaign` combines the registry, branches, atlas, and universe into `outputs/research/latest_campaign.{json,md}`. Formal Topics, provisional Topics, watch Branches, and research seeds remain explicitly distinct. Each campaign task uses allowed source domains and remains a research instruction, never a Stage change or an Evidence import.

An operator-curated monitoring baseline adds 17 formal monitored Topics, including 14 topics deliberately held at S0. The curation audit at `data/audit/core_topic_curation_20260803.json` grants recurring coverage only: it has no Evidence, Stage, Score, Branch, or automatic-name-verification effect. Established topics retain recurring coverage; the curated S0 topics rotate through the remaining formal coverage budget.

Term-addressable, automation-permitted public APIs currently include ClinicalTrials.gov, PubMed, Europe PMC, Crossref, OpenAlex, arXiv, GitHub, Hugging Face, SEC EDGAR full-text search, and the Federal Register Documents API. Campaign queries write `outputs/research/latest_direct_source_research.{json,md}` and create a provenance-complete E1/low Intake session only. Direct APIs use a separate bounded budget from web search, visible-title concept consistency, future-date rejection, 6-hour research-seed rotation, and source-call round-robin. A compact SEC filing title is allowed only when both a mapped U.S. company and a concept-bearing filing description match; a full-text index hit alone is insufficient. A seed persists as a `provisional_*` S0 candidate; it never inherits an existing Topic Stage. Each result preserves a source URL and exact stored title offset; it must still pass Topic Resolver, human review, duplicate detection, Evidence Table admission, Stage Gate, and scoring. Static public feeds are not treated as Topic-specific connectors.

The companion `data/company_registry/core_companies.yaml` maps 30 China, Hong Kong, U.S., and global company verification targets to official/IR domains, disclosure channels, and research Topics. A bounded share of external-search capacity can check these official pages while retaining Topic/Branch scope. Company records stay context-only until original-source verification, resolver, Evidence Table admission, Stage Gate, and scoring have all run.

`outputs/research/latest_lead_triage.{json,md}` is the deterministic review queue built after each coverage campaign, or rebuilt with `npm run research:triage`. It combines direct and web leads without reclassifying a Topic. Each item remains `context_only`, has an explainable source/relevance/freshness label, preserves parent-versus-branch scope, and is assigned only a review order. It has no path to automatic Evidence import, Stage/Score changes, Topic/Branch activation, or trading output.

The command loads local YAML fixtures, runs the rule engine, validates generated artifacts against JSON schemas, and writes:

- `outputs/dashboard_cards/*.json`
- `outputs/scores/*.json`
- `outputs/golden_case_results.json`
- `outputs/early_radar_candidates.json`
- `outputs/evaluation_summary.json`
- `outputs/system_summary.json`

Then `npm run report` reads those artifacts and writes:

- `outputs/reports/weekly_brief.md`
- `outputs/reports/weekly_brief.json`

Then `npm run diff` compares current pipeline artifacts with the latest saved snapshot and writes:

- `outputs/diffs/latest_stage_diff.json`
- `outputs/diffs/latest_stage_diff.md`
- `outputs/history/stage_snapshots/<snapshot_id>.json`

`npm run weekly` is the canonical workflow. It creates a unique run ID and performs `pipeline -> diff -> report` with the same run context. Each successful run writes immutable artifacts under `outputs/runs/<run_id>/`, including a run manifest; `outputs/runs/latest_run.json` is updated atomically only after success.

Then `npm run review` aggregates immutable historical run artifacts and writes:

- `outputs/reviews/latest_operator_review.json`
- `outputs/reviews/latest_operator_review.md`
- `outputs/reviews/history/operator_review_<run_id>.json`

The historical review reads only run manifests, canonical stage diffs, and weekly briefs under `outputs/runs/*/`. It does not reclassify stages, recalculate scores, infer evidence, mutate run history, or treat branch mutation as a parent-stage upgrade.

Then `npm run pilot:init` creates manual live-research pilot files:

- `data/pilot/pilot_topics.yaml`
- `data/pilot/operator_observations.yaml`

Then `npm run pilot:review` records and evaluates the current pilot ledger from existing artifacts and operator observations:

- `outputs/pilot/latest_research_ledger.json`
- `outputs/pilot/latest_research_ledger.md`
- `outputs/pilot/history/research_ledger_<run_id>.json`
- `outputs/pilot/pilot_evaluation_summary.json`

The Pilot layer is a 4-6 week research trial layer. It tracks 10-15 topics with current and competing hypotheses, prior band, posterior direction, event intensity, tail structure, strongest evidence IDs, `why_not_higher_stage`, falsification trigger, validation window, operator agreement, comments, and outcome status. It does not classify, score, infer evidence, produce precise probabilities, mutate historical artifacts, or treat branch mutation as parent-stage movement.

Then `npm run replay` runs historical time-slice validation:

- `data/replay/replay_cases.yaml`
- `outputs/replay/latest_replay_ledger.json`
- `outputs/replay/latest_replay_ledger.md`
- `outputs/replay/history/replay_ledger_<run_id>.json`

Replay uses each evidence row's `available_at` field to ensure the system only uses information available at the replay slice. It runs Stage, Diff, and Early Radar checks before revealing the outcome, then reports stage paths, future evidence excluded, misclassification, lead time, missed changes, false positives, and calibration suggestions. It does not use price movement as proof, future evidence, or branch evidence to lift parent stages.

Then `npm run intake:prepare` creates the Evidence Intake Workbench:

- `outputs/intake/latest_raw_document.json`
- `outputs/intake/latest_chunks.json`
- `outputs/intake/latest_candidates.json`
- `outputs/intake/latest_provenance.json`
- `outputs/intake/latest_review_decisions.yaml`
- `outputs/intake/latest_workbench.html`

Then `npm run intake:apply` reads human review decisions, writes a reviewed evidence draft, runs existing Evidence Import validation/import, and runs weekly after a successful import:

- `outputs/intake/reviewed_evidence_draft.yaml`
- `outputs/intake/latest_apply_result.json`
- `outputs/intake/latest_apply_result.md`
- `outputs/intake/intake_audit.jsonl`

The Intake layer parses documents, chunks text, proposes candidate Evidence fields, and records provenance. It does not formally import evidence without human review and does not bypass schema validation, duplicate detection, Parent/Branch guardrails, or the existing import workflow.

`npm run intake:workbench` starts the local Narrative Monitor on `127.0.0.1`. `/`, `/changes`, `/topics`, `/inbox`, `/queue`, `/runs`, and `/sources` expose Overview, incremental change, canonical narratives, pending candidates, risk-prioritized review, run history, and source configuration. `/methodology`, `/governance`, and `/intake` retain the quantitative, governed-learning, and controlled evidence workflows. The monitor aggregates existing artifacts only: it cannot classify, score, infer evidence, modify history, or upgrade a parent from branch evidence.

The operator UI distinguishes observed artifacts, pending human review, stale data, fallback operation, and unconfigured capability. Provider state, automatic ingestion, OCR, scheduling, artifact timestamps, and unlabelled test/research runs are visible rather than implied. Interactive preparation now generates Agent and AI-shadow candidates before one Topic Resolver pass, and downstream evaluation/learning rejects mismatched `session_id` artifacts.

The `/intake` workbench supports drag/drop or pasted text, source highlighting, browser-edited Evidence Cards, Topic resolution status controls, accept/modify/reject/split decisions, and one-click Validate / Import / Weekly. The server writes interactive review decisions under `outputs/intake/` and then reuses the existing validator, import, and weekly use cases.

Then `npm run topic:validate` and `npm run intake:evaluate` calibrate intake intelligence:

- `outputs/intake/latest_topic_resolution_audit.json`
- `outputs/intake/latest_topic_resolution_audit.md`
- `outputs/intake/latest_unresolved_queue.json`
- `outputs/intake/latest_topic_registry_validation.json`
- `outputs/intake/latest_evaluation.json`

Then `npm run intake:ai-shadow` and `npm run intake:ai-evaluate` run Real AI Shadow Validation:

- `outputs/intake/latest_ai_shadow_candidates.json`
- `outputs/intake/latest_candidate_comparisons.json`
- `outputs/intake/latest_ai_shadow_audit.json`
- `outputs/intake/latest_ai_shadow_validation_report.json`
- `outputs/intake/latest_real_ai_shadow_evaluation.json`

The AI-shadow path compares the frozen v0.5.6 rule baseline with provider-neutral model candidates. AI candidates are schema checked, quote checked, Parent/Branch checked, E0-E4 checked, and no-trading-advice checked. Invalid or unavailable model output falls back to rule candidates. AI cannot import evidence, create active topics, upgrade stages, change registries, or change rules.
- `outputs/intake/latest_evaluation.md`

The resolver reads `data/topic_registry/` and classifies each candidate as `existing_topic`, `alias_of`, `new_branch`, `reactivation`, `new_provisional_topic`, or `unresolved`. It does not force ambiguous mappings, activate provisional topics, inherit high stages, or upgrade parent narratives from branch evidence. The evaluation layer records Review Feedback metrics including acceptance, modification, rejection, split, field accuracy, review time, duplicate prevention, AI-shadow difference count, and Parent/Branch error rate.

Manual evidence import runs before the pipeline:

- `data/imports/evidence_draft.example.yaml`
- `outputs/imports/evidence_validation_report.json`
- `outputs/imports/evidence_validation_report.md`
- `outputs/imports/evidence_import_report.json`
- `outputs/imports/evidence_import_report.md`
- `data/imports/accepted/<import_id>.yaml`
- `data/imports/rejected/<import_id>.yaml`
- `data/sample_evidence/manual_imported_evidence.yaml`
- `data/audit/evidence_import_audit.jsonl`

## Architecture Checklist

- Domain layer: pure Evidence, Topic/Branch, Stage Gate, Scoring, Reactivation, and Diff rules. It has no direct filesystem, YAML, CLI, or output-path dependency.
- Application layer: use cases orchestrate ImportEvidence, RunPipeline, BuildDiff, BuildWeeklyBrief, BuildOperatorReview, and weekly runs through repository and system contracts.
- Infrastructure layer: file-system adapters implement repositories, YAML loading, schema validation, atomic writing, run history, review persistence, and clock access.
- Interface layer: CLI commands call Application use cases and print summaries.
- Data repositories: YAML loaders for topics, evidence, golden cases, failure cases, evaluations, and seed memory.
- Evidence layer: structured Evidence Table rows with event metadata, affected layers, scope, branch coverage, interpretation, limitation, polarity, and confidence.
- Stage layer: Stage Gate rules run before scoring and produce `stage_snapshot`.
- Scoring layer: scores require evidence plus a matching Stage Classification; forged high-stage classifications are rejected.
- Parent/branch separation: parent dimensions use parent-scoped stage evidence; branch dimensions remain branch-scoped.
- Dashboard layer: cards include `why_not_higher_stage`, structured `key_events`, structured `key_branches`, `evidence_ids`, `score_id`, and `stage_snapshot`.
- Early Radar layer: old topics and branch mutations require a `reactivation_record_id`.
- Evaluation layer: failure cases are linked to monthly review results and corrective rules.
- Guardrail layer: generated outputs are schema-validated and tested for research-only behavior.
- Report layer: weekly briefs aggregate existing artifacts only; they do not reclassify, rescore, infer new evidence, or lift parent stages from branch evidence.
- Evidence import layer: manual drafts are validated, normalized, accepted or rejected, and audited before they can enter pipeline fixtures.
- Diff layer: current pipeline artifacts and previous snapshots are compared mechanically; display stage and Stage Gate stage remain distinct, and the layer cannot classify, score, infer evidence, or lift a parent from branch evidence.
- Report integration: weekly brief stage changes are a projection of canonical diff output. The report does not run stage comparisons itself.
- Historical review layer: operator reviews aggregate immutable run artifacts only and surface historical trends, repeated issues, guardrail regressions, consecutive `no_change` topics, and research-only next actions.
- Pilot layer: live research ledgers compare existing artifacts with manual operator observations, require competing hypotheses and falsification triggers, allow unchanged topics, and restrict actions to `observe`, `wait`, `validate`, `review`, `monitor`, and `flag_risk`.
- Replay layer: historical time slices use `available_at` to prevent future-evidence leakage and calibrate Stage, Diff, Early Radar, missed-change, false-positive, and parent/branch behavior.
- Operator guide layer: non-developer docs explain evidence intake, weekly review, change inspection, outcome recording, replay, and troubleshooting.
- Intake layer: document and pasted-text workbench creates candidate Evidence Cards with source quotes, field explanations, uncertainty notes, review decisions, and provenance records before formal import.
- Intake calibration layer: review feedback, topic registries, unresolved queue, provisional topic audit, and shadow-only AI comparison measure candidate quality without changing stage logic.
- Interactive intake pilot layer: local browser workbench lets non-YAML users complete intake review and import while keeping all formal Evidence behind validator/import/weekly gates.
- UI design system layer: the Workbench uses a source-first four-step workflow, shared semantic tokens, accessible focus states, responsive desktop/mobile layouts, explicit action hierarchy, and mandatory visual QA rules documented in `docs/23_ui_design_system.md`.
- Narrative monitor layer: a read-only strategic landing view projects canonical artifacts into core-theme, parent/branch, queue, and governance views. It makes Data Confidence and `why_not_higher_stage` inspectable, but never creates a parallel Stage or Score engine.
- Quantitative theory layer: `/methodology` exposes a deterministic shadow framework for evidence quality, independent-source aggregation, confidence, readiness, Narrative Delta, Agent evaluation, cost, and circuit breakers. It remains diagnostic until Replay calibration and a reviewed rule-version migration; canonical Stage and Score artifacts are unchanged.
- Artifact contract layer: stable public artifacts carry `artifact_type`, `schema_version`, `producer_version`, `rule_version`, `run_id`, and `generated_at` metadata.
- Legacy service cleanup layer: `src/services` is now an inventoried compatibility surface; migrated rules live in Domain/Application/Infrastructure and remaining legacy-active services have documented target layers and reasons.

## Self-Iterating Knowledge Loop

The Agent now reads Registry, Narrative Memory, Evidence Table, canonical Diff, and advisory Learning Profile context. It can propose new Topics, Branches, reactivation, unresolved mappings, and Evidence Chain relations. These are written as pending proposal artifacts and surfaced in the Research Queue. They are not formal Evidence, active Topics, Stage changes, Scores, or rule changes until a researcher approves them through the existing validation and import flow. Golden-case fixtures are isolated from live/manual imported Evidence so operational activity cannot silently rewrite regression expectations.

## Controlled Autonomous Research Loop

The live loop is now a separate, auditable operational chain: source sync -> bounded candidate session -> Agent/Rule verification -> Topic audit -> policy decision -> formal Evidence -> deterministic Stage Gate -> score -> operational Diff/Weekly/Review. The authoritative live artifacts are `outputs/operator_runs/latest_run.json`, `latest_stage_snapshot.json`, `latest_stage_diff.json`, and `latest_weekly_brief.json`; Golden Case outputs remain test fixtures.

Only explicitly admitted manual imports and policy-approved automated evidence can enter the live Evidence Table. Old exploratory rows remain recoverable in `data/sample_evidence/manual_imported_evidence.yaml`, but are excluded from live state until a matching `data/audit/operational_evidence_admission.jsonl` entry exists. A legacy import audit alone is deliberately insufficient because earlier bulk jobs used the same format. This prevents historical feed experiments from producing a false lifecycle stage. `npm run autonomy:run -- --no-publish` writes a no-publication recomputation, and `npm run agent:run -- --kind manual --operation <operation> --force` performs one explicitly targeted source cycle.

The verified ClinicalTrials.gov runs created the provisional topic `provisional_innovative_drug_clinical_development` from five source-cited E3 official records. It is currently S2 with medium Data Confidence and remains provisional: it lacks a stable label, capital confirmation, and pricing adoption. The latest bounded run completed with `MiniMax-M3`, prompt `evidence-intake-agent-v0.7.1`, and five verified model candidates with no fallback. It does not inherit any high stage, and it is never a trading recommendation.

## Repository Contracts

The product core defines contracts for:

- `EvidenceRepository`
- `TopicRepository`
- `ArtifactRepository`
- `RunRepository`
- `HistoryRepository`
- `FailureCaseRepository`
- `ReviewRepository`
- `GoldenCaseRepository`

File-system implementations back the current local CLI. InMemory implementations support tests. PostgreSQL and database migrations are intentionally out of scope for v0.4.

Pilot I/O currently uses a file-system adapter for YAML inputs and JSON/Markdown artifacts. It remains outside database scope.

Replay I/O currently uses a file-system adapter for replay YAML inputs and JSON/Markdown artifacts. It remains outside database and automated-ingestion scope.

Intake I/O currently uses file-system adapters for local TXT, Markdown, DOCX, HTML, pasted text, and text-based PDF. OCR, automatic networking, and database storage are intentionally out of scope.

Topic Registry I/O currently uses file-system YAML registries for canonical topics, aliases, branches, provisional topics, and seed Narrative Memory. PostgreSQL and arbitrary/unreviewed registry merges remain out of scope. The v0.11 policy can activate a provisional Topic or watch Branch only through formal Evidence and independent-source thresholds.

Interactive Intake Pilot data lives under `data/intake/pilot_documents/` with a bounded 50-document corpus covering existing, alias, branch, reactivation, provisional, unresolved, duplicate, multi-evidence, and Chinese policy / traditional Chinese medicine planning cases.

## Legacy Service Migration

v0.4.1 moved the following implementation groups out of `src/services`:

- Evidence import validation rules -> Domain.
- Evidence import normalization -> Application.
- Evidence import YAML/schema/file/audit I/O -> Infrastructure.
- Evidence Table, Stage Classification, Scoring, Stage Diff, Dashboard Card guardrails, Memory/Reactivation, Early Radar, Failure Case, Evaluation, and Versioning rules -> Domain.
- Run context -> Infrastructure.

Remaining legacy-active services are tracked in `docs/legacy_service_inventory.json`, with categories and migration targets. Compatibility wrappers remain under `src/services` for existing imports.

## Golden Case Results

- BCI: parent narrative remains `S4`; medical rehabilitation branch is tracked separately as `S5-S6`; branch validation cannot upgrade the parent.
- Humanoid robotics: dashboard baseline remains `S5-S6`; stage evidence supports S6 validation but S7 requires durability and friction monitoring.
- Innovative drug License-out: dashboard baseline remains `S5-S6`; deal-quality evidence supports pricing/reality validation, while milestone and regulatory realization remain explicit limits.

## Current Limits

- Evidence sources include manual drafts and governed public-source synchronization. Only policy-qualified, provenance-complete candidates can be published unattended; all other source material is held.
- Outputs include canonical JSON artifacts and a local operator interface; there is no hosted multi-user deployment.
- Data Confidence is rule-based from fixture metadata and should be expanded with real source-quality scoring before production use.
- Historical review is artifact-based and does not yet include database queries or server-side filtering. Governed scheduled source synchronization is available locally.
- v0.4 rejects older unversioned public artifacts at schema boundaries unless an explicit migration is added.
- Some report, review, diff, and pipeline assembly code remains in inventoried legacy-active services pending the next cleanup slice.
- Pilot metrics such as stage-change precision and Early Radar follow-through are marked `insufficient_history` when the available run history cannot support calculation.
- The Pilot layer is not a UI, database, automated ingestion layer, source-quality model, or probability model.
- Replay fixtures are synthetic calibration cases. They validate rule behavior and time slicing, but they are not a substitute for the 4-6 week live pilot outcome review.
- Operator guides are Markdown docs, not an interactive product interface.
- Intake candidate extraction is heuristic/model-assisted and candidate-only. Formal publication requires schema, provenance, duplicate, Parent/Branch, and automatic-publication policy gates; a model response alone cannot import anything.
- AI Candidate Generator support is shadow-only. It provides alternative mappings for comparison and cannot import, create active topics, upgrade stages, or mutate rules.
- Real AI Shadow Validation can call a provider-neutral model adapter, but unconfigured, timed-out, or invalid model output falls back to rule-based candidates and is recorded in audit artifacts without persisting sensitive keys.
- The v0.5.7 local intake pilot corpus contains 50 bounded documents, including Chinese policy / traditional Chinese medicine planning examples. New TCM policy candidates remain provisional until human audit and Evidence Table support promote them.

## Smart Evidence Intake Agent

v0.6.0 adds the cross-industry foundation for the bounded intelligent assistant. `npm run intake:agent` uses an OpenAI-compatible provider when configured and otherwise falls back to the deterministic rule candidate. The universal Agent core produces source-quoted candidates with declared offsets, supported facts, separate interpretations, limitations, uncertainty notes, alternative Topic/Branch mappings, E0-E4 suggestions, model version, and prompt version. Runtime industry packs provide domain hints and forbidden inferences without forcing unknown topics or industries.

The Agent is not a Stage or Scoring agent. Its output is verified locally and written to `outputs/intake/latest_agent_candidates.json`, `latest_agent_verification.json`, `latest_agent_audit.json`, and `latest_agent_review.md`. It may reach the Evidence Table only through provenance, schema, duplicate, Parent/Branch, and automatic-publication policy gates. The model itself cannot import Evidence, activate topics, modify registries or rules, reclassify Stage, score, mutate history, or output trading advice. Invalid, unavailable, or unsafe model output falls back to rule-based candidates.

DeepSeek can be connected with `DEEPSEEK_API_KEY`; explicit `NARRATIVE_AGENT_*` variables override the DeepSeek defaults. Provider credentials are process-only and are excluded from audit content.

## Autonomous Narrative Discovery

v0.10.0 adds a dedicated graph-discovery pass to every Intake Agent run. It checks canonical Topics, aliases, Narrative Memory, source-grounded rule/model candidates, and near-duplicate labels before proposing an existing Branch, a new `watch` Branch, a provisional Topic, reactivation, or unresolved state. It can derive a Branch from a concrete application, mechanism, indication, user group, geography, value-chain link, product form, or scenario across industries; broad labels are deliberately rejected.

`outputs/intake/latest_narrative_discovery.json` and the idempotent `narrative_discovery_ledger.json` preserve source quotes, candidate/provenance IDs, independent document support, reasons, uncertainty, and guardrails. A new Topic remains provisional at S0; a new Branch remains watch-only. Before the existing Topic Resolver sees a discovered Branch, the candidate is rewritten to branch scope with `split_branch`, so it cannot contaminate parent Evidence or Stage. Discovery never classifies Stage, scores, imports Evidence, activates a Topic, mutates rules, or emits trading advice.

The v0.6.2 feedback loop preserves Agent-only independent facts as Evidence Cards. Human review corrections are aggregated into `outputs/intake/latest_learning_profile.json` and `.md`. The profile is advisory context for future candidate generation only; it cannot mutate rules, Topic Registry, Stage, Score, or import permission. The same loop is available in the Workbench through `生成学习记录`.

## Autonomous Narrative Operations

v0.11.0 completes autonomous accumulation without relaxing the Evidence-first
method. Every governed Agent loop can discover a Topic, Branch, or named asset,
register it in a non-active state, publish only policy-qualified formal
Evidence, and then apply a deterministic independent-source promotion rule.

- A provisional Topic needs two independent eligible parent-scope Evidence
  sources before activation.
- A watch Branch, including a named molecular asset such as `RC148`, needs two
  independent eligible branch-scope Evidence sources before activation.
- Conflicting, negative, weak, unresolved, duplicate, or insufficient material
  is held and remains visible for review.
- Promotion changes registry visibility only. Stage, Data Confidence, Score,
  Diff, and `why_not_higher_stage` are recomputed by existing deterministic
  rules from the Evidence Table.
- Every result is schema-validated and recorded under `outputs/autonomy/` and
  the append-only `data/audit/narrative_graph_promotion.jsonl` ledger.

The Agent dashboard now reports activated Topics, activated Branches/assets,
and automatic holds for each run. See `docs/33_autonomous_graph_promotion.md`.

## Governed Active Learning

v0.7.3 turns the feedback profile into a continuous, testable loop. Every completed Workbench review automatically creates an idempotent cumulative profile update, an active-learning priority queue, improvement proposals, promotion gates, and an immutable cycle artifact. High-impact Parent/Branch and E3/E4 cases receive priority review. Repeated corrections need at least three observations before Shadow testing, and promotion review requires at least 50 reviewed candidates plus citation, unsupported-claim, Parent/Branch, E3/E4, and no-trading-advice gates.

The Agent updates only through versioned advisory context. `eligible_for_human_review` is not automatic deployment: rules, Registry, Stage, Score, Evidence, and import permission remain human-controlled. See `docs/26_governed_active_learning.md`.

## Next Recommended Phase

Product roadmap:

1. Operate the v0.7 core-theme monitor through several weekly research cycles and calibrate its queue thresholds using human review data.
2. Run the v0.7.3 governed active-learning loop until it has at least 50 reviewed candidates and a stable held-out baseline.

### v0.7.5 Source Operations

The source layer now inventories the complete published World Monitor API surface from 35 OpenAPI services and distinguishes catalogued, sandbox, key-required, parameter-required, context-only, unsupported, and production-ready operations. Eight public upstream adapters can run without a World Monitor key. Live records are hashed, bounded, citation-checked, deduplicated, and sent to Intake as unresolved E1 candidates. Sandbox and derived outputs cannot enter Evidence. Topic Resolver, human review, the existing Evidence Import validator, Stage Gate, and scoring remain mandatory.

### v0.7.6 Governed Source Operations

Every source operation now declares its source class, terms state, license identifier, attribution requirement, redistribution boundary, sensitivity, raw-payload policy, retention period, freshness window, and automated-polling permission. Live synchronization requires `research_ready` status and fails closed otherwise. Raw payloads remain transient; only hashes, bounded citations, provenance, counts, and sanitized runtime status are persisted.

### v0.7.7 Source-Specific Normalization

Eight direct public operations now use versioned operation-specific normalizers. They remove container metadata, separate event time from availability, resolve event-level URLs, and produce bounded metrics, geography, structured source quotes, and readable summaries. CFTC and World Bank remain context-only. Every Intake candidate remains unresolved, E1, low-confidence, and `maintain` until formal human review.

### v0.7.8 Source Change Research Loop

The source layer now persists normalized Fact State and a Change Ledger. Only new or updated facts create Intake candidates; unchanged observations do not create duplicate work, and disappearance from current windowed feeds cannot become Evidence. Manual imports merge by Evidence ID, stale review submissions are rejected, Topic Audit/Import/Evidence/Weekly identifiers are retained, and the UI displays the correlated source-to-impact loop without mixing unrelated latest artifacts.

### v0.7.9 Source Materiality And Recovery

Revised source facts now receive an explainable materiality decision. Source-specific metric thresholds route meaningful revisions to human review while retaining below-threshold revisions in the audit ledger. NWS and GDACS categorical levels are normalized to deterministic ranks. Materiality remains a queueing rule only and cannot bypass Evidence validation or Stage Gate rules.

When Evidence is already imported but Weekly fails, a dedicated recovery use case reruns Weekly without importing Evidence again. Retry count, sanitized errors, causal IDs, and immutable Apply states are retained and shown in Intake.

### v0.7.10 Operator Navigation

The global information architecture now follows the operator workflow: Overview, Changes, Topics, Research Queue, and System, with `录入材料` as the persistent primary action. Candidate Evidence is grouped under Research Queue. Runs, Sources, Learning Governance, and Methodology are grouped under System with secondary navigation. Existing routes remain compatible.

### v0.7.11 Researcher Language Layer

Operator pages now use a presentation-only terminology layer. S0-S7 and E0-E4 retain their canonical codes but include readable meanings; resolver, scope, layer, confidence, source, and workflow states display in plain Chinese. Intermediate identifiers and model metadata remain available under collapsed technical details for audit and debugging. Domain models, artifact schemas, API payloads, Stage Gate behavior, and Parent/Branch separation are unchanged.

3. Add a PostgreSQL adapter only after the canonical artifact workflow and review cadence remain stable.
4. Consider automated ingestion only after source quality, provenance, pilot evaluation, and read-only review gates remain stable.
