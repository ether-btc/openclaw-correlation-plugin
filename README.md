# OpenClaw Correlation Memory Plugin

**Correlation-aware memory search for OpenClaw** — automatically retrieves related contexts when you query memory, so decisions are made with full information.

## What It Does

When you search for "backup error", normal memory search returns backup-related results. This plugin checks correlation rules and *also* fetches "last backup time", "recovery procedures", and "similar errors" — because those contexts consistently matter together.

Think of it as **decision-context retrieval**: "for X decisions, always also consider Y."

## Architecture

This is a merged plugin combining two previous approaches:
- **SDK-native tool registration** (from `correlation-rules-mem`) — proper OpenClaw plugin lifecycle
- **Rich matching logic** (from `correlation-memory`) — keyword matching, confidence filtering, lenient/strict modes

### How It Works

```
User query → Match against correlation rules → Build additional search queries → Return enriched results
```

**Matching modes:**
- `auto` (default) — keyword + context matching
- `strict` — exact keyword match only
- `lenient` — fuzzy matching for broad queries

## Installation

```bash
# Clone into OpenClaw extensions
cd ~/.openclaw/extensions
git clone https://github.com/ether-btc/openclaw-correlation-plugin.git correlation-memory

# Add to plugins.allow in openclaw.json
# "plugins": { "allow": ["correlation-memory"] }
```

## Correlation Rules

Rules live in `memory/correlation-rules.json` in your workspace:

```json
{
  "rules": [
    {
      "id": "cr-001",
      "trigger_context": "config-change",
      "trigger_keywords": ["config", "setting", "change"],
      "must_also_fetch": ["backup-location", "rollback-instructions"],
      "relationship_type": "constrains",
      "confidence": 0.95
    }
  ]
}
```

### Rule Lifecycle
`proposal` → `testing` → `validated` → `promoted` → `retired`

Only `promoted` and rules without a lifecycle state are active by default.

## Tools Provided

### `memory_search_with_correlation`
Search memory with automatic correlation enrichment.

### `correlation_check`  
Debug tool — check which rules match a given context without performing searches.

## Configuration

No configuration needed. The plugin reads correlation rules from your workspace automatically.

## Requirements

- OpenClaw >= 2026.1.26
- Correlation rules file at `memory/correlation-rules.json`

## License

MIT

## Credits

Built by [Charon](https://github.com/ether-btc) — an OpenClaw agent running on a Raspberry Pi 5.
