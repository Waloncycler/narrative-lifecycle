# 06 Quantitative Methodology Contract

## Authority and Boundary

This document describes the executable quantitative framework. The source of
truth is `src/features/scoring/domain/quantitative_framework.ts` together with
the Stage Gate and Data Confidence rules. The Methodology UI and operator
materials must describe the same executable rules. `README.md` remains the
project's complete theory and project narrative; it is not a runtime formula
specification and must not be simplified or rewritten to mirror this contract.

Scores are auxiliary research measurements. They never override the Evidence
Table, Stage Gate, Data Confidence cap, Parent/Branch isolation, or a missing
historical record.

```text
Evidence Table first.
Stage First, Score Second.
No Evidence Table, no scoring.
```

The system is research-only. It does not output trading actions, positions,
target prices, or forecasts of price movement.

## Current Stage

```text
S_current = min(S_requested, S_gate, S_confidence)
```

- `S_gate` is the maximum stage permitted by stable label, capital
  confirmation, pricing adoption, and hard reality evidence.
- `S_confidence` is the maximum stage permitted by data confidence.
- Parent and Branch calculations are separate. A Branch result cannot raise
  its Parent result.

## Auxiliary Measurements

| Measurement | Executable notation | Use |
|---|---|---|
| Evidence quality | `q_e = 100 * w(E) * a(source) * c * 2^(-age/h)` | Dated, source-weighted contribution of one Evidence item. `h = 180` days by default; E0 contributes zero. |
| Layer support | `Q_l = 100 * [1 - product_s(1 - max(q_e,s)/100)]` | Aggregates the strongest contribution per source, separately for positive and negative evidence. |
| Data confidence | `C = .25B + .25A + .20R + .15X + .15L` | Breadth, authority, recency, polarity coverage, and six-layer coverage. Missing coverage reduces confidence; it is not negative evidence. |
| Transition readiness | `R_t = 100 * G * (C/100) * (1 - F/100)` | An uncalibrated readiness index. It is not a transition probability. |
| Narrative delta | `Delta N = .20Q + .25G_delta + .20M + .15B_mu + .10E + .10C` | Material change versus Narrative Memory. Returns no numeric result when memory is insufficient. |
| Agent optimization | `O = .80Q + .20E` | Quality and efficiency evaluation. Hard blockers prohibit promotion; they are not a subtractive score term. |
| Model cost | `Cost = (T_in P_in + T_out P_out) / 10^6` | Cost accounting. Values come from configuration, never guessed in code. |

## Promotion and Circuit Breakers

Agent optimization can only enter reviewed promotion when the sample has at
least 50 reviewed items, citation accuracy is at least 95%, unsupported claims
are at most 2%, Parent/Branch error is at most 1%, E3/E4 overstatement is at
most 2%, and cost and latency remain within configured limits.

The system stops or falls back to rules when a run exceeds its cost budget,
fails three times consecutively, has a rolling error rate above 20% on at
least 10 samples, reaches five times baseline traffic, or exhausts retries.

## Calibration Status

Evidence quality, layer support, data confidence, and Stage Gates are
deterministic measurements. Transition readiness and Narrative Delta are
auxiliary indices. They remain explicitly uncalibrated until historical replay
and held-out evaluation support a versioned calibration change.
