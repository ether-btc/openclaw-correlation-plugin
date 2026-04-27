# Production Guide

Live deployment experience, heartbeat integration, confidence tuning, and operational best practices.

## Heartbeat Integration

The correlation plugin shines when it surfaces context *proactively*, not just when you remember to ask. Recommended integration: your OpenClaw heartbeat loop.

### Pattern: Surfacing every N heartbeats

In your `HEARTBEAT.md`, add periodic correlation surfacing:

```bash
## Periodic Tasks

### Correlation Surfacing (every 5 heartbeats)
When working on a topic, check correlation rules to surface related contexts:
bash scripts/correlation-surfacing.sh "<current topic keywords>"
```

**Why every 5, not every 1?** Correlation surfacing fires a memory search per matched rule. Every heartbeat is too aggressive on busy systems. Every 5 gives regular enrichment without token burn.

### What to pass as context

Good context strings:
- `"config change"` — fires config-safety rules
- `"error 400 gateway"` — fires error-debugging + gateway rules
- `"plugin install"` — fires plugin-management rules

Bad context strings (too generic, fire too often):
- `"help"` — no rule should trigger
- `"status"` — too broad

## Tuning Confidence Thresholds

Getting this right is the difference between useful surfacing and noise.

| Confidence | When to use |
|-----------|-------------|
| `0.95–0.99` | Catastrophic cost if wrong — config changes, gateway restarts |
| `0.85–0.90` | High-value reliable patterns — backup ops, error debugging |
| `0.70–0.80` | Useful but some false-positive risk — session recovery, git ops |
| `< 0.70` | Exploratory/niche only |

**The mistake everyone makes:** Setting everything to `0.95` because "high confidence sounds better." This causes signal drowning — high-confidence rules dominate every search and lower ones never surface.

**Rule of thumb:** Only use `0.95+` where missing the correlation is *catastrophic*. Everything else `0.70–0.90`.

### Tuning Procedure

1. Deploy new rule as `proposal`, `confidence: 0.70`
2. Run heartbeat for a few days, watch how often it fires
3. If it fires on every unrelated query → lower confidence or narrow keywords
4. If it never fires when it should → widen keywords or raise confidence
5. When stable → move to `validated`

## Common Pitfalls

### Pitfall 1: Keywords that fire too often
`trigger_keywords: ["error"]` fires on almost every message.

**Fix:** Be specific — `["error", "400", "crash"]` require co-occurrence, or use distinct `trigger_context` values.

### Pitfall 2: Fetching non-existent contexts
`must_also_fetch: ["recovery-procedures"]` silently does nothing if that file doesn't exist.

**Fix:** Always verify every context in `must_also_fetch` exists in `memory/`.

### Pitfall 3: Overlapping rules
Rule A fires on `["config"]`, Rule B on `["change"]`. Both fire on `"config change"` → duplicate surfacing.

**Fix:** Search existing rules for keyword overlap before adding new ones. Use distinct `trigger_context` values.

### Pitfall 4: Confidence theft
Rule A (`0.99`) always fires, Rule B (`0.85`) would also be relevant but its results are buried.

**Fix:** If a `0.99` rule fires on every config operation, does it need to be that high? Reduce to `0.90`.

### Pitfall 5: No `learned_from`
Rules without `learned_from` are impossible to audit.

**Fix:** Every rule needs a `learned_from` that names the incident/pattern that prompted it.

## When NOT to Use Correlation Rules

1. **The relationship is 1:1, not N:M** — "when X happens, always do Y" is automation, not correlation. Write a script.
2. **The keyword is too common** — Words like `"help"`, `"check"`, `"status"` generate noise, not signal.
3. **The contexts don't exist** — Silent failure if referenced files don't exist.
4. **The pattern is genuinely one-off** — If it happened once and won't happen again, don't write a rule.
5. **You need exact precision** — Correlation is probabilistic. Use deterministic rules/scripts for guaranteed checks.

## Minimal Rule Checklist

Before deploying a new rule, verify:

- [ ] Keywords are specific enough not to fire on every message
- [ ] All `must_also_fetch` contexts exist in `memory/`
- [ ] `confidence` is appropriate (not everything needs `0.95`)
- [ ] `learned_from` describes why this rule exists
- [ ] `lifecycle.state` is set (default to `testing` for new rules)
- [ ] No existing rule has significant keyword overlap
