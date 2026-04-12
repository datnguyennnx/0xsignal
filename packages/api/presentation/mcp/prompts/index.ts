import type { Prompt } from "@modelcontextprotocol/sdk/types.js";

export interface ExtendedPrompt extends Prompt {
  template: string;
}

export const designStrategyPrompt: ExtendedPrompt = {
  name: "design_strategy",
  description: "Guide the agent through designing a new trading strategy",
  arguments: [
    {
      name: "market_type",
      description: "Type of market (crypto, forex, equity, commodity)",
      required: true,
    },
    {
      name: "objective",
      description: "Trading objective or goal",
      required: true,
    },
  ],
  template: `You are designing a new trading strategy.

Market Type: {{market_type}}
Objective: {{objective}}

Follow these steps:
1. Define the market hypothesis
2. Identify key indicators and parameters
3. Define entry/exit conditions
4. Specify risk management rules
5. Create the strategy definition

Start by opening a session with open_session tool, then create strategy with create_strategy_definition.`,
};

export const createPlanPrompt: ExtendedPrompt = {
  name: "create_plan",
  description: "Guide the agent through creating a plan for a backtesting session",
  arguments: [
    {
      name: "session_id",
      description: "The session ID to create a plan for",
      required: true,
    },
  ],
  template: `You are creating a plan for backtesting session {{session_id}}.

Steps:
1. Review the session objective
2. Define strategy to test
3. Select market data requirements
4. Specify backtest parameters
5. Run the backtest

Use save_plan_version to save your plan.`,
};

export const analyzeBacktestRunPrompt: ExtendedPrompt = {
  name: "analyze_backtest_run",
  description: "Guide the agent through analyzing a completed backtest run",
  arguments: [
    {
      name: "run_id",
      description: "The run ID to analyze",
      required: true,
    },
  ],
  template: `You are analyzing backtest run {{run_id}}.

Steps:
1. Get the run summary using get_run_summary
2. Review key metrics (total_return, sharpe_ratio, max_drawdown)
3. Check event timeline
4. Identify issues or anomalies
5. Document findings in a research note

Use get_run_summary to retrieve metrics, then append_research_note to document insights.`,
};

export const PROMPTS = [designStrategyPrompt, createPlanPrompt, analyzeBacktestRunPrompt];
