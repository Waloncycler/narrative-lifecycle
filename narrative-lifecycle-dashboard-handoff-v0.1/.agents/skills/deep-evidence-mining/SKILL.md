---
name: deep-evidence-mining
description: Standardizes deep mining probe execution for high-priority regulatory, disclosure, academic, and clinical research leads to extract verifiable evidence with precise provenance.
---

# Deep Evidence Mining Probe Skill Specification

This skill defines the standardized protocol for executing deep-dive research probes against high-priority leads (e.g. SEC EDGAR filings, HKEX/SSE/SZSE exchange disclosures, ClinicalTrials.gov, PubMed/PMC, arXiv).

## 1. Input Requirements

Every deep mining probe invocation MUST accept the following structured payload:

* `lead_id`: Unique identifier of the research lead.
* `source_url`: Full target URL of the document or record.
* `source_class`: Authority tier (`official` | `company_primary` | `academic`).
* `topic_id`: Monitored topic ID or `null` if provisional.
* `branch_id`: Target branch ID or `null` if parent.
* `raw_content`: Fetched HTML, JSON, XML, or plain text body.

## 2. Deep Probe Execution Steps

1. **Chrome Removal & Structure Parsing**:
   - Strip navigation bars, footers, headers, cookie banners, and irrelevant scripts.
   - For structured endpoints (e.g. ClinicalTrials JSON, arXiv abstract, SEC EDGAR 10-K/8-K), extract section-level titles and readable text.
2. **Provenance & Sentence Alignment**:
   - Segment readable body text into atomic sentences using language-appropriate boundary punctuation (`。`, `！`, `？`, `；`, `.`, `!`, `?`).
   - Compute exact 0-based character offsets (`quote_start_offset`, `quote_end_offset`) within the raw document.
3. **Evidence Strength & Layer Mapping**:
   - `official` / `filing` / `regulator`: Ceiling `E3`~`E4`, primary layers `reality` / `pricing` / `capital`.
   - `academic` / `clinical`: Ceiling `E2`~`E3`, primary layers `reality` / `name`.
   - `company_primary`: Ceiling `E2`~`E3`, primary layers `capital` / `pricing`.

## 3. Strict Output JSON Schema

The probe MUST produce a JSON object satisfying `schemas/research_source_retrieval_report.schema.json` with:
- `evidence_eligibility`: `"context_only"`
- `next_action`: `"prepare_intake"` | `"hold"`
- Non-empty `excerpts` containing `quote`, `quote_start_offset`, `quote_end_offset`, and `location_label`.
