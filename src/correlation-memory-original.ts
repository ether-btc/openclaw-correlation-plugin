import type { OpenClawPluginApi, AnyAgentTool } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import * as fs from "fs";
import * as path from "path";

// Load correlation rules from workspace
function loadCorrelationRules(workspacePath: string): any[] {
  const rulesPath = path.join(workspacePath, "memory/correlation-rules.json");
  try {
    if (fs.existsSync(rulesPath)) {
      const data = fs.readFileSync(rulesPath, "utf-8");
      return JSON.parse(data).rules || [];
    }
  } catch (e) {
    // Rules file doesn't exist or is invalid
  }
  return [];
}

// Match query against correlation rules
function matchRules(rules: any[], query: string): any[] {
  const queryLower = query.toLowerCase();
  const matched: any[] = [];

  for (const rule of rules) {
    // Skip rules that are not promoted/active
    if (rule.lifecycle?.state && rule.lifecycle.state !== "promoted") {
      continue;
    }

    // Check keywords match
    const keywords = rule.keywords || [];
    for (const kw of keywords) {
      if (queryLower.includes(kw.toLowerCase())) {
        matched.push(rule);
        break;
      }
    }

    // Check context field match
    if (!matched.includes(rule) && rule.context) {
      const contextLower = rule.context.toLowerCase();
      if (queryLower.includes(contextLower)) {
        matched.push(rule);
      }
    }
  }

  return matched;
}

// Build additional search queries from matched rules
function buildAdditionalSearches(matchedRules: any[]): string[] {
  const searches: string[] = [];
  const seen = new Set<string>();

  for (const rule of matchedRules) {
    const correlations = rule.correlations || [];
    for (const corr of correlations) {
      const searchQuery = corr.search_query || corr;
      if (searchQuery && !seen.has(searchQuery.toLowerCase())) {
        seen.add(searchQuery.toLowerCase());
        searches.push(searchQuery);
      }
    }
  }

  return searches;
}

// Create the correlation-aware memory search tool
function createCorrelationSearchTool(options: {
  workspacePath: string;
}): AnyAgentTool | null {
  return {
    name: "memory_search_with_correlation",
    description: "Search memory with automatic correlation rule matching. When you ask about a topic, this checks for related contexts that typically matter for decisions on that topic. Example: asking about 'backup error' automatically also retrieves 'last-backup-time' and 'recovery-procedures' because correlation rules know these are relevant for backup decisions.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query to find relevant memories",
        },
        auto_correlate: {
          type: "boolean",
          description: "Whether to automatically fetch correlated contexts (default: true)",
          default: true,
        },
        correlation_mode: {
          type: "string",
          enum: ["auto", "strict", "lenient"],
          description: "Matching strictness: auto (default), strict (exact keyword match), lenient (fuzzy match)",
          default: "auto",
        },
      },
      required: ["query"],
    },
    execute: async (params: {
      query: string;
      auto_correlate?: boolean;
      correlation_mode?: string;
    }) => {
      const { query, auto_correlate = true, correlation_mode = "auto" } = params;

      // Load correlation rules
      const rules = loadCorrelationRules(options.workspacePath);

      if (rules.length === 0) {
        return {
          success: true,
          query,
          primary_results: { message: "No correlation rules loaded" },
          correlated_contexts: {},
          summary: "No correlation rules configured. Use correlation-rules.sh to add rules.",
        };
      }

      // Match rules based on mode
      let matchedRules = matchRules(rules, query);

      // In lenient mode, do fuzzy matching
      if (correlation_mode === "lenient" && matchedRules.length === 0) {
        const queryWords = query.toLowerCase().split(/\s+/);
        for (const rule of rules) {
          if (rule.lifecycle?.state && rule.lifecycle.state !== "promoted") continue;
          
          const ruleText = [
            rule.context || "",
            ...(rule.keywords || []),
            ...(rule.correlations || []).map((c: any) => c.search_query || c),
          ].join(" ").toLowerCase();

          for (const word of queryWords) {
            if (word.length > 3 && ruleText.includes(word)) {
              matchedRules.push(rule);
              break;
            }
          }
        }
      }

      // Build additional search queries
      const additionalSearches = buildAdditionalSearches(matchedRules);

      // Build response
      const response: any = {
        success: true,
        query,
        matched_rules: matchedRules.map((r) => ({
          id: r.id,
          context: r.context,
          confidence: r.confidence,
          correlation_count: (r.correlations || []).length,
        })),
        primary_query: query,
        suggested_additional_searches: additionalSearches,
        auto_correlate,
        correlation_mode,
      };

      if (!auto_correlate || matchedRules.length === 0) {
        response.correlated_contexts = {};
        response.summary = matchedRules.length === 0
          ? `No correlation rules matched for "${query}".`
          : `Correlation disabled. Found ${matchedRules.length} matching rules.`;
      } else {
        // Return structured info about what to search for
        response.correlated_contexts = matchedRules.map((r) => ({
          rule_id: r.id,
          context: r.context,
          correlations: r.correlations || [],
        }));
        
        const ruleIds = matchedRules.map((r) => r.id).join(", ");
        response.summary = `Query "${query}" matched ${matchedRules.length} correlation rule(s) [${ruleIds}]. ` +
          `Suggested additional searches: ${additionalSearches.join(", ") || "none"}. ` +
          `Use memory_search tool for each suggested query to retrieve correlated contexts.`;
      }

      return response;
    },
  };
}

// Create simple correlation check tool (for debugging/manual use)
function createCorrelationCheckTool(options: {
  workspacePath: string;
}): AnyAgentTool | null {
  return {
    name: "correlation_check",
    description: "Check which correlation rules match a given context or query. Use this to see what additional contexts the system would recommend for a decision.",
    parameters: {
      type: "object",
      properties: {
        context: {
          type: "string",
          description: "The context or query to check against correlation rules",
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
    execute: async (params: { context: string; mode?: string }) => {
      const { context, mode = "auto" } = params;
      const rules = loadCorrelationRules(options.workspacePath);

      let matchedRules = matchRules(rules, context);
      
      if (mode === "lenient" && matchedRules.length === 0) {
        const words = context.toLowerCase().split(/\s+/);
        for (const rule of rules) {
          if (rule.lifecycle?.state && rule.lifecycle.state !== "promoted") continue;
          
          const ruleText = [
            rule.context || "",
            ...(rule.keywords || []),
            ...(rule.correlations || []).map((c: any) => c.search_query || c),
          ].join(" ").toLowerCase();

          for (const word of words) {
            if (word.length > 3 && ruleText.includes(word)) {
              matchedRules.push(rule);
              break;
            }
          }
        }
      }

      return {
        success: true,
        context,
        mode,
        total_rules: rules.length,
        matched_count: matchedRules.length,
        matching_rules: matchedRules.map((r) => ({
          id: r.id,
          context: r.context,
          keywords: r.keywords,
          confidence: r.confidence,
          correlations: r.correlations?.map((c: any) => c.search_query || c) || [],
        })),
      };
    },
  };
}

const correlationMemoryPlugin = {
  id: "correlation-memory",
  name: "Memory (Correlation-Aware)",
  description: "Automatic correlation rule checking with memory search - provides multi-context retrieval for decision-making queries",
  kind: "memory",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    // Get workspace path from config or use default
    const workspacePath = process.env.OPENCLAW_WORKSPACE || 
      (api as any).config?.workspace || 
      path.join(os.homedir(), ".openclaw/workspace");

    api.registerTool(
      (ctx) => {
        const searchTool = createCorrelationSearchTool({ workspacePath });
        const checkTool = createCorrelationCheckTool({ workspacePath });
        if (!searchTool || !checkTool) {
          return null;
        }
        return [searchTool, checkTool];
      },
      { names: ["memory_search_with_correlation", "correlation_check"] },
    );
  },
};

export default correlationMemoryPlugin;

{
  "name": "@openclaw/correlation-memory",
  "version": "2026.2.26",
  "private": true,
  "description": "Correlation-aware memory search - automatic multi-context retrieval",
  "type": "module",
  "devDependencies": {
    "openclaw": "workspace:*"
  },
  "peerDependencies": {
    "openclaw": ">=2026.1.26"
  },
  "openclaw": {
    "extensions": [
      "./index.ts"
    ]
  }
}
