# Intake Automation Product Brief

## Problem

Researchers currently see several technical actions before they can review one document. This increases cognitive load and makes it unclear which steps are required for a safe Evidence candidate.

## Outcome

A researcher can paste or select one document, run one visible automation path, inspect source-grounded candidate facts, make human decisions, and then use the existing Validate / Import / Weekly gate.

## Primary Flow

1. Paste text, drag a file, or choose a supported local file.
2. Select `智能解析材料`.
3. The system records completion of document parsing, rule candidates, AI Shadow comparison, Topic/Branch validation, and citation/safety validation.
4. The researcher reviews each candidate, chooses accept, modify, reject, split, or unresolved, then invokes the existing import gate.

## Success Measures

- Completion rate: a user reaches reviewable candidates without editing YAML.
- Review efficiency: median review time and candidate modification rate decline without increasing unsupported claims.
- Resolver quality: Topic/Branch accuracy and duplicate-prevention rate improve across human-reviewed sessions.
- Safety: zero unattended imports, Stage changes, Topic activation, rule mutation, or trading advice.

## Non-Goals

- No automatic import, Topic activation, Stage classification, scoring, registry mutation, or rule mutation.
- No claim that a candidate is correct merely because an AI provider produced it.
- No automated web ingestion, OCR, database, or trading workflow in this phase.

## Next Intelligence Slice

Implement citation-first, multilingual semantic resolution: retrieve canonical Topic, Alias, Branch, and Narrative Memory candidates; return ranked mappings and alternatives; require every proposed field to identify source text; leave low-confidence or mixed-document mappings unresolved.
