# Lessons Learned

## Technical Insights

### 1. Merging Approaches

The correlation plugin merged two prior approaches:
- `correlation-rules-mem` — proper plugin lifecycle integration
- `correlation-memory` — rich matching logic and confidence filtering

Key lesson: the best solution often emerges from synthesizing partial solutions rather than building from scratch.

### 2. Confidence Scoring Complexity

- Simple threshold-based approaches often fail in practice
- Context matters significantly in determining appropriate confidence levels
- User feedback is crucial for tuning confidence scores
- Different domains may require different confidence models

### 3. Matching Mode Trade-offs

- **Strict mode** — predictable results but may miss relevant correlations
- **Lenient mode** — captures more connections but increases false positives
- **Auto mode** — requires careful tuning to balance precision and recall

## Subagent Failure Analysis

### Root Causes
- Resource contention between multiple concurrent correlation searches
- Inadequate error handling in rule processing pipelines
- Timeout issues with complex rule evaluations
- Memory leaks in recursive correlation resolution

### Mitigation Strategies
- Implemented resource quotas for correlation processing
- Added comprehensive error boundaries and fallback mechanisms
- Introduced timeouts with graceful degradation
- Fixed memory leak patterns through better resource management

## User Experience Insights

### Transparency vs. Automation

Users appreciated enhanced results but wanted transparency about *why* correlations were made:
- Added debug tools to explain correlation decisions
- Providing visibility into matched rules
- Allowing users to adjust correlation sensitivity
- Enabling rule-level feedback mechanisms

### Over-correlation Problems

Initially too aggressive — led to:
- Information overload
- Reduced trust in suggestions
- Performance impacts
- Confusion about relevance

Learned to be more conservative and provide better controls.

### Feedback Loop Importance

- Users needed ways to indicate when correlations were helpful or misleading
- Rule authors required data on rule effectiveness
- System administrators needed monitoring of overall performance

## Architecture Lessons

### Plugin Design Patterns
- Separation of concern between rule definition and execution
- Clear interfaces between components
- Extensibility for future enhancements
- Backward compatibility considerations

### Configuration Management
- Enabled non-developers to contribute rules
- Allowed A/B testing of rule sets
- Facilitated version control of rule changes
- Supported different environments (dev/staging/prod)

## Additional: Memory System Fix (2026-03-18)

### ESM/CommonJS Incompatibility
- **Problem**: node-llama-cpp v3.x is ESM-only, OpenClaw gateway uses CommonJS
- **Error**: `ERR_REQUIRE_ASYNC_MODULE`
- **Fix**: Use local Ollama embeddings instead of remote APIs

### Provider Configuration Discovery
- Multiple ways to configure API keys (env, credentials dir, auth.json, config)
- Gateway restart required for config changes to take effect

### Correlation Rules in Production
- 20+ rules proved valuable for proactive context surfacing
- Lifecycle states help manage rule quality
- Usage tracking identifies effective vs unused rules
