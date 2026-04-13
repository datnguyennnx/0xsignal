import { Effect } from "effect";

export const explainDataSourcePolicyTool = {
  name: "explain_data_source_policy",
  description: "Explain the tiered market data source policy used by 0xsignal",
  execute: () => {
    return Effect.succeed({
      policy: "Tiered Source Policy",
      tiers: [
        {
          tier: 1,
          name: "Local Cache (QuestDB)",
          description: "Default fast path for historical data. All fetched data is persisted here.",
        },
        {
          tier: 2,
          name: "Primary Retrieve (Hyperliquid SDK)",
          description: "Online retrieval for Hyperliquid market data using the official SDK.",
        },
        {
          tier: 3,
          name: "Repair/Fallback",
          description: "External sources used only if Tier 2 has gaps or is unavailable (Planned).",
        },
      ],
      reproducibility:
        "All dataset snapshots are frozen from verified Tier 1 data to ensure backtest reproducibility.",
    });
  },
  inputSchema: {
    type: "object",
    properties: {},
  },
};
