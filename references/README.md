# OpenClaw Correlation Memory Plugin

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![OpenClaw Plugin](https://img.shields.io/badge/OpenClaw-Plugin-blue)](https://openclaw.dev)

**Correlation-aware memory search for OpenClaw** — automatically retrieves related contexts when you query memory, so decisions are made with full information.

When you search for `"backup error"`, normal memory search returns backup-related results. This plugin also fetches `"last backup time"`, `"recovery procedures"`, and `"similar errors"` — because those contexts consistently matter together.

Think of it as **decision-context retrieval**: "for X decisions, always also consider Y."

## Table of Contents

- [Quick Start](#quick-start)
- [Features](#features)
- [Correlation Rules](#correlation-rules)
- [Tools](#tools)
- [Configuration](#configuration)
- [Uninstallation](#uninstallation)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

## Quick Start

```bash
cd ~/.openclaw/extensions
git clone https://github.com/ether-btc/openclaw-correlation-plugin.git correlation-memory
cd correlation-memory
npm install
```

Add to `openclaw.json`:

```json
{
  "plugins": {
    "allow": ["correlation-memory"]
  }
}
```

```bash
openclaw gateway restart
```

Requires OpenClaw >= 2026.1.26.

## Features

- **Word-Boundary Matching** — Keyword matching with regex word boundaries prevents false positives
- **Confidence Filtering** — Filter and sort results by confidence threshold (0.0–1.0)
- **Multiple Matching Modes** — `auto` (default), `strict`, `lenient`
- **Result Limiting** — `max_results` parameter prevents output bloat
- **mtime Caching** — Rules cached, refreshed only when file changes
- **LRU Regex Cache** — Bounded at 500 entries, no memory leaks
- **Debug Tools** — Understand why correlations are made
- **Rule Lifecycle** — `proposal` → `testing` → `validated` → `promoted` → `retired`

## Correlation Rules

Rules live in `memory/correlation-rules.json` in your workspace. Example:

```json
{
  "rules": [
    {
      "id": "cr-config-001",
      "trigger_context": "config-change",
      "trigger_keywords": ["config", "setting", "openclaw.json", "modify"],
      "must_also_fetch": ["backup-location", "rollback-instructions"],
      "relationship_type": "constrains",
      "confidence": 0.95,
      "lifecycle": { "state": "validated" },
      "learned_from": "config-misconfiguration-leads-to-service-outage"
    }
  ]
}
```

See [references/RULES.md](references/RULES.md) for full schema and lifecycle guide.

## Tools

| Tool | Description |
|------|-------------|
| `memory_search_with_correlation` | Enhanced memory search with automatic context enrichment |
| `correlation_check` | Debug tool — shows which rules matched and why |

```bash
openclaw exec correlation_check --context "config change"
```

## Configuration

The plugin requires a `correlation-rules.json` file at `memory/correlation-rules.json` in your workspace.

See `correlation-rules.example.json` at repo root for production-quality rule examples.

## Uninstallation

### Via OpenClaw CLI (recommended)

```bash
openclaw plugins uninstall correlation-memory
openclaw gateway restart
```

### Via Uninstall Script

```bash
cd ~/.openclaw/extensions/correlation-memory
./scripts/uninstall.sh
```

Options: `--force` to skip confirmation. Set `OPENCLAW_CONFIG_PATH` env var to override config location.

## Documentation

- [references/README.md](references/README.md) — This file
- [references/ARCHITECTURE.md](references/ARCHITECTURE.md) — Technical architecture and design
- [references/RULES.md](references/RULES.md) — Full rule schema, lifecycle, examples
- [references/SECURITY.md](references/SECURITY.md) — Security audit results
- [references/TROUBLESHOOTING.md](references/TROUBLESHOOTING.md) — Deployment guide, failsafe checklist, debugging
- [references/LESSONS.md](references/LESSONS.md) — Development insights and UX lessons
- [references/PRODUCTION.md](references/PRODUCTION.md) — Live deployment guide, heartbeat integration, confidence tuning

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for details on reporting issues, suggesting enhancements, and code contributions.

### Quick Start

1. Fork the repository
2. Create a feature branch
3. Make changes + add tests
4. Submit a pull request

## License

MIT License — see [LICENSE](../LICENSE) file.

---

*Built by [Charon](https://github.com/ether-btc) — an OpenClaw agent.*
