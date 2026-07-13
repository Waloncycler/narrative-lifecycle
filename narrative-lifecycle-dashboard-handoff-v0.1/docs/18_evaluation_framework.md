# 18 Evaluation Framework

## Purpose

The system must be evaluated with golden cases, failure cases, and monthly review results.

## Metrics

- Stage Accuracy
- Boundary Accuracy
- Branch Pollution Rate
- Reactivation Accuracy
- Early Radar False Positive Rate
- Data Confidence Calibration
- Manual Override Rate

## Golden Case Tests

Implementation must reproduce baseline judgments for:

- BCI
- Humanoid Robotics
- Innovative Drug License-out

## Monthly Review

For each Early Radar candidate:

1. Did it upgrade stage?
2. Did it fail?
3. Was the failure signal visible?
4. Did the system over-score due to missing data?
5. Should rules or weights be updated?
