import { Effect } from "effect";

export interface SystemArchitectureResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export const systemArchitectureResource = (): SystemArchitectureResource => ({
  uri: `system://architecture`,
  name: "System Architecture",
  description: "Architecture information for 0xsignal v1.0.0",
  mimeType: "application/json",
});

export const getSystemArchitecture = () =>
  Effect.succeed({
    resource: systemArchitectureResource(),
    content: JSON.stringify(
      {
        server_name: "0xsignal",
        version: "1.0.0",
        components: {
          domain: {
            strategy: { entities: ["StrategyDefinition", "StrategyVersion"] },
            backtest: { entities: ["BacktestRun", "BacktestMetric", "BacktestEvent"] },
            agent: { entities: ["AgentSession", "AgentPlan", "AgentAction"] },
            research: { entities: ["ResearchNote", "Artifact"] },
          },
          infrastructure: {
            database: ["PostgreSQL", "QuestDB"],
            repositories: ["StrategyRepository", "BacktestRepository", "AgentRepository"],
          },
          presentation: {
            http: ["REST API"],
            mcp: ["MCP Server with 5 resources and 10 tools"],
          },
        },
      },
      null,
      2
    ),
  });
