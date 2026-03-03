import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Correlation rules file path (relative to workspace root)
const RULES_FILE = path.join(process.cwd(), ".openclaw/workspace/memory/correlation-rules.json");

interface CorrelationRule {
  id: string;
  context: string;
  correlations: string[];
  relationship_type: string;
  confidence: number;
  priority?: string;
  lifecycle?: {
    state: string;
  };
}

interface CorrelationSearchResult {
  primary_results: any[] | null;
  correlated_contexts: Record<string, {
    rule: CorrelationRule;
    results: any[] | null;
  }>;
  matched_rules: CorrelationRule[];
  summary: string;
}

// Load correlation rules from JSON file
function loadCorrelationRules(): CorrelationRule[] {
  try {
    if (!fs.existsSync(RULES_FILE)) {
      return [];
    }
    const data = fs.readFileSync(RULES_FILE, "utf-8");
    const rulesData = JSON.parse(data);
    // Filter to only active/promoted rules
    return (rulesData.rules || []).filter((rule: CorrelationRule) => {
      const state = rule.lifecycle?.state;
      return state === "promoted" || state === "testing" || state === "validated" || state === "proposal" || !state;
    });
  } catch (error) {
    console.error("Error loading correlation rules:", error);
    return [];
  }
}

// Match query against correlation rule contexts
function matchRules(query: string, rules: CorrelationRule[]): CorrelationRule[] {
  if (!query || rules.length === 0) {
    return [];
  }

  const queryLower = query.toLowerCase();
  return rules.filter((rule) => {
    const contextLower = rule.context.toLowerCase();
    // Simple keyword matching - context keywords in query
    const contextKeywords = contextLower.split(/\s+/).filter(k => k.length > 3);
    return contextKeywords.some((keyword) => queryLower.includes(keyword));
  });
}

const correlationRulesMemoryPlugin = {
  id: "correlation-rules-mem",
  name: "Memory with Correlation Rules",
  description: "Automatically checks correlation rules and fetches related contexts for enriched memory search",
  kind: "memory",
  configSchema: emptyPluginConfigSchema(),

  register(api: OpenClawPluginApi) {
    // Register memory_search_with_correlation tool
    api.registerTool(
      (ctx) => {
        const memorySearchTool = api.runtime.tools.createMemorySearchTool({
          config: ctx.config,
          agentSessionKey: ctx.sessionKey,
        });

        if (!memorySearchTool) {
          return null;
        }

        return [
          {
            type: "function",
            function: {
              name: "memory_search_with_correlation",
              description: "Search memory with automatic correlation rule checking - enriches results with related contexts for better decision-making",
              parameters: {
                type: "object",
                properties: {
                  query: {
                    type: "string",
                    description: "Search query for memory",
                  },
                  auto_correlate: {
                    type: "boolean",
                    description: "Enable automatic correlation rule checking (default: true)",
                    default: true,
                  },
                  auto_synthesize: {
                    type: "boolean",
                    description: "Generate natural language summary of combined results (default: false)",
                    default: false,
                  },
                  limit: {
                    type: "number",
                    description: "Maximum results per search (default: 5)",
                    default: 5,
                  },
                },
                required: ["query"],
              },
            },
          },
          {
            type: "function",
            function: {
              name: "correlation_check",
              description: "Check which correlation rules would match a given query context without performing searches",
              parameters: {
                type: "object",
                properties: {
                  context: {
                    type: "string",
                    description: "Context to check against correlation rules",
                  },
                },
                required: ["context"],
              },
            },
          },
        ];
      },
      { names: ["memory_search_with_correlation", "correlation_check"] },
    );
  },
};

export default correlationRulesMemoryPlugin;
