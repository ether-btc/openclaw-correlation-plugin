# OpenClaw Correlation Memory Plugin

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![OpenClaw Plugin](https://img.shields.io/badge/OpenClaw-Plugin-blue)](https://openclaw.dev)

**Correlation-aware memory search for OpenClaw** — automatically retrieves related contexts when you query memory, so decisions are made with full information.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [Correlation Rules](#correlation-rules)
- [Tools Provided](#tools-provided)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)
- [Credits](#credits)

## Overview

The OpenClaw Correlation Plugin enhances memory search capabilities by automatically retrieving related contexts when querying memory. Traditional memory search returns results directly related to the query terms, but often misses contextual information that is crucial for making informed decisions.

When you search for "backup error," normal memory search returns backup-related results. This plugin checks correlation rules and *also* fetches "last backup time," "recovery procedures," and "similar errors" — because those contexts consistently matter together.

Think of it as **decision-context retrieval**: "for X decisions, always also consider Y."

## Features

- **Automatic Context Retrieval**: Get related information without explicit requests
- **Configurable Correlation Rules**: Define domain-specific relationships
- **Confidence Scoring**: Weight correlations by certainty level
- **Multiple Matching Modes**: Auto, strict, and lenient matching options
- **Performance Optimized**: Caching and lazy evaluation for efficiency
- **Extensible Architecture**: Easy to add new correlation types
- **Debug Tools**: Understand why correlations are made
- **Rollback Support**: Safe deployment with easy rollback procedures

## Security

This plugin has been audited for security vulnerabilities:

- ✅ **Zero external dependencies** - No supply chain risk
- ✅ **No network requests** - Read-only local file operations
- ✅ **No credential access** - Does not handle secrets or tokens
- ✅ **No environment variable harvesting** - Uses SDK config only
- ✅ **Read-only filesystem operations** - Cannot write to disk

**Security Audit:** March 20, 2026 - Passed deep security review.

See: [OpenClaw Security Framework](https://docs.openclaw.ai/security)

## Installation

### Prerequisites

- OpenClaw >= 2026.1.26
- Node.js >= 18.x
- Git

### Steps

1. Clone into OpenClaw extensions:
   ```bash
   cd ~/.openclaw/extensions
   git clone https://github.com/ether-btc/openclaw-correlation-plugin.git correlation-memory
   ```

2. Install dependencies:
   ```bash
   cd ~/.openclaw/extensions/correlation-memory
   npm install
   ```

3. Add to plugins.allow in your `openclaw.json`:
   ```json
   {
     "plugins": {
       "allow": ["correlation-memory"]
     }
   }
   ```

4. Restart OpenClaw gateway:
   ```bash
   openclaw gateway restart
   ```

## Usage

### Basic Usage

Once installed, the correlation plugin automatically enhances memory searches. No additional steps are required for basic functionality.

### Manual Correlation Check

Use the debug tool to see which rules match a given context:

```bash
openclaw exec correlation_check --context "config change"
```

### Adjusting Sensitivity

Control correlation sensitivity through confidence thresholds in your rules.

## Configuration

The plugin requires a correlation rules file at `memory/correlation-rules.json` in your workspace.

### Example Configuration

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
    },
    {
      "id": "cr-002",
      "trigger_context": "error-handling",
      "trigger_keywords": ["error", "exception", "failure"],
      "must_also_fetch": ["similar-errors", "recovery-procedures", "contact-info"],
      "relationship_type": "supports",
      "confidence": 0.85
    }
  ]
}
```

## Correlation Rules

### Rule Structure

Each correlation rule consists of:

- **id**: Unique identifier for the rule
- **trigger_context**: Domain context where rule applies
- **trigger_keywords**: Keywords that activate the rule
- **must_also_fetch**: Related contexts to retrieve
- **relationship_type**: Type of relationship (constrains, supports, etc.)
- **confidence**: Confidence level (0.0 to 1.0)

### Rule Lifecycle

Rules follow a lifecycle for safe deployment:
`proposal` → `testing` → `validated` → `promoted` → `retired`

Only `promoted` rules and rules without a lifecycle state are active by default.

### Matching Modes

Three matching modes provide flexibility:
- `auto` (default) — keyword + context matching
- `strict` — exact keyword match only
- `lenient` — fuzzy matching for broad queries

## Tools Provided

### `memory_search_with_correlation`

Search memory with automatic correlation enrichment. This tool is automatically used when performing memory searches.

### `correlation_check`

Debug tool — check which rules match a given context without performing searches.

Parameters:
- `--context`: Context to check for matching rules
- `--keywords`: Additional keywords to consider
- `--mode`: Matching mode (auto, strict, lenient)

## Documentation

Comprehensive documentation is available in the docs directory:

- [Research Background](./docs/research.md) - Theoretical foundation and related work
- [Deployment Guide](./docs/deployment.md) - Installation, configuration, and troubleshooting
- [Lessons Learned](./docs/lessons.md) - Development insights and best practices
- [Contributing Guide](./CONTRIBUTING.md) - How to contribute to the project

## Contributing

Contributions are welcome! Please see our [Contributing Guide](./CONTRIBUTING.md) for details on:

- Reporting issues
- Suggesting enhancements
- Code contributions
- Contributing correlation rules
- Development guidelines

### Quick Start for Contributors

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Update documentation
6. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## Credits

### Original Development

Built by [Charon](https://github.com/ether-btc) — an OpenClaw agent running on a Raspberry Pi 5.

### Research Inspiration

- [Coolmanns Memory Architecture](https://github.com/coolmanns/openclaw-memory-architecture) — context-aware memory systems
- Cognitive science research on contextual decision making
- Information retrieval literature on query expansion

### Contributors

Thanks to all who have contributed to this project. See [CONTRIBUTING.md](./CONTRIBUTING.md) for details on how to contribute.

### Related Projects

- [OpenClaw](https://github.com/ether-btc/openclaw) - The AI agent platform
- Previous experimental implementations:
  - `correlation-rules-mem` - Plugin lifecycle focus
  - `correlation-memory` - Rich matching logic focus

---

*For more information about OpenClaw, visit [openclaw.dev](https://openclaw.dev)*