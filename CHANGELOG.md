# CHANGELOG

## v0.13.5-baseline-completion-and-naming-governance

- Added a schema-validated baseline-completion plan for active parents with no formal parent Evidence and for unverified Topic/Branch market names.
- Made each research campaign generate this plan first, prioritize missing parent-evidence coverage, then automatically run lead triage and bounded original-page retrieval.
- Exposed the Chinese baseline and naming queue in the Agent interface while preserving all existing Stage, Evidence, registry, Parent/Branch, and research-only guardrails.

## v0.13.4-evidence-baseline-and-source-excerpts

- Distinguished an empty parent Evidence Table at S0 from an external-market early-stage claim; operator views now show a Chinese “阶段基准核验” status without changing any lifecycle result.
- Hardened market-facing branch labels so unresolved, copied, or generated identifiers render as a neutral naming-review placeholder rather than a false fine-grained branch.
- Added schema-validated bounded original-page retrieval through `npm run research:retrieve`, with ClinicalTrials structured records, arXiv abstracts, generic page-chrome removal, and Chinese Agent-page excerpts.
- Kept retrieved pages `context_only`: no retrieval can import Evidence, alter Stage/Score, activate a Topic/Branch, bypass human review, or let a branch raise its parent.

## v0.13.3-research-lead-triage

- Added a rule-based, schema-validated Research Lead Triage report that combines web and direct-source discovery artifacts into a transparent priority queue.
- Preserved Topic, Branch, and provisional-seed attribution; URL duplicates merge only inside the same governed scope, so branch observations cannot become parent evidence.
- Integrated triage into `npm run research:campaign`, added `npm run research:triage`, and exposed concise Chinese review counts and top items in the Agent interface.
- Kept every item `context_only`: the queue cannot import Evidence, activate Topics/Branches, modify lifecycle rules, change Stage/Score, or provide trading advice.

## v0.13.2-cross-border-company-and-regulatory-coverage

- Added a schema-validated registry of 30 curated China, Hong Kong, U.S., and global technology, advanced-manufacturing, energy, biopharma, and space-company verification targets. The registry maps official company/IR pages and disclosure channels to research Topics without assigning any lifecycle stage or recommendation.
- Expanded the authority atlas to 43 sources, including Shanghai and Hong Kong exchange disclosure bridges, SAMR, CAC, U.S. BIS, FTC, SEC EDGAR full-text search, and the Federal Register Documents API. Capability and connectivity remain separate.
- Added SEC EDGAR and Federal Register term-query adapters with a one-time transient-failure retry. A provider full-text hit is never enough on its own: general results must name the concept in the visible title, while compact SEC filing titles also require the linked U.S. company and a concept-bearing filing description. All results remain `context_only` review leads.
- Reserved a bounded share of external research queries for company official/IR domains while retaining Topic, Branch, and research-seed coverage. Company material keeps its originating scope and cannot auto-import, upgrade a parent, or bypass the Evidence Table and Stage Gate.
- Restored the Intake Agent's typed evidence-context, diff-context, publication-eligibility, evidence-chain, and latest-bundle contracts; added schema and regression tests for source verification, company binding, and no-advice handling.

## v0.13.1-curated-core-coverage-and-query-clarity

- Added an audited operator-curated core monitoring baseline: 17 formal monitored Topics, including 14 explicitly held at S0 with no inherited Evidence, Stage, Score, Branch status, or automatic name verification.
- Mapped curated core topics back to their research-universe source preferences and rotated S0 coverage while keeping established Topics on a recurring reserve.
- Hardened malformed model-candidate fallback so incomplete source, fact, or citation fields restore the deterministic review candidate; malformed agent-only output is discarded.
- Separated authoritative term-query metrics from WorldMonitor source sync in the operator interface and removed non-queryable static APIs from term-query run logs.

## v0.13.0-authoritative-source-mesh-and-research-universe

- Added a versioned authoritative-source atlas (36 sources) and cross-industry research universe (40 market-recognisable seeds) with explicit source governance and no false connectivity claims.
- Added source-aware campaign planning, schema-valid JSON/Markdown artifacts, `npm run research:campaign`, allowed-domain search routing, and Agent-loop integration ahead of legacy generic web queries.
- Added term-addressable direct-source research for ClinicalTrials.gov, PubMed, Europe PMC, Crossref, OpenAlex, arXiv, GitHub, and Hugging Face. It persists original URLs and bounded source metadata, then creates provenance-complete E1/low review candidates without auto-import or Stage impact.
- Separated web-search and direct-API budgets, reserved per-window coverage for research seeds, rotated seed selection every six hours, and round-robined source calls so existing Topics cannot starve new-topic discovery.
- Added future-date rejection and original-title concept matching before model review; API summaries remain context only and cannot create a candidate by themselves. Seed identity now persists into `provisional_*` S0 candidates instead of falling back to `unknown_topic`.
- Kept research seeds, provisional Topics, and watch Branches distinct from formal Topics and Evidence; search output remains context-only and cannot bypass Narrative Memory, resolver, Evidence Table, Stage Gate, Parent/Branch separation, deterministic scoring, or research-only guardrails.
- Added campaign, schema, source-domain, label-quality, and Agent-priority regression tests; the operator interface now displays coverage planning separately from external search configuration.

## v0.12.0-source-backed-naming-and-web-research

- Added source-backed Chinese market-name fields, English retrieval aliases, naming status, and source citations to canonical Topic/Branch registry contracts.
- Kept internally generated names explicitly unresolved and blocked their automatic graph activation until a cited Chinese market name is verified.
- Added provider-neutral web-research leads with Brave, Tavily, optional GDELT, and MCP HTTP Bridge adapters; all results remain `context_only` and cannot bypass Evidence, Stage Gate, Parent/Branch, or research-only boundaries.
- Added Agent-page external-search status/action, schema-valid research artifacts, CLI, dependency-safe fallback behavior, and regression coverage.
- Added an operator-reviewed BCI parent baseline through the existing import/admission path. The parent is now evidence-derived `S4`; medical rehabilitation remains a separate branch and no S5/S6 claim is made without parent-scope pricing/reality Evidence.

## v0.11.0-autonomous-narrative-operations

- Completed the controlled autonomous loop from source discovery through formal Evidence accumulation, independent-source graph promotion, operational Diff, Weekly Brief, and Review.
- Added a versioned Narrative Graph Promotion policy: provisional Topics require two independent parent-scope formal sources; watch Branches and source-named assets require two independent branch-scope formal sources.
- Added automatic, idempotent Topic/Branch registry activation, immutable promotion audit records, JSON/Markdown promotion artifacts, and Agent-run metrics for activation and holds.
- Added source-text discovery for named molecules and assets such as `RC148`; they accumulate as isolated Branches and cannot raise a parent Stage.
- Held insufficient, conflicting, negative, unresolved, weak, duplicate, or unsafe material automatically; preserved Evidence Table, Stage-first, parent/branch, Narrative Memory, deterministic scoring, and research-only guardrails.

## v0.10.0-autonomous-narrative-discovery

- Added a source-grounded, cross-industry Narrative Discovery Domain layer for autonomous Parent/Branch graph maintenance.
- Combined registry, aliases, Narrative Memory, rule/model mapping, label similarity, and generic-label rejection to create existing-branch, watch-branch, provisional-topic, reactivation, or unresolved outcomes.
- Added schema-valid discovery reports, an idempotent support ledger, and Intake Agent integration before Topic Resolver and the existing review queue.
- Preserved Parent/Branch isolation by rewriting discovered branch candidates to branch scope and `split_branch`; no discovery outcome can change a parent Stage, Score, active Topic status, rules, or trading boundary.
- Added English/Chinese, duplicate, provisional-topic, reactivation, schema, persistence, fallback, and application-chain tests plus isolated real-provider validation.

## v0.9.0-controlled-autonomous-research-loop

- Added a canonical operational research chain with immutable per-run manifest, snapshot, diff, weekly brief, and review artifacts under `outputs/operator_runs/`.
- Added controlled `rule_verified` publication for provenance-complete primary/official source facts while retaining deterministic Stage Gates and the Evidence Table boundary.
- Added deterministic source-topic anchoring and Agent field constraints so verified source mappings cannot be overwritten by incidental model language.
- Bound rule-verified model candidates to parser-owned quotations and offsets, and refined the no-trading check to allow only explicit non-advice disclaimers while retaining hard rejection for actionable language.
- Added explicit operational manual-evidence admission: legacy exploratory rows and prior bulk import audits are preserved but excluded from live Stage computation until re-imported through the current controlled flow.
- Added `npm run autonomy:run -- --no-publish` for safe no-change recomputation after an audit correction.
- Made exact duplicate imports idempotent, while changed content that reuses an Evidence ID remains rejected.
- Added operational evidence integrity, idempotent CLI, Stage boundary, and autonomous no-publication regression coverage.

## v0.8.0-self-iterating-knowledge-loop

- Added governed Topic Discovery Proposals for new topics, new branches, aliases, reactivation, and unresolved mappings.
- Added candidate Evidence Chain Entries with supports, contradicts, updates, duplicates, branch-only, and fills-gap relations.
- Added Registry, Narrative Memory, Evidence Table, and canonical Diff context to Agent requests.
- Added proposal and chain artifacts to the research queue without treating them as formal Evidence or active Topics.
- Enforced human review for formal import and changed Learning Profile, Learning Cycle, and evolution outputs to advisory-only guardrails.
- Isolated golden-case regression fixtures from live/manual imported Evidence and added self-iteration proposal tests.

## v0.7.12-chinese-operator-interface

- Standardized operator-facing navigation, status, methodology, governance, source, intake, error, and empty-state copy in Simplified Chinese.
- Replaced raw enum and identifier fallbacks with readable Chinese labels while retaining original values in collapsed technical details.
- Preserved source quotations, proper nouns, formulas, schema values, and API contracts without translation or semantic changes.
- Added regression coverage for the Chinese Intake, Methodology, and Governance interface.

## v0.7.11-researcher-language-layer

- Replaced implementation terminology in operator-facing pages with plain research language while preserving schema values and API contracts.
- Added readable explanations for S0-S7, E0-E4, topic resolution states, evidence layers, confidence, source states, and research-loop outcomes.
- Moved run, session, candidate, evidence, model, and rule identifiers into collapsed technical details.
- Reworked Intake labels around core topic, evidence strength, why it matters, what it cannot prove, and human review.

## v0.7.10-operator-navigation

- Reduced the global navigation from ten peer links to Overview, Changes, Topics, Research Queue, and System.
- Made `录入材料` the persistent primary action while preserving all existing deep-link routes.
- Moved candidate Evidence under Research Queue and Runs, Sources, Governance, and Methodology under System.
- Added Research Queue and System secondary navigation plus a new system overview.
- Added grouped active states, `aria-current`, and mobile navigation rules that preserve the brand home link.

## v0.7.9-source-materiality-and-recovery

- Added source-specific materiality policies, metric deltas, reasons, and audit counts for revised facts.
- Kept new facts reviewable while suppressing below-threshold revisions without deleting them from Fact State.
- Added explicit NWS severity, urgency, and certainty ranks plus GDACS alert-level metrics.
- Added a Weekly-only recovery use case for `imported_pipeline_failed`; recovery never imports Evidence again.
- Added immutable Apply result history, retry status, sanitized errors, and an Intake recovery action.
- Clarified in the operator UI that actionable changes are not formal Evidence and cannot directly change Stage.

## v0.7.8-source-change-research-loop

- Added persistent normalized Fact State and a new/updated/unchanged/not-observed Change Ledger.
- Queued only new or updated source facts; unchanged snapshots no longer create duplicate review work.
- Added conservative observation-window policy so feed disappearance never becomes Evidence or an automatic downgrade.
- Changed manual Evidence persistence to idempotent merge-by-ID instead of replacing prior imports.
- Linked Source Sync, Intake Session, Topic Audit, Import, accepted Evidence IDs, Weekly Run, and UI impact states.
- Rejected stale review submissions and stopped the Intake UI from combining unrelated latest artifacts.
- Persisted `imported_pipeline_failed` when import succeeds but Weekly fails.

## v0.7.7-source-specific-normalization

- Added operation-specific normalizers for USGS, NASA EONET, GDACS, NWS, WHO DON, US Treasury, CFTC, and World Bank.
- Separated event time from information availability, resolved event-level URLs, and extracted bounded metrics and locations.
- Replaced opaque or truncated JSON summaries with readable source facts and removed the false NWS metadata candidate.
- Added normalizer identity/version to the source inventory and separated eligible from selected candidate counts.
- Preserved unresolved E1/low/maintain candidates, Topic Resolver, human review, Stage Gate, Parent/Branch separation, and research-only boundaries.

## v0.7.6-governed-source-operations

- Added machine-readable source terms, attribution, sensitivity, freshness, retention, redistribution, and automated-polling policies.
- Made live selection fail closed unless a source is explicitly research-ready and approved for automated polling.
- Kept raw payloads transient: only hashes, bounded citations, provenance, counts, and sanitized status are persisted.
- Added governed source status to sync artifacts and the `/sources` operator view.
- Preserved human review, conservative E1 candidate ceilings, Topic Resolver, Parent/Branch separation, Stage Gate, and research-only boundaries.

## v0.7.4-truthful-operator-dashboard

- Added artifact-backed Overview, Changes, Topics, Evidence Inbox, Review Queue, Agent Runs, Sources, Methodology, Governance, and Intake routes.
- Added explicit provider, fallback, automatic-ingestion, run-label, artifact-freshness, and guardrail states; unavailable capabilities are shown as not configured.
- Reordered interactive intake so Agent and AI-shadow candidates are generated before the unified Topic Resolver pass.
- Added cross-artifact `session_id` guards for evaluation and learning, dynamic per-topic import impact, and a default `127.0.0.1` server binding.
- Preserved Evidence Table, Stage Gate, Parent/Branch separation, human review, immutable history, and research-only boundaries.

## v0.7.3-governed-active-learning

- Added automatic post-review Learning Profile updates and versioned active-learning cycles.
- Added information-prioritized review queues, repeated-correction proposals, frozen-baseline promotion gates, immutable history, and rollback profile references.
- Fixed Learning Profile accumulation and made repeated evaluation ingestion idempotent.
- Added `npm run intake:learning-cycle` and expanded `/governance` with learning status, blockers, and proposals.
- Added `docs/HANDOFF.md` with the current architecture, operations, artifact snapshot, validation baseline, provider status, risks, and successor checklist.
- Preserved human approval, Evidence Table, Stage Gate, Parent/Branch, Narrative Memory, no-auto-import, and research-only boundaries.

## v0.7.2-quantitative-theory-core

- Added a deterministic shadow quantitative framework for evidence quality, duplicate-resistant layer support, Data Confidence, transition readiness, Narrative Delta, Agent optimization, model cost, and circuit breakers.
- Added `/methodology` so the UI exposes the formulas, inputs, calibration state, and Stage-first computation order.
- Explicitly labeled Transition Readiness as uncalibrated rather than an empirical probability.
- Kept the new formulas diagnostic until Historical Replay calibration and held-out validation approve a future rule-version migration.
- Preserved Evidence Table, Stage Gate, Parent/Branch, Narrative Memory, human-review, and research-only boundaries.

## v0.7.1-intake-automation-flow

- Added a single `智能解析材料` path that chains document parsing, rule candidates, AI Shadow, Topic/Branch validation, and citation/safety validation before review.
- Moved repeat technical operations into an explicit advanced section and added visible automation progress/completion states.
- Added global monitor/queue/governance navigation to the Intake page and collapsed technical comparison details until the researcher requests them.
- Preserved human review, Validator/Import/Weekly gates, Parent/Branch separation, and all research-only restrictions.

## v0.7-core-narrative-monitoring-dashboard

- Made the local root route a read-only strategic monitor for core narratives, using canonical run, weekly, diff, review, unresolved-queue, and Learning Profile artifacts.
- Added theme detail, research queue, and governance routes while preserving the controlled Evidence Intake Workbench at `/intake`.
- Kept Stage Gate, Data Confidence, Parent/Branch separation, `why_not_higher_stage`, Narrative Memory boundaries, and research-only guardrails visible without adding any new classification or scoring path.
- Added monitor view-model and end-to-end route tests for parent/branch separation and the connected monitoring-to-intake workflow.

## v0.6.2-self-iterating-agent-feedback-loop

- Preserved multiple independent Agent facts as reviewable Evidence Cards instead of truncating output to the rule candidate count.
- Added versioned Intake Learning Profile artifacts from human review corrections, Topic/Branch changes, rejection patterns, splits, duplicates, and guardrail incidents.
- Added `npm run intake:learn` and Workbench learning-record action.
- Passed Learning Profile context into later Agent requests as advisory-only feedback.
- Explicitly prohibited automatic rule mutation, Stage changes, Topic activation, scoring changes, and unattended import.

## v0.6.1-ui-design-system

- Redesigned the Evidence Intake Workbench around a four-step research workflow, source-first hierarchy, clearer action priority, responsive two-pane/single-column layouts, and accessible focus states.
- Added mandatory UI rules, design tokens, component guidance, responsive QA requirements, and a review checklist in `docs/23_ui_design_system.md`.
- Preserved research-only, human-review, Evidence Table, Parent/Branch, and no-trading-advice boundaries.

## v0.6.0-cross-industry-evidence-intake-foundation

- Added a provider-neutral universal Agent contract for source-grounded fact extraction, citation preservation, fact/interpretation separation, uncertainty, and candidate-only output.
- Added runtime-loaded industry packs for medicine, semiconductors, robotics, energy, AI/software, and consumer research.
- Added conservative `matched`, `provisional`, and `unresolved` industry states; unknown industries cannot be force-mapped or inherit high stages.
- Kept Agent output behind human review, Evidence Table validation, Parent/Branch guardrails, Stage Gate, and research-only restrictions.
- Added a sub-1000-character system prompt contract and tests for English abbreviation-safe chunking and industry pack loading.

## v0.5.8-smart-evidence-intake-agent

- Added the first bounded Evidence Intake Agent with an OpenAI-compatible provider interface.
- Added source-quoted Agent Candidates that separate supported facts from interpretation and preserve limitation, uncertainty, alternative mappings, model version, and prompt version.
- Added local verification for schema shape, citation consistency, Parent/Branch scope, E0-E4 overstatement, and no-trading-advice language.
- Added deterministic fallback to rule-based candidates for missing credentials, provider failures, invalid output, and guardrail failures.
- Added `npm run intake:agent` and candidate, verification, audit, history, and Markdown review artifacts under `outputs/intake/`.
- Kept human review, existing Validator/Import/Weekly gates, Stage, Scoring, Topic Registry, Narrative Memory, and rules outside Agent write access.
- Added DeepSeek environment compatibility with `DEEPSEEK_API_KEY`, the OpenAI-compatible Chat Completions endpoint, and the current `deepseek-v4-flash` default.

## v0.1-handoff

- Added project constitution in `AGENTS.md`.
- Added S0-S7 lifecycle documentation.
- Added scoring system v0.2.
- Added evidence table design.
- Added Narrative Tree, Early Radar, Failure Case Library.
- Added Narrative Memory Bank and Reactivation Engine.
- Added architecture, migration, performance, evaluation, and operational workflow docs.
- Added JSON schemas and golden cases.

## v0.1-rule-based-mvp-scaffold

- Added rule-based domain models for evidence, scoring, narrative trees, reactivation, audit, and incremental update markers.
- Added explicit Stage Gate, evidence strength, data confidence, misclassification, scoring, and reactivation rules.
- Added service scaffolding for evidence validation, stage classification, scoring, dashboard cards, memory lookup, reactivation, early radar, failure cases, and versioning/audit.
- Replaced initial stub tests with rule-based coverage for golden cases, Stage Gates, Parent vs Branch separation, Data Confidence caps, scoring order, Narrative Memory/Reactivation, Early Radar, audit/versioning, failure cases, and asset quality.
- Expanded failure case calibration fixtures and sample evidence metadata.
- Updated dashboard card examples to include `why_not_higher_stage` and research-only actions.
- Tightened prompts so LLM work stays evidence-first and does not directly produce numeric scores.

## v0.1-executable-backend

- Added `npm run pipeline` for an executable rule-based backend run.
- Added pipeline artifacts under `outputs/` for dashboard cards, scores, golden results, Early Radar candidates, evaluation summary, and system summary.
- Added schema validation before writing generated dashboard, score, and Early Radar artifacts.
- Added CLI regression coverage for generated artifacts.
- Tightened scoring so parent dimensions use parent-scoped Stage Gate evidence and branch dimensions remain separate.

## v0.1-operator-report

- Added `npm run report` for operator-facing weekly narrative brief generation.
- Added weekly brief Markdown and JSON artifacts under `outputs/reports/`.
- Added `schemas/weekly_brief.schema.json` plus report schema validation and CLI regression tests.
- Preserved evidence IDs, `why_not_higher_stage`, parent vs branch separation, reactivation references, and research-only guardrails in generated reports.

## v0.2-manual-evidence-import

- Added manual evidence validation and import workflow.
- Added `npm run evidence:validate` and `npm run evidence:import`.
- Added evidence import schema, validation reports, normalized accepted imports, rejected import handling, and audit logging.
- Preserved parent vs branch scope separation and research-only guardrails before evidence enters the pipeline.

## v0.3-stage-diff

- Added previous-report stage diff workflow and `npm run diff`.
- Added stage snapshot history and report run history with schema validation.
- Added JSON and Markdown diff artifacts for stage, evidence, confidence, branch, Early Radar, and guardrail changes.
- Preserved evidence IDs, display-vs-gate stage distinction, parent-vs-branch separation, reactivation references, and research-only actions.
- Changed pipeline cleanup ownership so persisted history survives later pipeline runs.

## v0.3.1-run-history-report-integration

- Added unique run identity and injected clock support.
- Added immutable per-run artifacts and schema-valid run manifests.
- Prevented same-day stage snapshot and report overwrites.
- Added atomic snapshot, diff, report, and latest-pointer writes.
- Integrated canonical stage diff summaries into weekly briefs without duplicating diff logic.
- Added `npm run weekly` for the pipeline-diff-report operator workflow.
- Preserved evidence traceability, parent-vs-branch separation, research-only actions, and no-trading-advice guardrails.

## v0.3.2-historical-operator-review

- Added `npm run review` for historical operator review generation.
- Added operator review types, schema, loader, aggregator, Markdown renderer, CLI, and tests.
- Aggregates immutable run manifests, stage diffs, and weekly briefs without reclassifying, rescoring, inferring evidence, mutating history, or lifting parent narratives from branch changes.
- Reports review windows, run success/failure counts, stage and evidence trends, `why_not_higher_stage` changes, Data Confidence changes, branch mutations, Early Radar changes, guardrail regressions, repeated issues, consecutive `no_change` topics, high-priority alerts, and research-only next actions.
- Handles empty history as schema-valid `insufficient_history` output.

## v0.4-product-core-hardening

- Added layered architecture, repository contracts, versioned artifact contracts, in-memory test adapters, compatibility policy, and architectural boundary tests.
- Added Application use cases for evidence import, pipeline runs, canonical diff builds, weekly brief builds, operator review builds, and weekly orchestration.
- Added Infrastructure adapters for file-backed artifacts, runs, history, reviews, YAML loading, schema validation, atomic writing, and system clock access.
- Added shared artifact metadata fields to stable public artifacts: `artifact_type`, `schema_version`, `producer_version`, `rule_version`, `run_id`, and `generated_at`.
- Added schema compatibility documentation and explicit old-schema rejection coverage.
- Preserved CLI compatibility, parent-vs-branch separation, research-only actions, and no-trading-advice guardrails.

## v0.4.1-service-layer-cleanup

- Migrated legacy domain rules and infrastructure concerns out of `src/services`, added parity and dependency-boundary tests, preserved CLI and artifact compatibility, and reduced legacy coupling.
- Added `docs/22_legacy_service_migration.md` and `docs/legacy_service_inventory.json` to classify remaining service files as `domain_rule`, `application_orchestration`, `infrastructure_io`, `renderer`, or `deprecated`.
- Moved evidence import validation rules to Domain, evidence import normalization to Application, and evidence import YAML/schema/file/audit I/O to Infrastructure.
- Moved Evidence Table guards, Stage Classification, Scoring, Stage Diff, Dashboard Card guardrails, Memory/Reactivation, Early Radar, Failure Case rules, Evaluation calibration, and Versioning into Domain.
- Moved run context creation and environment mapping into Infrastructure.
- Left compatibility wrappers in `src/services` so existing imports and CLI behavior remain stable.
- Added service-layer parity tests, artifact semantic snapshot tests, legacy inventory tests, and stricter architecture boundary tests.

## v0.5-live-research-pilot

- Added a real-topic research pilot ledger for hypothesis updates, competing explanations, event intensity, tail structure, falsification tracking, operator agreement, and outcome evaluation.
- Added `npm run pilot:init` to seed manual pilot topic and operator-observation YAML files.
- Added `npm run pilot:review` to aggregate existing run, weekly brief, canonical diff, operator review, pilot topic, and operator-observation inputs.
- Added Pilot schemas, types, Domain rules, Application use cases, Infrastructure file adapter, Markdown renderer, CLI commands, and tests.
- Preserved the rule that Pilot records and evaluates only; it does not reclassify, rescore, infer evidence, produce precise probabilities, mutate historical artifacts, or lift parent narratives from branch mutations.
- Limited Pilot actions to research-only actions and preserved no-trading-advice guardrails.

## v0.5.1-historical-narrative-replay

- Added `available_at` to Evidence and manual evidence import so historical replay can run without future-evidence leakage.
- Added `npm run replay` for time-sliced historical narrative replay.
- Added replay types, schema, Domain rules, Application use case, Infrastructure adapter, Markdown renderer, CLI, fixtures, and tests.
- Added replay coverage for success, failure, S7B, S7C branch mutation, parent/branch separation, and long `no_change`.
- Replay reports stage paths, future evidence excluded, misclassification, lead time, missed changes, false positives, and calibration suggestions.
- Preserved the rule that replay does not use outcome, future evidence, price movement, or branch evidence to lift parent stage.

## v0.5.2-friendly-operator-guide

- Added `docs/QUICKSTART.md`, `docs/OPERATOR_GUIDE.md`, `docs/EVIDENCE_GUIDE.md`, `docs/REPLAY_GUIDE.md`, and `docs/TROUBLESHOOTING.md`.
- Reframed operator documentation around recording evidence, running weekly, inspecting changes, and recording outcomes.
- Added a complete example from new Evidence through weekly, review, and pilot outcome recording.

## v0.5.4-evidence-intake-workbench

- Added `npm run intake:prepare` and `npm run intake:apply`.
- Added RawDocument, DocumentChunk, EvidenceCandidate, ReviewDecision, and ProvenanceRecord types and schemas.
- Added transparent document parsing, chunking, candidate mapping, provenance capture, review decision handling, duplicate detection, and intake audit artifacts.
- Added a static left/right Evidence Intake Workbench HTML artifact with source highlights and Evidence Cards.
- Added support for TXT, Markdown, DOCX, HTML, pasted text, and text-based PDF; OCR, networking, database, and unattended import remain out of scope.
- Candidate evidence remains draft-only until a human review decision passes existing schema validation, Parent/Branch guardrails, duplicate detection, and Evidence Import.
- Successful intake apply runs weekly and exposes stage change summary while preserving no-trading-advice and branch-does-not-upgrade-parent boundaries.

## v0.5.5-intake-intelligence-calibration-and-narrative-resolver

- Added `npm run intake:evaluate` for Review Feedback metrics after human decisions.
- Added `npm run topic:validate` for Canonical Topic Registry, Alias Registry, Branch Registry, Provisional Topic, Narrative Memory, topic resolution audit, and unresolved queue checks.
- Added conservative Topic Resolver statuses: `existing_topic`, `alias_of`, `new_branch`, `reactivation`, `new_provisional_topic`, and `unresolved`.
- Added shadow-only AI Candidate Generator adapter and rule-vs-AI comparison output; AI suggestions cannot import evidence, create active topics, upgrade stages, or modify rules.
- Added intake evaluation and topic registry schemas, fixtures, domain tests, CLI tests, and schema validation coverage.
- Preserved existing Evidence Import, Weekly, Replay, Pilot, Parent/Branch separation, and no-trading-advice guardrails.

## v0.5.6-interactive-intake-pilot

- Added `npm run intake:workbench` for a local interactive Evidence Intake Workbench.
- Added drag/drop and paste entry points, source text highlighting, editable Evidence Cards, Topic resolution status controls, E0-E4/scope/layer editing, accept/modify/reject/split decisions, and one-click Validate / Import / Weekly.
- Added local interactive server endpoints for prepare, upload, topic validation, apply, evaluate, and latest state/impact.
- Added post-import impact display from weekly and diff artifacts while preserving research-only and no-trading-advice boundaries.
- Added a 24-document intake pilot corpus covering existing topics, aliases, new branches, reactivation, provisional topics, unresolved cases, duplicates, and multi-evidence documents.
- Added interactive server tests proving a user can complete paste-to-import without editing YAML and that unresolved/provisional candidates are blocked from import until audited.

## v0.5.7-real-ai-shadow-validation

- Added provider-neutral Real AI Shadow Validation with `npm run intake:ai-shadow` and `npm run intake:ai-evaluate`.
- Added AI-shadow audit and validation report schemas, outputs, Markdown renderers, CLI commands, and tests.
- Validates AI output against Evidence Candidate shape, source quote consistency, Parent/Branch scope, E0-E4 bounds, unsupported E3/E4 overstatement checks, and no-trading-advice guardrails before display.
- Added guarded fallback to rule-based candidates when the model provider is unconfigured, times out, fails, or returns invalid output.
- Preserves sensitive key safety by recording provider/model/prompt metadata and request/response fingerprints without persisting API keys.
- Expanded Workbench comparison fields for Topic, Branch, Scope, Strength, Affected Layer, fact splitting, and Limitation, with operator choices for rule, AI, merge, manual, or unresolved.
- Expanded the local intake pilot corpus from 24 to 50 documents, including Chinese policy / traditional Chinese medicine planning samples.
- Improved Chinese policy intake recognition so pasted State Council TCM planning text maps to a conservative `traditional_chinese_medicine_revival` provisional topic candidate instead of being treated as an unrecognized generic document.
- Preserved existing Validator, Import, Weekly, Replay, Pilot, Parent/Branch separation, research-only boundaries, and the rule that AI cannot import evidence, create active topics, upgrade stages, modify registries, or change rules.

## v0.7.5-source-operations-adapter

- Added `npm run sources:inventory` and `npm run sources:sync` for a truthful World Monitor source operations layer.
- Inventories 199 World Monitor OpenAPI operations across 35 services, plus eight direct public upstream adapters documented by the reference implementation.
- Added live no-key adapters for USGS, NASA EONET, GDACS, NWS, WHO Disease Outbreak News, US Treasury Fiscal Data, CFTC, and World Bank.
- Added schema-valid source inventory and sync report artifacts, payload hashing, bounded candidate generation, exact citation checks, duplicate payload suppression, runtime status, and Sources UI controls.
- Sandbox fixtures and derived forecasts remain context-only and cannot become Evidence.
- Live records enter Intake conservatively as `unknown_topic`, E1, low confidence, and `maintain`; Topic Resolver, human review, Evidence Import validation, Stage Gate, and scoring remain mandatory and ordered.
- Apply now requires a matching Topic Resolution Audit and blocks unresolved or provisional candidates before import.
