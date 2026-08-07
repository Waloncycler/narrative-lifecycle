# 37 · Fully Autonomous Evidence Pipeline — Direction & Global Plan

> **Status:** Planning document only. **No code changes are made by this document.**
> It is a directional and architectural brief for the engineering models/agents
> that will implement the work. It references the *existing* components so the
> implementers extend the real system rather than rebuild it.
>
> **Author intent (verbatim):** a fully automatic *scrape → analyze → fill*
> pipeline; current information sources are still too few and must be expanded;
> this discussion is to be **documented, not coded** here.

---

## 1. Problem statement

Two observed defects, both confirmed against the live system on 2026-08-07:

1. **Evidence is too thin.** Most parent topics carry only 5–9 evidence rows,
   and a *single* row can be the sole trigger for a stage transition. A stage
   decision resting on one source is fragile and not defensible.
2. **Sources are too few / not flowing.** The system *catalogues* many sources
   but very little real evidence actually lands in the operational Evidence
   Table.

The goal is a **fully autonomous loop** that continuously scrapes a broad source
set, analyzes each item into structured Evidence, and fills topic/branch
timelines — with enough independent evidence per stage that transitions are
robust and *continuous* (S0→S1→S2→…, never skipping a stage).

---

## 2. Root-cause analysis (why it is thin today)

This is **not** primarily a missing-connectors problem. Findings:

- **The live keyless ingestion already works.** `AuthoritativeDirectSourceProvider`
  (`src/infrastructure/authoritative_direct_source_provider.ts`) wires 10 real,
  no-key public APIs: ClinicalTrials.gov, PubMed (eutils), Europe PMC, Crossref,
  OpenAlex, arXiv, GitHub, Hugging Face, SEC EDGAR full-text, Federal Register.
  A live reachability test returned real data (ClinicalTrials 200 / 33 KB).
- **The loop is run rarely and only pulls "leads".** `research:campaign` →
  `research:triage` → `research:retrieve` produce `context_only` leads under
  `outputs/research/`. By governance design these **cannot** become Evidence
  until they pass Topic Resolver → Narrative Memory → duplicate check → human
  review → Stage Gate → scoring (`README` §v0.13; `docs/35`).
- **Admission is manual and single-source.** Only IDs listed in
  `data/audit/operational_evidence_admission.jsonl` drive live stages. Nothing
  accumulates on its own, so timelines stay sparse.
- **The curated historical backfill was a stopgap.** `scripts/batch_historical_backfill.ts`
  seeds ~5–9 recall-based rows per topic tagged `event_type: historical_backfill`
  / `verification_status: unverified_operator_recall`. Useful scaffolding, wrong
  answer for "gather all obtainable information."

**Conclusion:** the levers are (a) *run the ingestion at scale and continuously*,
(b) *expand the source set*, and (c) *replace manual single-source admission with
a governed, tiered auto-admission* that still protects against garbage.

---

## 3. Target architecture — the autonomous scrape→analyze→fill loop

Extend the existing controlled loop (`docs/31`, `docs/33`) into a scheduled,
self-sustaining cycle. Seven stages:

```
(1) PLAN        research_coverage → per-topic/branch/stage evidence gaps
(2) SCRAPE      multi-source fan-out (see §4) → raw items + provenance
(3) NORMALIZE   source-specific parsers → canonical fact + event/available_at
(4) ANALYZE     structured Evidence Card: topic/branch, layer, strength, polarity
(5) DEDUP+RESOLVE  Topic Resolver + Narrative Memory + semantic dedup
(6) ADMIT       tiered policy (§6): auto-publish | hold-for-review | reject
(7) RECOMPUTE   Stage Gate → Score → Diff → Timeline → Snapshot (deterministic)
```

Key design rules (must survive automation):

- **Stage/Score stay deterministic.** The model may extract and suggest; it may
  never set a Stage, compute a Score, mutate rules, or upgrade a parent from a
  branch (`AGENTS.md`). Automation changes *how much evidence flows*, never *who
  decides the stage*.
- **Gap-driven, not volume-driven.** Stage (1) prioritizes the *missing* rungs.
  Today the timeline marks `interpolated` rungs (S0→S1, S4→S5, …) where no
  distinct evidence exists yet (`stage_evolution_reconstructor.ts`). The loop's
  explicit target is to **retire interpolated rungs** by finding real per-stage
  evidence — this is the concrete definition of "enough evidence."
- **Independent-source quota per stage.** A transition should require ≥2
  *publisher-independent* sources (see §5.4). Encode the quota in the coverage
  planner so the loop keeps pulling until the quota per active stage is met.

---

## 4. Source expansion plan (the "太少了" fix)

Today: source atlas = 43 authoritative entries + 10 direct APIs + web-search
providers. That is thin for a China-centric, cross-domain narrative system.
Expand along five axes. **Every new source needs a governed-use contract**
(source class, terms state, attribution, redistribution, freshness, polling
permission) exactly like the existing atlas entries (`docs/29`, `docs/35`).

### 4.1 Chinese regulators & statutory bodies (highest value, currently under-covered)
- CSRC, SSE/SZSE/BSE disclosure (`cninfo.com.cn` 巨潮资讯 — the canonical A-share
  filing hub), NMPA/CDE, CAAC, MIIT, NDRC, MOF, PBoC, SAMR, CNIPA, 工信部 device
  catalogues, 国务院/部委 policy releases, 国家统计局 data releases.
- Rationale: most topics here are China market narratives; primary filings and
  policy are the strongest (E4) parent-scope evidence and are mostly public.

### 4.2 Global filings & standards
- SEC EDGAR (have) + full-text 8-K/10-K item parsing; EU filings (ESMA), HKEX
  disclosure (`hkexnews.hk`), Japan EDINET; standards bodies (IEEE, 3GPP, SEMI,
  ISO/ASTM) for tech-maturity signals.

### 4.3 Scientific & technical primary sources (have partial)
- Have: PubMed, Europe PMC, Crossref, OpenAlex, arXiv, ClinicalTrials.gov.
- Add: bioRxiv/medRxiv, ChinaXiv, CNKI abstracts, patent offices (CNIPA,
  USPTO/PatentsView, EPO OPS, WIPO PATENTSCOPE), GitHub/Hugging Face release
  cadence (have) for AI-capability reality signals.

### 4.4 Market-structure & capital signals (for the 资/资本 layer)
- Exchange announcements, index inclusions, ETF flows, major financing rounds
  (Crunchbase-style where terms permit), block-trade/insider disclosure. These
  feed the capital-confirmation gate that is currently under-evidenced.

### 4.5 Curated news & industry with strict provenance
- Wire/official press rooms only for the `perception` layer; general news stays
  `context_only` and low strength, per existing policy. Never let a headline set
  a Stage.

> **Deliverable for implementers:** grow `data/source_atlas/authoritative_sources.yaml`
> and add matching normalizers in `authoritative_direct_source_provider.ts`
> (or a sibling provider). Each new source = one term-addressable adapter + one
> governed-use contract + fixtures for sandbox sync.

---

## 5. Analysis-method upgrades (make each row count for more)

These were found during the 2026-08-07 review and matter more once volume rises.
They are the "分析方法" optimizations. Each is a scoped task.

### 5.1 De-hardcode Data Confidence *(highest impact)*
`scoring_engine.ts` calls `calculateDataConfidence` with 3 of 5 inputs as
literals: `sourceAuthority: 65`, `sourceRecency: 60`, `positiveNegativeBalance:
55`. Data Confidence **caps the stage** (`capStageByDataConfidence`), so a topic
backed by weak, stale, one-sided sources currently scores the same as one backed
by fresh regulatory filings. Derive them:
- authority ← mix of `source_name` (official>academic>company) × `evidence_strength` (E1–E4).
- recency ← distribution of `event_date` vs `score_date`.
- balance ← actual `positive_or_negative` distribution.

### 5.2 Evidence-strength-weighted dimension scores
`scoreFromEvidence` (`src/rules/scoring_rules.ts`) uses a fixed `baseScore` per
dimension and ignores E1–E4 entirely (strength only affects the reported
`confidence`). An E4 regulatory approval and an E1 blog rumor in the same layer
produce identical dimension scores. Weight dimension scores by evidence strength
and count.

### 5.3 Use polarity (negative evidence) *(currently dead)*
`positive_or_negative` is written on 69% of rows but **read by nothing** in gates
or scoring. The system's own theory needs it: 阻力/friction, good-news fatigue,
and the S7B exhaustion branch all depend on negative evidence. Wire polarity into
(a) Data-Confidence balance and (b) a friction/S7B signal.

### 5.4 Independent-source count by *publisher*, not URL
`inferStageGateInput` counts unique `source_url` **or** title. Two different
pages from the same authority (e.g. two `miit.gov.cn` URLs) count as two
"independent" sources, and the S5/S6 gate depends on this count. Dedup by
registrable domain / publisher identity so "independent" means independent.
*Note:* tightening this may demote some topics S6→S5 — recalibrate and re-verify
golden cases.

### 5.5 Normalize the `name` layer *(data-drift bug)*
19 operational rows carry an `affected_layer` value of `name` (名) that is **not**
in the `EvidenceLayer` enum and is **not** recognized by the stable-label gate,
so naming/perception evidence is invisible to the S3 gate. Normalize `name` →
`perception` at the read boundary (and going forward in extraction).

---

## 6. Auto-fill & governance — how to automate responsibly

The author wants *auto-fill* (自动填补). The system deliberately holds evidence
for review. Reconcile with a **tiered trust ladder**, not by disabling review.

| Tier | Source class | Example | Auto action |
|------|--------------|---------|-------------|
| T1 | Provenance-complete primary/official | NMPA approval, SEC 8-K, CAAC cert, gov policy PDF | **Auto-publish** via the existing `rule_verified` path (`docs/31`) |
| T2 | Authoritative academic/standard w/ DOI | peer-reviewed paper, registered trial | Auto-publish at capped strength (≤E3), auto-admit to Evidence Table |
| T3 | Company-primary / IR | issuer press room, filing exhibit | Auto-publish branch-scope only; parent needs a second independent source |
| T4 | Curated news / web search | wire, index aggregator | Stays `context_only`; never auto-published |

Controls that must remain, even fully automated:
- **Two-independent-source rule** to activate a new Topic (parent) or Branch
  (`narrative_graph_promotion`, `docs/33`). Extend it to *stage transitions*,
  not just node activation.
- **Large-jump guard.** `topicsWithUnsafeStageJump` already holds big parent
  jumps for review — keep it; a fully-auto loop should still *hold* (not reject)
  anomalies.
- **Deterministic Stage/Score/Diff.** Unchanged.
- **Full audit.** Every auto-admission appends to
  `data/audit/operational_evidence_admission.jsonl` with source, policy tier,
  and independent-source IDs — so any auto-filled row is traceable and reversible.
- **Kill-switch & rollback.** A config flag to fall back to review-only, plus a
  rollback profile per run (mirror the active-learning rollback in `docs/26`).

This gives "全自动" while keeping the property that makes the system trustworthy:
**a Stage is always backed by real, independent, auditable evidence.**

---

## 7. Continuity as an acceptance criterion

The reconstructor now enforces a strict single-step ladder and flags
`interpolated` rungs. The autonomous loop should treat **every interpolated rung
on an active topic as an open evidence gap** and drive scraping until it is
retired with real per-stage evidence. Definition of done for a topic:
*continuous S0→…→current with zero interpolated rungs and ≥2 independent sources
per realized transition.*

---

## 8. Data-form / schema upgrades

- **Raise field completeness.** `event_summary` present on only 9% of rows;
  polarity/interpretation/limitation on ~69%. Make the analyzer populate them
  for every auto-generated card.
- **Add `source_publisher` / `registrable_domain`** to `EvidenceNode` to support
  §5.4 without re-parsing URLs downstream.
- **Add `verification_status`** as a first-class field (`unverified_recall` |
  `source_retrieved` | `primary_verified`) so backfill vs. real evidence is
  always distinguishable in the UI and can be filtered.
- **Persist per-transition `independent_source_ids`** in the timeline so the UI
  can show "backed by N independent sources" per rung.

---

## 9. Phased roadmap (for the implementing models)

- **P0 — Method correctness (no new data needed):** §5.5 name-layer, §5.4
  domain-dedup, §5.1 data-confidence. Re-verify golden cases + full test suite.
- **P1 — Source expansion:** §4.1 Chinese regulators first (cninfo, NMPA/CDE,
  CAAC, MIIT, gov.cn), then §4.3 patents. New adapters + governed-use contracts +
  sandbox fixtures.
- **P2 — Continuous auto-loop:** scheduler runs PLAN→…→RECOMPUTE; tiered
  auto-admission (§6) for T1/T2; gap-driven coverage targeting interpolated rungs.
- **P3 — Analysis depth:** §5.2 strength-weighted scoring, §5.3 polarity/S7B,
  §8 schema fields, UI surfacing of per-rung independent-source counts.

---

## 10. Acceptance metrics

- Median parent-scope evidence per active topic ≥ 20 (from ~5–9 today).
- 0 interpolated rungs on Tier-1/2-covered active topics.
- ≥2 publisher-independent sources per realized stage transition.
- Source atlas ≥ 80 governed entries; ≥ 20 Chinese primary/regulatory adapters live.
- 100% of auto-admitted rows carry provenance + audit + `verification_status`.
- Golden cases (BCI parent S4; humanoid S5–S6; drug S5–S6) still pass.

---

## 11. Risks & open questions

- **Terms-of-use / rate limits / robots.** Each source needs its governed-use
  contract; respect polling permission and retain only hashes + bounded excerpts
  (existing policy, `docs/29`).
- **Auto-admission false positives.** Tiering + two-source + large-jump hold
  mitigate; a periodic human audit of a T1/T2 sample is recommended.
- **Chinese primary-source parsing** (PDF/scanned policy) is harder than JSON
  APIs — may need OCR; scope explicitly.
- **Calibration drift** when §5 lands — treat as a `rule_version` bump with
  golden-case gating (`docs/21`).

---

*This document is a plan. Implementation, code, and schema changes are delegated
to the engineering models per the author's instruction.*
