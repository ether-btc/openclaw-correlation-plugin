# Correlation Rules

Rules live in `memory/correlation-rules.json` in your workspace.

## Full Schema

```json
{
  "rules": [
    {
      "id": "cr-001",                        // Unique identifier
      "created": "2026-03-25T00:00:00Z",    // ISO-8601 timestamp
      "trigger_context": "config-change",   // Semantic domain context
      "trigger_keywords": ["config", "setting", "openclaw.json", "modify"],
      "must_also_fetch": ["backup-location", "rollback-instructions"],
      "relationship_type": "constrains",
      "confidence": 0.95,                     // 0.0–1.0
      "lifecycle": { "state": "validated" },
      "learned_from": "config-misconfiguration-leads-to-service-outage",
      "usage_count": 11,                      // Diagnostics only
      "notes": "Any config change should trigger a backup check."
    }
  ]
}
```

## Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique rule identifier |
| `created` | ISO-8601 | Yes | When the rule was created |
| `trigger_context` | string | Yes | Semantic domain (e.g., `config-change`, `error-debugging`) |
| `trigger_keywords` | string[] | Yes | Keywords that activate this rule |
| `must_also_fetch` | string[] | Yes | Context paths to retrieve when rule fires |
| `relationship_type` | string | Yes | Relationship: `constrains`, `supports`, `diagnosed_by`, etc. |
| `confidence` | float | Yes | 0.0–1.0, how strongly to weight this correlation |
| `lifecycle.state` | string | No | Rule state (see below) |
| `learned_from` | string | Strongly recommended | Incident/pattern that prompted this rule |
| `usage_count` | integer | Auto | How many times the rule has fired |
| `notes` | string | No | Human-readable explanation |

## Lifecycle States

```
proposal → testing → validated → promoted → retired
```

| State | Meaning |
|-------|---------|
| `proposal` | New idea, lower confidence (0.60–0.75), testing-only by default |
| `testing` | Live, being evaluated — not auto-surfaced until validated |
| `validated` | Correctly firing, signal-to-noise acceptable — now active |
| `promoted` | Rock-solid, high confidence (0.90+), always available |
| `retired` | Obsolete — kept for history, not active |

Active states (rules that fire): `promoted`, `active`, `testing`, `validated`, `proposal`. `retired` rules are excluded.

## Confidence Guidelines

| Confidence | When to use | Example |
|-----------|-------------|---------|
| `0.95–0.99` | Catastrophic cost if wrong | Config changes, gateway restarts |
| `0.85–0.90` | High-value, reliable patterns | Backup ops, error debugging |
| `0.70–0.80` | Useful but some false-positive risk | Session recovery, git ops |
| `< 0.70` | Exploratory/niche only | Almost never needed |

> **Common mistake:** Setting everything to `0.95` causes signal drowning — high-confidence rules dominate every search.

## Lifecycle Workflow

1. Add rule as `proposal`, `confidence: 0.70`
2. After evaluation, move to `testing`
3. After noise is acceptable, move to `validated`
4. After 30+ firings with no issues, consider `promoted`

Don't rush to `promoted` — a premature `0.99` rule that fires inappropriately is hard to undo.

## Keyword Guidelines

- **Be specific**: `["error", "400", "crash"]` (require co-occurrence) not `["error"]` (too broad)
- **Avoid common words**: `"help"`, `"check"`, `"status"`, `"info"` fire on almost everything
- **Use `trigger_context`**: Separates semantic domains so the same keyword can mean different things
