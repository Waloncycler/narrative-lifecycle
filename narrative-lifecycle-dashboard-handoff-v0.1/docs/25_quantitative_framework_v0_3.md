# Quantitative Framework v0.3

## Purpose

This framework makes the research system mathematically explicit without replacing Stage Gates with a total score. All calculations are deterministic, Evidence-linked, scope-aware, and bounded to 0-100.

Version `quantitative-framework-v0.3.0-shadow` is diagnostic. It does not replace canonical score artifacts until Historical Replay calibration, held-out validation, rule-version review, and Golden Case acceptance are complete.

```text
Evidence Table
→ Evidence Quality
→ Layer Support
→ Stage Gate
→ Data Confidence cap
→ auxiliary Readiness / Delta / Agent metrics
```

`Stage First, Score Second.`  
`No Evidence Table, No Scoring.`

## 1. Evidence Quality

For evidence item `e`:

```text
q_e = 100 × w(E_e) × a(source_e) × c_e × 2^(-age_e / h)
```

- `w(E)`: E0=0, E1=0.15, E2=0.40, E3=0.70, E4=0.90.
- `a(source)`: configurable source-authority coefficient. Regulatory/policy sources default to 0.95; research 0.75; company 0.70; media 0.60; unknown/other 0.50; social 0.25.
- `c`: reviewed evidence confidence in `[0,1]`.
- `age`: days since `available_at`.
- `h`: recency half-life, initially 180 days and subject to Replay calibration.

This is an evidence-quality index, not truth probability.

## 2. Layer Support

For layer `l`, duplicate records from one source cannot accumulate. The strongest contribution from each independent source is aggregated:

```text
Q_l = 100 × [1 - product_s(1 - max(q_e,s)/100)]
```

Positive and negative evidence are aggregated separately:

```text
Net_l = max(0, Positive_l - Negative_l)
```

This noisy-OR form rewards independent confirmation while limiting duplicate-source inflation. Independence is approximated by normalized `source_name` until source-family metadata is available.

## 3. Data Confidence

```text
C = 0.25B + 0.25A + 0.20R + 0.15X + 0.15L
```

- `B`: unique-source breadth, `100 × (1 - exp(-n/3))`.
- `A`: mean source-authority score.
- `R`: mean recency score.
- `X`: positive/negative evidence coverage.
- `L`: coverage across perception, capital, pricing, reality, feedback, and friction.

Missing evidence is not negative evidence. It reduces `C` and may lower the maximum stage:

| Data Confidence | Maximum stage |
|---|---|
| `<35` | S3 |
| `35-49` | S4 |
| `50-64` | S5 |
| `>=65` | S6 |

## 4. Stage Gate

```text
S_final = min(S_requested, S_gate, S_confidence)
```

`S_gate` is sequential:

1. no stable label: maximum S2
2. no capital confirmation: maximum S3
3. no pricing adoption: maximum S4
4. no hard reality evidence: maximum S5
5. all gates present: maximum S6

Parent and Branch calculations use separate Evidence subsets. Branch support never enters the Parent gate unless a separately reviewed Parent Evidence item exists.

## 5. Transition Readiness

```text
R_t = 100 × G × (C/100) × (1 - F/100)
```

- `G`: weighted gate completion: label 0.20, capital 0.25, pricing 0.25, hard reality 0.30.
- `C`: Data Confidence.
- `F`: friction support.

`R_t` is an `uncalibrated readiness index`. It must not be described as transition probability until Historical Replay provides enough labeled transitions for calibration and out-of-sample validation.

## 6. Narrative Delta

Narrative Memory is mandatory:

```text
DeltaN = 0.20Q + 0.25GateDelta + 0.20M + 0.15BranchMutation + 0.10ExpectationReset + 0.10C
```

- `Q`: new evidence quality.
- `GateDelta`: effect on missing or completed gates.
- `M`: historical missing evidence filled.
- `BranchMutation`: strength of a new branch relative to the parent.
- `ExpectationReset`: change in prior expectations.
- `C`: Data Confidence.

Without a matching Narrative Memory record, output `insufficient_memory`; do not invent a delta score.

## 7. Agent Evaluation

```text
Quality =
  .35 CitationAccuracy
  + .20 FieldAccuracy
  + .20 ResolverAccuracy
  + .15 FactRecall
  + .10 (1 - UnsupportedClaimRate)
  - safety penalties

Optimization = .80 Quality + .20 Efficiency
```

Promotion remains human-reviewed and is blocked when:

- fewer than 50 reviewed samples exist
- citation accuracy is below 95%
- unsupported claims exceed 2%
- Parent/Branch errors exceed 1%
- E3/E4 overstatement exceeds 2%
- cost or latency exceeds configured limits

Promotion affects only candidate-generation routing. It cannot modify Stage rules, scoring rules, Topic Registry, Narrative Memory, or import permission.

## 8. Cost and Circuit Breakers

Provider pricing is configuration, never guessed:

```text
Cost = input_tokens × input_price_per_million / 1,000,000
     + output_tokens × output_price_per_million / 1,000,000
```

Trip the circuit breaker when any condition holds:

- cost per run exceeds budget
- three consecutive failures
- rolling error rate exceeds 20% with at least 10 observations
- traffic reaches five times baseline
- retry budget is exhausted

Fallback is the deterministic rule candidate. No retry loop may be unbounded.

## Calibration Plan

1. Freeze v0.3 coefficients.
2. Replay historical cases without future leakage.
3. Compare readiness bands with later stage transitions, missed changes, and false positives.
4. Measure calibration error and revise coefficients only through a reviewed rule-version change.
5. Validate on a held-out case set before adopting a new version.

Price movement is not an outcome label for narrative correctness.
