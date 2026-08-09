# Execution Plan

## Completed: v0.14 Review-First Evidence Publication

- Separate candidate discovery from formal Evidence publication.
- Keep default UI, CLI, scheduler and Agent execution review-only.
- Require explicit policy plus explicit command for controlled automatic publication.
- Surface held publication candidates and insufficient citations in the research workflow.
- Align open-source architecture and operator documentation with runtime behavior.

## In Progress: v0.15 Evidence Conversion Quality

1. Completed: add source-specific text extractors for priority official, filing, company and academic sites.
2. Completed: emit citation completeness and quote-integrity artifacts; retain claim support and Topic/Branch accuracy as `pending_human_review` until a reviewed corpus is linked.
3. Completed: route held publication work from the research queue to its Intake candidate without using internal IDs as primary UI text.
4. Completed: add policy-change audit records and `npm run policy:validate`.
5. Next: link explicit reviewer outcomes to retrieved-source artifacts so claim support and Topic/Branch metrics can move beyond `pending_human_review`.
6. Completed: allow a dated, rule-verified primary-source candidate to revalidate an unadmitted historical record with the same Evidence ID; retain operational duplicate protection and atomic import validation.

## Completed: Quantitative Methodology Contract

1. Replaced code-style UI formulas with accessible semantic notation.
2. Aligned the README and `docs/06_scoring_system_v0_2.md` with executable scoring, Stage Gate and Data Confidence rules.
3. Marked the early theory manuscript as historical material rather than a runtime or operator specification.
4. Added a cross-document and UI regression test for canonical formulas and research-only boundaries.

## Completed: Timeline Credibility Repair

1. Retired legacy scripts that wrote live stage snapshots or timeline artifacts directly.
2. Rebuilt the evolution timeline as a chronological replay of operationally admitted parent Evidence only.
3. Added provenance checks, branch exclusion, historical-backfill exclusion, explicit historical-gap states, and schema coverage.
4. Updated the topic view so it distinguishes verified changes from historical evidence gaps and shows eligible/excluded evidence counts.

## Next: Historical Evidence Verification

1. Completed: generate timeline-derived, parent-only recovery tasks with `npm run research:recover-history`.
2. Completed: hold direct-source candidates that lack a verified publication date before Evidence import.
3. Completed: automatically re-acquire a bounded batch of historic original sources, extract bounded quotes, require two distinct source hosts, and route exactly one verified primary package through the standard Agent, resolver, policy and Evidence import flow via `npm run history:reacquire` and `npm run operate`.
4. Next: measure timeline coverage by gate and source class after reviewed outcomes are linked.

## In Progress: Single-Entry Automated Operation

1. Completed: add `npm run operate` to run the governed research loop with publication explicitly requested.
2. Completed: restrict E1 automatic publication to dated, rule-verified original-source candidates; model-only E1 candidates remain held.
3. Next: convert citation-ready original-page retrieval packages into governed Intake sessions so authoritative web retrieval can enter the same automatic admission path.
4. Completed: citation-ready original-page packages now enrich matching direct-source candidates and append new review candidates into the active Intake session before model analysis.
5. Completed: load local `.env` provider configuration at application startup; DeepSeek and MiniMax both use the OpenAI-compatible Intake Agent contract.
6. Completed: add historical provenance recovery to the daily loop; single-source, landing-page and title-mismatched records remain held instead of being converted to Evidence.
7. Completed: preserve source publication dates from discovery through Intake and apply a 180-day daily-discovery freshness cap; older material is reserved for two-source historical recovery.

## Later

1. More governed data-source adapters and source health monitoring.
2. Removed: a third-party archive audit that could not create runnable connectors or evidence. The product now exposes only registered sources with a real connection state.
3. In progress: use `baseline:review` and named `baseline:admit` to reconcile historical parent evidence before expanding public Chinese-source connectors one source at a time.
2. Persistent database adapter after file-artifact contracts stabilize.
3. Read-only multi-user operator interface with authentication and audit retention.
