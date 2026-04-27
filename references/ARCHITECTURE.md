# Architecture

## Overview

The correlation plugin combines two prior approaches:
1. **SDK-native tool registration** (`correlation-rules-mem`) — proper OpenClaw plugin lifecycle
2. **Rich matching logic** (`correlation-memory`) — keyword matching, confidence filtering, lenient/strict modes

## Core Data Flow

```
memory_search_with_correlation(query)
  → load_rules()              [mtime-cached, LRU regex cache]
  → match_rules(query)
      → keyword_match(trigger_keywords[], query, mode)
      → confidence_filter(matched_rules, min_confidence)
  → fetch_correlated_contexts(matched_rules.must_also_fetch)
  → return enriched_results
```

## Matching Modes

| Mode | Behavior |
|------|----------|
| `auto` (default) | Keyword + context matching, word-boundary aware |
| `strict` | Exact keyword match only (word boundaries) |
| `lenient` | Fuzzy matching for broad queries |

## Caching Strategy

- **mtime cache**: Rules file is reloaded only when its modification time changes
- **LRU regex cache**: Bounded at 500 compiled regex entries — no memory leaks on long-running gateways

## Plugin Lifecycle

Tools are registered via OpenClaw SDK on plugin load. No manual registration required.

## Key Files

- `scripts/correlation-memory.ts` — Main plugin entry point, tool registration, correlation logic
- `correlation-rules.example.json` — Full rule schema with examples
