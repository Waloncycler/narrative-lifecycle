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

## Later

1. More governed data-source adapters and source health monitoring.
2. Persistent database adapter after file-artifact contracts stabilize.
3. Read-only multi-user operator interface with authentication and audit retention.
