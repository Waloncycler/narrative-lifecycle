# Curated Research Packs

## Purpose

A research pack is a small, explicit source plan for one research question. It
solves a different problem from broad web discovery: the operator can preserve
known primary URLs, their intended Topic or Branch scope, and the question each
source is meant to help verify.

A pack is not a Topic, a Branch, an Evidence import, or a lifecycle decision.
Its proposed taxonomy is a review note only.

## Run

```bash
npm run research:pack -- --file data/research_packs/china_innovative_drugs_20260809.yaml
```

The command writes a bounded original-page package to:

```text
outputs/research/packs/latest_research_pack_retrieval.json
outputs/research/packs/latest_research_pack_retrieval.md
```

To append citation-ready pages to the existing Intake review session without
creating formal Evidence, use:

```bash
npm run research:pack -- --file data/research_packs/china_innovative_drugs_20260809.yaml --prepare-intake
```

This explicit option creates review candidates only. It does not auto-register
the proposed Topic or Branch taxonomy, import Evidence, run Weekly, or change
a Stage.

## Source Rules

- `official`, `company_primary`, and `academic` URLs may be fetched.
- `secondary`, `reference`, `community`, and `unknown` entries are retained as
  locating context and stay held until an original source is identified.
- A source must yield bounded, quoteable original text before it can become an
  Intake candidate.
- Source publication date, scope, source class, and quote offset are preserved.
- A branch URL remains in its branch scope. It cannot advance the parent.

## Chinese Source Handling

Chinese central and ministry domains use an article-body extractor. Citation
readiness accepts a dense Chinese factual paragraph with at least 60 Han
characters, while retaining the 120-character threshold for Latin-script
paragraphs. This avoids rejecting a complete Chinese regulator statistic just
because it is concise; it does not lower the Evidence Gate or validate the
claim semantically.

## Example Pack

`data/research_packs/china_innovative_drugs_20260809.yaml` demonstrates:

- existing scope: `创新药对外授权`;
- proposed scope: original innovation and domestic access;
- official regulator and payer material;
- company primary disclosures from Pfizer, AbbVie, and GSK;
- a secondary CCTV locator that is intentionally not auto-fetched.

The pack explicitly records that headline deal value is not realized revenue,
clinical success, or global commercialization evidence.
