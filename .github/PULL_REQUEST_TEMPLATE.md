## Summary

<!-- What does this PR do? One paragraph. -->

## Type of Change

- [ ] Bug fix
- [ ] New data source adapter
- [ ] New feature (non-breaking)
- [ ] Breaking change
- [ ] Documentation update
- [ ] Tests only

## Layer(s) Changed

- [ ] Domain (rules, stage gate, scoring, evidence)
- [ ] Application (use cases)
- [ ] Infrastructure (file repos, adapters, YAML, schema)
- [ ] Interface (CLI, web UI)

## Testing

```bash
# Commands you ran to test this PR
npm run typecheck
npm test
```

## Safety Checklist

- [ ] No automatic Evidence import without human review
- [ ] No trading advice, buy/sell signals, or price targets
- [ ] No Stage/Score mutation without Evidence Table support
- [ ] No branch-to-parent automatic promotion
- [ ] No raw external payload stored (fingerprints/hashes only)
- [ ] API keys / secrets are in env vars, not hardcoded

## Related Issues

Closes #
