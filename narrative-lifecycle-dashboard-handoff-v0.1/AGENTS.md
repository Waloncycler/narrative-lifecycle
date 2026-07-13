# AGENTS.md

## Project Mission

This repository implements the **Narrative Lifecycle Dashboard**: a research decision-support system for classifying market narratives into lifecycle stages, detecting early opportunities, tracking reality validation, and identifying failure or overcrowding risks.

This is **not** a trading system. It must not output direct buy/sell instructions, guaranteed returns, target prices, or automated execution advice.

## Core Theory

Every narrative is evaluated through:

- **Perception / 名**: attention, framing, label clarity, shared language.
- **Capital Confirmation / 资**: leader stocks, breadth, volume, capital persistence.
- **Pricing Adoption / 定价**: valuation reframing, financial translation, institutional modeling.
- **Reality Validation / 实**: orders, revenue, customers, regulatory approval, clinical data, product delivery, profit.
- **Feedback Momentum / 势**: whether perception, capital, and reality form a reinforcing loop.
- **Friction / 阻力**: execution friction and valuation friction.
- **Data Confidence / 数据置信度**: whether available evidence is broad, authoritative, recent, balanced, and layer-complete.

Lifecycle stages:

- **S0 Latent Signal**: information exists, but the market has not seen it.
- **S1 Attention**: the market sees it, but has not explained it.
- **S2 Narrative Hypothesis**: the market explains it, but the label is not stable.
- **S3 Labeling**: the label is stable, but capital has not fully tested it.
- **S4 Consensus Testing**: capital is testing it, but pricing adoption is not complete.
- **S5 Pricing Adoption**: the narrative is priced, but reality is not fully validated.
- **S6 Reality Validation**: reality starts validating the narrative, but system evolution is not complete.
- **S7A Mainstream**: sustained validation and long-term allocation.
- **S7B Exhaustion**: overcrowding, good-news fatigue, or reality below expectations.
- **S7C Mutation**: a mature narrative generates new branches with fresh lifecycle potential.

## Non-negotiable Rules

1. **Stage First, Score Second.** Determine lifecycle stage before interpreting scores.
2. **Evidence Table First.** No structured evidence, no scoring.
3. **No Direct LLM Scoring.** LLMs may extract, classify, and explain evidence, but must not bypass stage gates.
4. **No stable label, no stage above S2.**
5. **No capital confirmation, no stage above S3.**
6. **No pricing adoption, no stage above S4.**
7. **No hard reality evidence, no stage above S5.**
8. **Branch validation does not automatically upgrade parent narrative.**
9. **Old themes require Narrative Memory lookup before being treated as new topics.**
10. **Repeated old stories do not enter Early Radar unless they have material Narrative Delta.**
11. **Every score must include evidence, reasoning, and missing data.**
12. **Every Dashboard Card must include `why_not_higher_stage`.**
13. **Missing data lowers confidence; it is not negative evidence by itself.**
14. **All major outputs must be versioned and auditable.**
15. **The system must not output direct investment instructions.** Use: observe, research, track, wait for confirmation, validation tracking, risk alert.

## Golden Case Requirements

The implementation must reproduce these baseline judgments:

- **BCI / 脑机接口**: parent narrative S4; medical rehabilitation branch S5-S6; parent must not be classified as S6.
- **Humanoid robotics / 人形机器人**: S5-S6; S7A/S7C potential; S7B risk for crowded edge assets.
- **Innovative drug License-out / 创新药 License-out**: S5-S6; reality-first and pricing-adoption-driven; distinguish headline deal value from actual realization.

If a change breaks these baseline judgments, tests must fail.

## Implementation Principles

Prefer explicit rules and transparent reasoning over black-box scoring.

Use a modular monolith first. Keep interfaces replaceable:

- `EvidenceRepository`
- `RuleProvider`
- `LLMProvider`
- `ReportRenderer`
- `DataSourceConnector`

The system should support future migration from YAML/Markdown to SQLite/PostgreSQL and from simple rule tests to a web dashboard.
