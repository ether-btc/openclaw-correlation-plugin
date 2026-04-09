---
name: correlation-memory
description: Correlation-aware memory search plugin for OpenClaw — automatically retrieves related decision contexts when you query memory. Zero external dependencies. Install as an OpenClaw plugin.
location: ~/.openclaw/extensions/correlation-memory
---

# Correlation Memory Plugin

**Correlation-aware memory search for OpenClaw** — automatically retrieves related contexts when you query memory.

## What It Does

When you search memory for topic X, this plugin also fetches related contexts Y and Z that consistently matter together — based on correlation rules you define.

Example: search for `"backup error"` → plugin also retrieves `"last backup time"`, `"recovery procedures"`, and `"similar errors"` — because those contexts are correlated by rule.

## Key Features

- **Decision-context retrieval** — surfacing related information before you ask for it
- **Word-boundary keyword matching** — no false positives from partial matches
- **Confidence scoring** — filter/sort by how reliable a correlation is
- **Multiple matching modes** — auto, strict, lenient
- **Result limiting** — `max_results` parameter prevents output bloat
- **mtime cache** — rules reloaded only when `correlation-rules.json` changes
- **LRU regex cache** — bounded at 500 entries, no memory leaks
- **Debug tool** — understand why a given context triggered specific correlations
- **Lifecycle states** — rules can be promoted/archived/disabled without deletion

## Security

- Zero external runtime dependencies
- Read-only local file operations (no network, no writes)
- No credential or environment variable access
- Workspace path resolved via OpenClaw SDK only

## Correlation Rules

Rules live in `memory/correlation-rules.json` in your workspace. Example:

```json
{
  "id": "cr-config-001",
  "trigger_context": "config-change",
  "trigger_keywords": ["config", "setting", "openclaw.json", "modify"],
  "must_also_fetch": ["backup-location", "rollback-instructions"],
  "relationship_type": "constrains",
  "confidence": 0.95,
  "lifecycle": { "state": "promoted" }
}
```

Active states: `promoted`, `active`, `testing`, `validated`, `proposal`

## Tools Provided

| Tool | Description |
|------|-------------|
| `correlation_search` | Enhanced memory search with automatic context correlation |
| `correlation_debug` | Debug tool — shows which rules matched and why |

## Installation

```bash
cd ~/.openclaw/extensions
git clone https://github.com/ether-btc/openclaw-correlation-plugin.git correlation-memory
cd correlation-memory && npm install

# Add to openclaw.json
openclaw plugins install correlation-memory
openclaw gateway restart
```

Requires OpenClaw >= 2026.1.26.

## See Also

- `README.md` — Full documentation with examples, configuration, architecture
- `correlation-rules.example.json` — Production-quality rule examples
- `docs/schema.md` — Full rule schema reference
- `.sanitization-audit.md` — Security audit results
- `tests/correlation.test.ts` — Unit tests
