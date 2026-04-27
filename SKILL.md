---
name: correlation-memory
description: Correlation-aware memory search plugin for OpenClaw — automatically retrieves related decision contexts when you query memory. Zero external dependencies.
triggers:
  - memory search correlation
  - context-aware memory
  - correlation rules
---

# Correlation Memory Plugin

**Correlation-aware memory search for OpenClaw** — when you search memory for topic X, this plugin also fetches related contexts Y and Z that consistently matter together.

## Quick Start

```bash
cd ~/.openclaw/extensions
git clone https://github.com/ether-btc/openclaw-correlation-plugin.git correlation-memory
cd correlation-memory && npm install
# Add to openclaw.json: "plugins": { "allow": ["correlation-memory"] }
openclaw gateway restart
```

Requires OpenClaw >= 2026.1.26. Runtime: zero external dependencies.

## What It Does

Search for `"backup error"` → plugin also retrieves `"last backup time"`, `"recovery procedures"`, `"similar errors"` — because correlation rules define those as related.

## Key Features

- **Decision-context retrieval** — surfacing related information before you ask
- **Word-boundary keyword matching** — no false positives from partial matches
- **Confidence scoring** — filter/sort by reliability (0.0–1.0)
- **Three matching modes** — `auto` (default), `strict`, `lenient`
- **Result limiting** — `max_results` parameter prevents output bloat
- **mtime cache** — rules reloaded only when `correlation-rules.json` changes
- **LRU regex cache** — bounded at 500 entries, no memory leaks
- **Lifecycle states** — rules: `proposal` → `testing` → `validated` → `promoted` → `retired`

## Tools Provided

| Tool | Description |
|------|-------------|
| `memory_search_with_correlation` | Enhanced memory search with automatic context enrichment |
| `correlation_check` | Debug tool — shows which rules matched and why |

## Security

- Zero external **runtime** dependencies (`index.ts` only imports `openclaw/plugin-sdk`)
- Read-only local file operations (no network, no writes)
- No credential or environment variable access
- `npm install` fetches only `openclaw` (peerDep) + `vitest` (devDep, not bundled)

## See Also

- [references/README.md](references/README.md) — Full documentation, installation, configuration, usage
- [references/ARCHITECTURE.md](references/ARCHITECTURE.md) — Technical architecture, design decisions, matching modes
- [references/SECURITY.md](references/SECURITY.md) — Security audit results and hardening notes
- [references/TROUBLESHOOTING.md](references/TROUBLESHOOTING.md) — Deployment guide, failsafe checklist, debugging
- [references/LESSONS.md](references/LESSONS.md) — Development insights, subagent failure analysis, UX lessons
- [references/PRODUCTION.md](references/PRODUCTION.md) — Live deployment guide, heartbeat integration, confidence tuning
- [references/RULES.md](references/RULES.md) — Full rule schema, lifecycle states, examples
- `correlation-rules.example.json` — Production-quality rule examples at repo root
- `tests/correlation.test.ts` — Unit test suite (`npm test`)
