# Changelog

## Unreleased

- Removed the non-operational Tianji archive inventory from the product, CLI, and documentation. Only sources with a real, governed connector remain visible to operators.
- Added historical baseline evidence reconciliation and named `migration_baseline` admission. Legacy source labels are normalized only when they exactly match the current source-type enum; branch evidence remains excluded from parent baseline admission.
- Fixed controlled automatic revalidation: a provenance-complete primary-source candidate may replace an unadmitted historical row with the same Evidence ID, while operational duplicates and different-ID duplicates remain blocked.
- Verified the MiniMax OpenAI-compatible agent in a live governed run; automated publication now records immutable admission audit entries and preserves parent/branch separation.
- Added bounded historical provenance recovery: configured public/MCP search discovers possible original pages, deterministic extraction requires two independent citation-ready source hosts, and only one scoped primary package proceeds through the existing MiniMax, resolver, Schema and policy admission chain. Search snippets, single-source records and landing pages remain held.
- Preserved governed source publication dates from discovery through retrieval and Intake. Dated, citation-ready primary pages can now use the existing E1 policy path; ordinary daily discovery is capped at 180 days so historic material cannot masquerade as a new update.
- Added `npm run research:pack` for curated, scope-explicit original-source retrieval. The first China innovative-drugs pack retrieves official and company primary pages into review-only Intake candidates, while proposed taxonomy and secondary locators remain held.
- Improved Chinese authority-page extraction and citation readiness: dense 60-Han-character factual paragraphs are now eligible for review without weakening the Evidence Gate or any semantic validation.

## v0.15.1 - External Source Inventory

- Added `npm run sources:import-tianji` to inspect a supplied Tianji archive without executing its code or reading its `.env` files.
- Produces a schema-validated source inventory that maps already-governed sources to the existing Source Atlas and keeps all other discovered hosts in a review-required onboarding queue.
- Fixed the Evidence Candidate contract for temporal provenance, so dated original-source candidates can pass schema validation instead of stopping the research Campaign.
- Added local `.env` runtime loading and DeepSeek-compatible provider detection without logging or persisting credentials.
- Added citation-ready research-queue advancement: original-page excerpts enrich matching direct-source candidates or create separately governed Intake candidates before model analysis.

## Unreleased

### Quantitative methodology contract

- Replaced code-style formula strings in the Workbench with semantic mathematical notation for subscripts, superscripts and grouped cost terms.
- Corrected the Agent optimization display: hard blockers prohibit promotion instead of being subtracted from the optimization score.
- Rewrote the README and scoring documentation around the executable Evidence Table, Stage Gate and Data Confidence rules; archived theory material is now explicitly non-runtime.
- Added a regression test that keeps the Workbench, README and quantitative methodology contract aligned.

### Policy-controlled operator loop

- Added `npm run operate` as the daily single-entry research cycle.
- Added explicit `--publish-auto` propagation through the research agent loop.
- Enabled a narrow automatic publication policy for dated, rule-verified original-source E1 candidates only; model-only E1 candidates remain held.

### Timeline credibility repair

- Retired legacy scripts that directly overwrote live stage and timeline artifacts.
- Rebuilt timeline replay from operationally admitted, provenance-complete parent Evidence only.
- Replaced synthetic intermediate stages with explicit historical evidence gaps.
- Added chronology, provenance, branch-isolation, and legacy-writer regression tests.

### Historical evidence recovery and Intake discipline

- Added `npm run research:recover-history`, a schema-validated, read-only plan that derives high-quality historical-source tasks from timeline gaps.
- Routed all recovery work through original-source retrieval and the existing human-reviewed Intake workflow; no recovery task is formal Evidence.
- Made Agent candidates explicitly human-review-required and blocked direct-source candidates with unconfirmed publication dates from import.

### v0.15.0-evidence-conversion-quality (in progress)

- Added deterministic source-specific extraction profiles for Chinese government, SEC, Federal Register, PubMed/PMC, arXiv, ClinicalTrials and structured company releases.
- Added bounded retrieval quality artifacts for citation readiness, quote integrity and extractor coverage; semantic metrics remain explicitly pending human review.
- Removed implicit Intake auto-accept behavior: a missing operator decision now records `review_required` and cannot import Evidence or run weekly.
- Added held-candidate queue deep links and `npm run policy:validate` with versioned autonomous-publication policy audit artifacts.

### v0.14.0-review-first-evidence-publication

- Made `review_required` the default for Workbench, Agent, scheduler and autonomous CLI runs.
- Required both an explicit `--publish-auto` request and an enabled versioned policy for controlled Evidence publication.
- Prevented default runs from mutating the Evidence Table or activating Topic/Branch graph nodes.
- Added citation readiness to bounded original-source retrieval and surfaced held publication candidates in the research queue.
- Updated architecture, contribution and operator documentation for the Feature-Sliced codebase and publication contract.
