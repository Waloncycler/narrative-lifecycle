# Changelog

## Unreleased

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
