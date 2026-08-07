# UI Design System

## Purpose

Narrative Lifecycle Dashboard is a research operating system. The landing view helps an operator monitor core narratives and decide what needs review; the intake view records evidence, reviews candidate facts, imports only after validation, and then returns to lifecycle changes. It is not a trading terminal, recommendation surface, or marketing page.

## Information Architecture

The global navigation is fixed to five researcher-facing destinations:

```text
总览 | 变化 | 主题 | 研究队列 | 系统                         + 录入材料
```

Do not add Evidence, Runs, Sources, Methodology, Governance, Agent, or Intake as additional peer navigation items.

1. **总览**: current changes, priorities, alerts, and freshness.
2. **变化**: persisted Stage, Evidence, Confidence, Why Not Higher, and Branch deltas.
3. **主题**: canonical Parent and Branch monitoring and topic detail.
4. **研究队列**: pending work, candidate Evidence, unresolved mapping, Early Radar, and guardrail review.
5. **系统**: run state, sources, learning governance, and methodology.
6. **录入材料**: a persistent primary action that opens the controlled Intake Workbench.

Existing deep links remain valid. `/inbox` belongs to Research Queue; `/runs`, `/sources`, `/governance`, and `/methodology` belong to System. These pages use local secondary navigation and must activate their parent global section.

## Researcher Language Rules

The default interface is written for a researcher, not for an artifact maintainer.

- The first reading layer answers: current state, change, reason, and next validation.
- Use `主题`, `细分分支`, `影响范围`, `数据可信度`, `智能解析建议`, and `本轮研究更新` in operator-facing copy.
- Pair lifecycle codes with meaning, for example `S5 · 现实验证` and `E3 · 官方行动或真实落地`.
- Translate resolver and layer enums in controls while preserving their raw values in form submissions.
- Run IDs, session IDs, candidate IDs, evidence IDs, model versions, prompt versions, and rule versions belong in a closed `技术详情` disclosure.
- Technical details remain selectable and auditable. Presentation may hide them by default but may not discard or alter them.
- Error messages state what the researcher should do; raw provider or validation errors appear only in technical details.
- Avoid mixed-language labels such as `Resolver`, `Scope`, `Affected Layer`, `Weekly run`, and `Pipeline retry` in the primary workflow.

Every intake screen follows this order:

1. **录入证据**: paste or upload source material.
2. **解析候选**: inspect quotes, provenance, facts, uncertainty, and Topic/Branch suggestions.
3. **审核导入**: accept, modify, reject, or split; then run the existing Validator and Import path.
4. **查看变化**: inspect weekly, diff, Stage, Data Confidence, and `why_not_higher_stage`.

Source text and exact citations are always visually primary. AI output is visibly marked as a candidate and shadow-only. Unresolved and provisional states remain actionable review states, never hidden warnings.

## Tokens

The Workbench uses a small explicit token set in `src/interface/interactive_intake_server.ts`:

- Ink: `#18232f`; muted text: `#627181`; line: `#d9e0e6`.
- Canvas: `#e9edf0`; surface: `#ffffff`; panel: `#f4f6f7`.
- Accent teal: `#176b63`; accent soft: `#e3f2ef`.
- Warning amber: `#9a5b00`; danger red: `#a43c32`; focus blue: `#1d75b9`.
- Radius: 8px for cards and 5px for controls. No oversized rounding.
- Shadows are subtle and reserved for repeated cards and impact summaries.

Do not add gradients, decorative blobs, one-hue palettes, negative letter-spacing, or viewport-scaled font sizes. Use stable grid tracks and `minmax(0, 1fr)` so text cannot resize surrounding controls.

## Operator Language

- Simplified Chinese is mandatory for navigation, headings, field labels, buttons, statuses, empty states, errors, methodology explanations, governance rules, and source-operation guidance.
- Never expose raw enum values, internal IDs, provider errors, or artifact keys as the primary explanation. Show a readable Chinese label and place the original value in a collapsed `技术详情` section when useful for audit or support.
- Preserve source quotations, document titles, proper nouns, model names, formulas, evidence IDs, schema values, and API payloads in their original form. The interface may explain them in Chinese but must not alter evidence text or persistence contracts.
- Unknown values must use a Chinese fallback such as `状态待确认` or `其他待审核事项`; they must not leak an English implementation token into the normal operator flow.

## Components

- **Top bar**: product identity plus persistent `研究模式 · 人工审核必需` status.
- **Global navigation**: no more than five peer destinations plus one visually distinct `录入材料` action. Use `aria-current="page"` and preserve the brand home link on mobile.
- **Section navigation**: Research Queue and System use a local tab row. Do not promote their child pages back into the global top bar.
- **Core monitor**: compact metrics, a scan-friendly theme table, explicit change labels, text-plus-color confidence, and a literal `为什么还不能更高` column.
- **Theme detail**: parent stage and branch rows use separate labels, then show evidence timeline and diff. A branch S5-S7 state must not visually imply a parent upgrade.
- **Research queue**: unresolved candidates, guardrail alerts, and Early Radar are triaged before any new evidence is imported.
- **Methodology view**: show calculation order, formula, inputs, interpretation limits, version, and calibration status. Never present an uncalibrated index as probability or a shadow metric as canonical.
- **Workflow stepper**: four numbered steps; current step uses accent color and a number marker.
- **Source pane**: upload/drop area, paste field, source text, chunk labels, and citation highlights.
- **Evidence Card**: one fact per card; quote first, resolver status second, editable evidence fields third, decision last.
- **Agent panel**: accent-tinted evidence panel showing provider, supported fact, quote, interpretation, limitation, validation, and the no-auto-import boundary.
- **Impact summary**: compact metrics for import status, Weekly run, Stage, Data Confidence, acceptance rate, and `why_not_higher_stage`.

Do not place a card inside another card. Use separators and text sections for comparisons such as Rule vs AI Shadow. Keep technical field names paired with Chinese guidance.

## Interaction Rules

- One primary action per region. Secondary actions use the soft accent style.
- Every button has a clear verb; unfamiliar icon-only controls need a tooltip. Current Workbench actions remain text-labelled for non-technical operators.
- All controls expose visible hover, keyboard focus, disabled, loading, success, and error states.
- Accept, modify, reject, and split must remain explicit. Unresolved and provisional candidates cannot silently become formal Evidence.
- AI may suggest but cannot import, create active topics, upgrade Stage, score, mutate registries, or change rules.
- Learning Profile may suggest review warnings and alternatives, but cannot automatically change rules, registries, Stage, Score, or import permission.
- Empty state explains what to do next. Impact stays `待导入` or `待评估` instead of inventing values.

## Accessibility and Responsive QA

- Target WCAG AA contrast and visible `:focus-visible` states.
- Never use color alone for stage, confidence, resolver, or guardrail status; pair color with text.
- Preserve readable line height for Chinese and English source material, including long URLs, abbreviations, and dense paragraphs.
- Desktop: stable two-pane source/review layout. Mobile: single-column flow at 720px and below, then full-width fields at 480px and below.
- Mobile global navigation must show all five destinations without hidden-scroll discovery. The `N` brand home link and `录入材料` action remain visible.
- Before release, verify desktop and mobile screenshots, keyboard traversal, long text, empty state, provider fallback, and no-trading-advice copy.

## Review Checklist

- [ ] Source quote and provenance are visible before interpretation.
- [ ] Four workflow steps remain understandable.
- [ ] Primary action is unambiguous.
- [ ] Global navigation contains exactly five destinations; Queue and System child pages use secondary navigation.
- [ ] Parent/Branch, unresolved/provisional, confidence, and guardrail states use text plus color.
- [ ] No nested cards, gradients, clipped text, or horizontal overflow.
- [ ] Desktop and mobile snapshots are checked.
- [ ] Operator controls and explanations are Chinese; original evidence remains unaltered.
- [ ] `npm test` and `npm run typecheck` pass.
