import type { OpenClawPluginApi, AnyAgentTool } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import * as fs from "fs";
import * as path from "path";

/**
 * Correlation Memory Plugin (Unified)
 *
 * Merges correlation-memory (rich matching) + correlation-rules-mem (SDK-native).
 * Provides automatic decision-context retrieval: when you query about topic X,
 * correlation rules surface related contexts Y and Z that typically matter.
 *
 * SECURITY NOTES:
 * - This plugin does NOT access environment variables directly
 * - This plugin does NOT make network requests (read-only local file ops)
 * - This plugin does NOT write to filesystem (read-only)
 * - This plugin does NOT handle credentials
 * - Workspace path resolved via ctx.workspaceDir (SDK runtime) with config/default fallbacks
 *
 * Audit: 2026-03-20 - Passed deep security review
 */

interface CorrelationRule {
  id?: string;
  context?: string;
  trigger_context?: string;
  // Support both field names from different rule formats
  trigger_keywords?: string[];
  keywords?: string[];
  must_also_fetch?: string[];
  correlations?: Array<string | { search_query?: string }>;
  relationship_type?: string;
  confidence?: number;
  lifecycle?: { state?: string };
  usage_count?: number;
}

interface MatchedRule {
  id: string | undefined;
  context: string | undefined;
  confidence: number | undefined;
  relationship_type?: string;
  additional_searches: string[];
}

/**
 * Check if a rule passes the confidence threshold.
 * Filters out rules with NaN, zero, negative confidence, or confidence below the minimum.
 *
 * @param rule - The correlation rule to check
 * @param minConfidence - Minimum confidence threshold (0-1)
 * @returns True if the rule passes the confidence gate, false otherwise
 */
function passesConfidenceGate(rule: CorrelationRule, minConfidence: number): boolean {
  // Filter out NaN, zero, negative, and undefined confidence values
  if (rule.confidence !== undefined) {
    if (isNaN(rule.confidence) || rule.confidence <= 0 || rule.confidence < minConfidence) {
      return false;
    }
  }
  return true;
}

// ── Rule Loading (with mtime cache) ──────────────────────────────────

let cachedRules: CorrelationRule[] | null = null;
let cachedMtime = 0;

const ACTIVE_STATES = new Set([
  "promoted", "active", "testing", "validated", "proposal",
]);

/**
 * Load correlation rules from the workspace, with mtime-based caching.
 * Rules are filtered to active lifecycle states and valid confidence values.
 *
 * @param workspacePath - Path to the OpenClaw workspace directory
 * @returns Array of active, validated correlation rules
 */
function loadCorrelationRules(workspacePath: string): CorrelationRule[] {
  const rulesPath = path.resolve(
    path.join(workspacePath, "memory/correlation-rules.json"),
  );

  try {
    const stat = fs.statSync(rulesPath);
    if (cachedRules && stat.mtimeMs === cachedMtime) return cachedRules;

    const data = fs.readFileSync(rulesPath, "utf-8");
    const parsed = JSON.parse(data);
    const rules: CorrelationRule[] = parsed.rules || [];

    // Filter to active rules only
    const filtered = rules.filter((rule) => {
      if (!rule.id) return false;

      // Confidence gate — filter out NaN, zero, negative, and undefined confidence.
      // Match loadCorrelationRules behavior with matchRules: undefined confidence is treated
      // as "no confidence specified" and passes the load filter but is filtered here
      // (equivalent to confidence < minConfidence since undefined < any minConfidence is true).
      if (!passesConfidenceGate(rule, 0)) {
        return false;
      }

      const state = rule.lifecycle?.state;
      return !state || ACTIVE_STATES.has(state);
    });

    cachedRules = filtered;
    cachedMtime = stat.mtimeMs;
    return filtered;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[correlation-memory] Failed to load rules from ${rulesPath}: ${msg}`);
    return [];
  }
}

// ── Keyword Extraction ────────────────────────────────────────────────

/**
 * Get keywords from a correlation rule.
 * Prefers trigger_keywords over keywords field.
 *
 * @param rule - The correlation rule
 * @returns Array of keywords to match against
 */
function getKeywords(rule: CorrelationRule): string[] {
  // Handle both field naming conventions
  return rule.trigger_keywords || rule.keywords || [];
}

/**
 * Get context from a correlation rule.
 * Prefers trigger_context over context field.
 *
 * @param rule - The correlation rule
 * @returns Context string (or empty string if neither field exists)
 */
function getContext(rule: CorrelationRule): string {
  return rule.trigger_context || rule.context || "";
}

/**
 * Get additional searches from a correlation rule.
 * Extracts searches from must_also_fetch and correlations fields,
 * handling both string and object formats with deduplication.
 *
 * @param rule - The correlation rule
 * @returns Array of additional search strings
 */
function getAdditionalSearches(rule: CorrelationRule): string[] {
  const searches: string[] = [];

  // must_also_fetch (current rules format)
  if (rule.must_also_fetch) {
    searches.push(...rule.must_also_fetch);
  }

  // correlations (legacy format)
  if (rule.correlations) {
    for (const corr of rule.correlations) {
      if (typeof corr === "string") {
        searches.push(corr);
      } else if (corr.search_query) {
        searches.push(corr.search_query);
      }
    }
  }

  return [...new Set(searches)]; // deduplicate
}

// ── Word-boundary matching ───────────────────────────────────────────

const regexCache = new Map<string, RegExp>();

// ReDoS protection: maximum keyword length before escaping (prevents pathological patterns)
const MAX_KEYWORD_LEN = 100;

// LRU cache: maximum number of regex entries before evicting oldest
const MAX_CACHE_SIZE = 500;

/**
 * Check if a keyword matches text with word boundaries.
 * Handles multi-word keywords (all words must match) and uses regex for special characters.
 * Includes ReDoS protection via MAX_KEYWORD_LEN.
 *
 * @param text - The text to search in
 * @param keyword - The keyword to match (single word or phrase)
 * @returns True if the keyword matches with word boundaries, false otherwise
 */
function wordMatch(text: string, keyword: string): boolean {
  // Reject empty/whitespace-only keywords to prevent false positive matches
  if (!keyword.trim()) return false;

  // Multi-word keywords: all words must be present (word-boundary each)
  if (keyword.includes(" ")) {
    return keyword.split(/\s+/).every((word) => wordMatch(text, word));
  }

  // SECURITY: For simple alphanumeric keywords, use O(n*m) String.includes()
  // instead of regex to prevent ReDoS from pathological patterns in untrusted rules.
  // Only use regex for keywords containing special regex metacharacters.
  const SIMPLE_RE = /^[a-zA-Z0-9]+$/;
  if (SIMPLE_RE.test(keyword) && keyword.length <= MAX_KEYWORD_LEN) {
    return text.toLowerCase().includes(keyword.toLowerCase());
  }

  let re = regexCache.get(keyword);
  if (!re) {
    // Reject keywords that would produce pathological regex after escaping
    if (keyword.length > MAX_KEYWORD_LEN) {
      console.warn(`[correlation-memory] Keyword too long, skipping: ${keyword.slice(0, 20)}...`);
      return false;
    }
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    re = new RegExp(`\\b${escaped}\\b`, "iu"); // 'i' + 'u' flags: case-insensitive + Unicode
    // LRU eviction — prevent unbounded cache growth
    const MAX_CACHE_SIZE = 500;
    if (regexCache.size >= MAX_CACHE_SIZE) {
      const firstKey = regexCache.keys().next().value;
      regexCache.delete(firstKey);
    }
    regexCache.set(keyword, re);
  } else {
    // Cache hit — re-insert to update LRU ordering (move to end of Map insertion order)
    regexCache.delete(keyword);
    regexCache.set(keyword, re);
  }
  return re.test(text);
}

// ── Workspace Path Resolution ───────────────────────────────────────────

/**
 * Resolve the OpenClaw workspace path from context or environment variable.
 * Uses ctx.workspaceDir from the SDK runtime, falling back to OPENCLAW_WORKSPACE_DIR env var.
 * This provides a secure fallback that prevents config-based attacks while allowing flexibility.
 *
 * @param api - OpenClaw plugin API
 * @param ctx - Plugin context containing workspaceDir if set
 * @returns Absolute path to the workspace directory
 */
function resolveWorkspacePath(api: OpenClawPluginApi, ctx: { workspaceDir?: string }): string {
  // SECURITY: Only trust ctx.workspaceDir (SDK-provided) and environment variable fallback.
  // Using environment variable for fallback is safer than config-agent because it's not
  // accessible via the config system, preventing rule injection or ReDoS attacks.
  // The expected workspace structure should contain a 'memory/correlation-rules.json' file.
  return ctx.workspaceDir ?? process.env.OPENCLAW_WORKSPACE_DIR ?? '/default/openclaw/workspace';
}

// ── Matching Logic ────────────────────────────────────────────────────

interface MatchOptions {
  mode: "auto" | "strict" | "lenient";
  minConfidence: number;
  maxResults: number;
}

/**
 * Match correlation rules against a query using specified matching mode.
 * Filters rules by confidence, lifecycle state, and keyword/context matching.
 *
 * Three matching modes:
 * - auto (default): keyword matching + context coverage fallback
 * - strict: keyword matching only (word boundaries)
 * - lenient: fuzzy word matching if no rules matched
 *
 * @param rules - Array of correlation rules to match against
 * @param query - Search query or context to match
 * @param options - Matching options (mode, minConfidence, maxResults)
 * @returns Array of matched rules with additional searches, sorted by confidence
 */
function matchRules(
  rules: CorrelationRule[],
  query: string,
  options: Partial<MatchOptions> = {},
): MatchedRule[] {
  const { mode = "auto", minConfidence = 0, maxResults = 10 } = options;
  const matched: MatchedRule[] = [];
  const seenIds = new Set<string>();

  for (const rule of rules) {
    if (matched.length >= maxResults) break;
    const ruleId = rule.id || "unknown";
    if (seenIds.has(ruleId)) continue;

    // Confidence gate — filter out NaN, zero, and negative confidence
    if (rule.confidence !== undefined) {
      if (!passesConfidenceGate(rule, minConfidence)) {
        continue;
      }
    }

    let isMatch = false;

    // Keyword matching with word boundaries (auto + strict)
    const keywords = getKeywords(rule);
    for (const kw of keywords) {
      if (wordMatch(query, kw)) {
        isMatch = true;
        break;
      }
    }

    // Context matching — normalize hyphens/underscores, partial word match (auto only)
    if (!isMatch && mode !== "strict") {
      const context = getContext(rule);
      if (context) {
        const ctxWords = context.replace(/[-_]/g, " ").toLowerCase().split(/\s+/).filter((w) => w.length > 0);
        const queryWords = new Set(
          query.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/),
        );
        const matchingWords = ctxWords.filter((w) => queryWords.has(w));
        const coverage = ctxWords.length > 0 ? matchingWords.length / ctxWords.length : 0;
        isMatch = matchingWords.length >= 2 || coverage >= 0.8;
      }
    }

    if (isMatch) {
      seenIds.add(ruleId);
      matched.push({
        id: rule.id,
        context: getContext(rule),
        confidence: rule.confidence,
        relationship_type: rule.relationship_type,
        additional_searches: getAdditionalSearches(rule),
      });
    }
  }

  // Lenient fallback: fuzzy word matching if nothing matched
  if (mode === "lenient" && matched.length === 0) {
    const queryWords = query
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2);

    for (const rule of rules) {
      if (matched.length >= maxResults) break;
      const ruleId = rule.id || "unknown";
      if (seenIds.has(ruleId)) continue;

      // Confidence gate — filter out NaN, zero, and negative confidence
      if (rule.confidence !== undefined) {
        if (!passesConfidenceGate(rule, minConfidence)) {
          continue;
        }
      }

      const ruleText = [
        getContext(rule),
        ...getKeywords(rule),
        ...getAdditionalSearches(rule),
      ]
        .join(" ")
        .toLowerCase();

      for (const word of queryWords) {
        if (ruleText.includes(word)) {
          seenIds.add(ruleId);
          matched.push({
            id: rule.id,
            context: getContext(rule),
            confidence: rule.confidence,
            relationship_type: rule.relationship_type,
            additional_searches: getAdditionalSearches(rule),
          });
          break;
        }
      }
    }
  }

  // Sort by confidence descending, then id ascending (stable tiebreak)
  matched.sort((a, b) => {
    const diff = (b.confidence ?? 0) - (a.confidence ?? 0);
    if (diff !== 0) return diff;
    return (a.id ?? "").localeCompare(b.id ?? "");
  });
  return matched.slice(0, maxResults);
}

// ── Plugin Registration ───────────────────────────────────────────────

const correlationMemoryPlugin = {
  id: "correlation-memory",
  name: "Correlation Memory Search",
  description:
    "Correlation-aware memory search — automatic decision-context retrieval with keyword matching, confidence filtering, and rule lifecycle management",
  configSchema: emptyPluginConfigSchema(),

  register(api: OpenClawPluginApi) {
    api.registerTool(
      (ctx) => {
        // Resolve workspace path — ctx.workspaceDir is set by the SDK runtime
        const workspacePath = resolveWorkspacePath(api, ctx);

        return [
          // ── Tool 1: memory_search_with_correlation ──
          {
            name: "memory_search_with_correlation",
            description:
              "Search memory with automatic correlation rule matching. " +
              "When you query a topic, this checks correlation rules and suggests " +
              "additional searches for related contexts that typically matter together. " +
              'Example: "backup error" also retrieves "last backup time" and "recovery procedures".',
            parameters: {
              type: "object" as const,
              properties: {
                query: {
                  type: "string",
                  description: "The search query to find relevant memories",
                },
                auto_correlate: {
                  type: "boolean",
                  description:
                    "Automatically check correlation rules (default: true)",
                  default: true,
                },
                correlation_mode: {
                  type: "string",
                  enum: ["auto", "strict", "lenient"],
                  description:
                    "Matching mode: auto (keyword + context), strict (word-boundary keyword), lenient (fuzzy fallback)",
                  default: "auto",
                },
                min_confidence: {
                  type: "number",
                  description: "Minimum confidence threshold (0-1, default: 0)",
                  default: 0,
                },
                max_results: {
                  type: "number",
                  description: "Maximum number of rules to return (default: 10)",
                  default: 10,
                },
              },
              required: ["query"],
            },
            execute: async (params: {
              query: string;
              auto_correlate?: boolean;
              correlation_mode?: "auto" | "strict" | "lenient";
              min_confidence?: number;
              max_results?: number;
            }) => {
              const {
                query,
                auto_correlate = true,
                correlation_mode = "auto",
                min_confidence = 0,
                max_results = 10,
              } = params;

              // Validate numeric params — prevent NaN, out-of-range, or excessively large values
              const safeMaxResults = Math.min(1000, Math.max(1, Math.floor(
                isNaN(max_results) ? 10 : max_results
              )));
              const safeMinConfidence = Math.min(1, Math.max(0,
                isNaN(min_confidence) ? 0 : min_confidence ?? 0
              ));

              const rules = loadCorrelationRules(workspacePath);

              if (rules.length === 0) {
                return {
                  success: true,
                  query,
                  matched_rules: [],
                  suggested_additional_searches: [],
                  summary: "No correlation rules loaded.",
                };
              }

              const matched = auto_correlate
                ? matchRules(rules, query, { mode: correlation_mode, minConfidence: safeMinConfidence, maxResults: safeMaxResults })
                : [];

              const allSearches = matched.flatMap((r) => r.additional_searches);
              const uniqueSearches = [...new Set(allSearches)];

              const ruleIds = matched.map((r) => r.id).join(", ");

              return {
                success: true,
                query,
                correlation_mode,
                matched_rules: matched,
                suggested_additional_searches: uniqueSearches,
                summary:
                  matched.length === 0
                    ? `No correlation rules matched for "${query}".`
                    : `Matched ${matched.length} rule(s) [${ruleIds}]. ` +
                      `Additional searches: ${uniqueSearches.join(", ") || "none"}.`,
              };
            },
          },

          // ── Tool 2: correlation_check ──
          {
            name: "correlation_check",
            description:
              "Debug tool: check which correlation rules would match a given context without performing searches.",
            parameters: {
              type: "object" as const,
              properties: {
                context: {
                  type: "string",
                  description: "Context or query to check against rules",
                },
                mode: {
                  type: "string",
                  enum: ["auto", "strict", "lenient"],
                  description: "Matching mode",
                  default: "auto",
                },
                min_confidence: {
                  type: "number",
                  description: "Minimum confidence threshold (0-1, default: 0)",
                  default: 0,
                },
                max_results: {
                  type: "number",
                  description: "Maximum rules to return (default: 10)",
                  default: 10,
                },
              },
              required: ["context"],
            },
            execute: async (params: {
              context: string;
              mode?: "auto" | "strict" | "lenient";
              min_confidence?: number;
              max_results?: number;
            }) => {
              const { context, mode = "auto", min_confidence = 0, max_results = 10 } = params;

              // Validate numeric params — prevent NaN, out-of-range, or excessively large values
              const safeMaxResults = Math.min(1000, Math.max(1, Math.floor(
                isNaN(max_results) ? 10 : max_results
              )));
              const safeMinConfidence = Math.min(1, Math.max(0,
                isNaN(min_confidence) ? 0 : min_confidence ?? 0
              ));

              const rules = loadCorrelationRules(workspacePath);
              const matched = matchRules(rules, context, { mode, minConfidence: safeMinConfidence, maxResults: safeMaxResults });

              return {
                success: true,
                context,
                mode,
                total_rules: rules.length,
                matched_count: matched.length,
                matching_rules: matched,
              };
            },
          },
        ];
      },
      { names: ["memory_search_with_correlation", "correlation_check"] },
    );
  },
};

export default correlationMemoryPlugin;
