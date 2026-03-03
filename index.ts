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
 * No env var harvesting. No hardcoded paths. SDK-native registration.
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
  relationship_type: string | undefined;
  additional_searches: string[];
}

// ── Rule Loading ──────────────────────────────────────────────────────

function loadCorrelationRules(workspacePath: string): CorrelationRule[] {
  const rulesPath = path.join(workspacePath, "memory/correlation-rules.json");
  try {
    if (!fs.existsSync(rulesPath)) return [];
    const data = fs.readFileSync(rulesPath, "utf-8");
    const parsed = JSON.parse(data);
    const rules: CorrelationRule[] = parsed.rules || [];

    // Filter to active rules only
    return rules.filter((rule) => {
      if (!rule.id) return false;
      if (rule.confidence !== undefined && rule.confidence <= 0) return false;
      const state = rule.lifecycle?.state;
      // Active if: promoted, testing, validated, proposal, or no lifecycle state
      return !state || ["promoted", "testing", "validated", "proposal"].includes(state);
    });
  } catch {
    return [];
  }
}

// ── Keyword Extraction ────────────────────────────────────────────────

function getKeywords(rule: CorrelationRule): string[] {
  // Handle both field naming conventions
  return rule.trigger_keywords || rule.keywords || [];
}

function getContext(rule: CorrelationRule): string {
  return rule.trigger_context || rule.context || "";
}

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

// ── Matching Logic ────────────────────────────────────────────────────

function matchRules(
  rules: CorrelationRule[],
  query: string,
  mode: "auto" | "strict" | "lenient" = "auto",
): MatchedRule[] {
  const queryLower = query.toLowerCase();
  const matched: MatchedRule[] = [];
  const seenIds = new Set<string>();

  for (const rule of rules) {
    const ruleId = rule.id || "unknown";
    if (seenIds.has(ruleId)) continue;

    let isMatch = false;

    // Keyword matching (auto + strict)
    const keywords = getKeywords(rule);
    for (const kw of keywords) {
      if (queryLower.includes(kw.toLowerCase())) {
        isMatch = true;
        break;
      }
    }

    // Context matching (auto only — not in strict mode)
    if (!isMatch && mode !== "strict") {
      const context = getContext(rule).toLowerCase();
      if (context && queryLower.includes(context)) {
        isMatch = true;
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
    const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 3);

    for (const rule of rules) {
      const ruleId = rule.id || "unknown";
      if (seenIds.has(ruleId)) continue;

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

  return matched;
}

// ── Plugin Registration ───────────────────────────────────────────────

const correlationMemoryPlugin = {
  id: "correlation-memory",
  name: "Correlation Memory Search",
  description:
    "Correlation-aware memory search — automatic decision-context retrieval with keyword matching, confidence filtering, and rule lifecycle management",
  kind: "memory",
  configSchema: emptyPluginConfigSchema(),

  register(api: OpenClawPluginApi) {
    api.registerTool(
      (ctx) => {
        // Resolve workspace path from SDK context
        const workspacePath =
          (api as any).config?.workspace ||
          path.join(process.cwd(), ".openclaw/workspace");

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
                    "Matching mode: auto (keyword + context), strict (exact keyword), lenient (fuzzy fallback)",
                  default: "auto",
                },
              },
              required: ["query"],
            },
            execute: async (params: {
              query: string;
              auto_correlate?: boolean;
              correlation_mode?: "auto" | "strict" | "lenient";
            }) => {
              const {
                query,
                auto_correlate = true,
                correlation_mode = "auto",
              } = params;

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
                ? matchRules(rules, query, correlation_mode)
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
              },
              required: ["context"],
            },
            execute: async (params: {
              context: string;
              mode?: "auto" | "strict" | "lenient";
            }) => {
              const { context, mode = "auto" } = params;
              const rules = loadCorrelationRules(workspacePath);
              const matched = matchRules(rules, context, mode);

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
