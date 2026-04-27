# Security

**Audit date:** March 20, 2026 — Passed deep security review.

## Threat Model

The plugin operates in a hostile environment (AI agent workspace). Threats considered:

| Threat | Mitigation |
|--------|------------|
| Supply chain attack | Zero external runtime dependencies |
| Credential theft | No env var access, no credential handling |
| File system write | Read-only operations only |
| Network exfiltration | No network calls whatsoever |
| Config injection | Rules parsed as typed JSON, validated schema |

## Security Properties

- ✅ **Zero external dependencies** — `index.ts` only imports `openclaw/plugin-sdk`
- ✅ **No network requests** — Read-only local file operations
- ✅ **No credential access** — Does not handle secrets or tokens
- ✅ **No environment variable harvesting** — Uses SDK config only
- ✅ **Read-only filesystem** — Cannot write to disk
- ✅ **No postinstall scripts** — `npm install` fetches peerDep (`openclaw`) + devDep (`vitest`) only

## What the Plugin Can Access

- **Read**: `correlation-rules.json` in workspace `memory/` directory
- **Read**: OpenClaw SDK config and workspace paths
- **Write**: Nothing — zero write operations
- **Network**: Zero — no HTTP, no DNS, no sockets

## What the Plugin Cannot Do

- Cannot read outside the OpenClaw workspace
- Cannot access environment variables or credentials
- Cannot make network requests
- Cannot write to the filesystem
- Cannot modify its own configuration remotely

## Audit Methodology

1. Static code analysis of `index.ts` — all imports and calls audited
2. Runtime behavior observation — no network syscalls detected
3. Filesystem audit — only reads to `memory/` directory confirmed
4. Dependency audit — `npm ls` confirmed zero external runtime deps
