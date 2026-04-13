import type { Prompt } from "@modelcontextprotocol/sdk/types.js";

export interface ExtendedPrompt extends Prompt {
  template: string;
}

export const sessionKickoffPrompt: ExtendedPrompt = {
  name: "session_kickoff",
  description: "Kick off a new session with explicit objective and execution boundaries",
  arguments: [
    {
      name: "source",
      description: "Source channel for this session",
      required: true,
    },
    {
      name: "objective",
      description: "Primary objective to achieve in this session",
      required: true,
    },
    {
      name: "context_scope",
      description: "Optional scope or constraints",
      required: false,
    },
  ],
  template: `You are starting a workflow session.

Source: {{source}}
Objective: {{objective}}
Context Scope: {{context_scope}}

Follow these steps:
1. Call open_session with source and objective (include context_scope if provided)
2. Confirm returned session_id before any downstream workflow action
3. Record key actions using record_agent_action at major checkpoints
4. Keep outputs factual and tied to tool/resource evidence

Expected output:
- session_id
- short checkpoint plan for the next workflow phase.`,
};

export const prepareBacktestDataPrompt: ExtendedPrompt = {
  name: "prepare_backtest_data",
  description: "Prepare reproducible market data coverage and snapshot for backtesting",
  arguments: [
    {
      name: "symbol",
      description: "Market symbol, for example BTC",
      required: true,
    },
    {
      name: "interval",
      description: "Candle interval such as 1m, 1h, or 1d",
      required: true,
    },
    {
      name: "start_time",
      description: "Start time in ISO format",
      required: true,
    },
    {
      name: "end_time",
      description: "End time in ISO format",
      required: true,
    },
    {
      name: "exchange",
      description: "Optional exchange (defaults to Hyperliquid)",
      required: false,
    },
    {
      name: "request_id",
      description: "Candlestick request identifier for snapshot creation",
      required: true,
    },
  ],
  template: `You are preparing reproducible data for backtesting.

Symbol: {{symbol}}
Interval: {{interval}}
Exchange: {{exchange}}
Start: {{start_time}}
End: {{end_time}}
Request ID: {{request_id}}

Steps:
1. Use inspect_candle_coverage to inspect current local coverage for the requested window
2. If coverage is partial or zero, use ensure_candle_coverage and re-check coverage
3. Only when coverage is full, create_dataset_snapshot using request_id and the same window
4. Return snapshot_id and provenance details

Expected output:
- fullCoverage status
- snapshot_id
- provenance.`,
};

export const runBacktestPrompt: ExtendedPrompt = {
  name: "run_backtest",
  description: "Launch a backtest run from a strategy version and dataset snapshot",
  arguments: [
    {
      name: "strategy_version_id",
      description: "Strategy version identifier",
      required: true,
    },
    {
      name: "dataset_snapshot_id",
      description: "Dataset snapshot identifier",
      required: true,
    },
    {
      name: "session_id",
      description: "Optional parent session identifier",
      required: false,
    },
  ],
  template: `You are launching a backtest run.

Strategy Version ID: {{strategy_version_id}}
Dataset Snapshot ID: {{dataset_snapshot_id}}
Session ID: {{session_id}}

Steps:
1. Validate that strategy_version_id and dataset_snapshot_id are present and non-empty
2. Call start_backtest_run with these IDs
3. Capture run_id from the response
4. Optionally record checkpoint status using record_agent_action

Expected output:
- run_id
- status.`,
};

export const analyzeBacktestRunPrompt: ExtendedPrompt = {
  name: "analyze_backtest_run",
  description: "Retrieve backtest summary and persist evidence-backed research notes",
  arguments: [
    {
      name: "run_id",
      description: "Backtest run identifier",
      required: true,
    },
    {
      name: "note_title",
      description: "Title for the research note",
      required: true,
    },
  ],
  template: `You are analyzing a completed or in-progress backtest run.

Run ID: {{run_id}}
Note Title: {{note_title}}

Steps:
1. Read backtest://{{run_id}}/summary for read-first context
2. Call get_run_summary to confirm latest run metrics and event_count
3. If results are sufficient, call append_research_note with evidence-backed findings
4. Keep findings tied to observed metrics; do not invent conclusions not supported by data

Expected output:
- normalized summary view
- note_id if a note is created.`,
};

export const iterateStrategyPrompt: ExtendedPrompt = {
  name: "iterate_strategy",
  description: "Use run evidence to prepare a new strategy version iteration",
  arguments: [
    {
      name: "strategy_id",
      description: "Strategy identifier",
      required: true,
    },
    {
      name: "change_reason",
      description: "Reason for creating the next version",
      required: true,
    },
  ],
  template: `You are preparing a strategy iteration.

Strategy ID: {{strategy_id}}
Change Reason: {{change_reason}}

Steps:
1. Read strategy://{{strategy_id}}/history to inspect version lineage
2. Prepare a config delta grounded in observed run outcomes
3. Call create_strategy_version with the selected strategy_id, config, and change_reason
4. Return the new strategy version identifier

Expected output:
- strategy_id
- new strategy_version_id
- short rationale.`,
};

export const PROMPTS = [
  sessionKickoffPrompt,
  prepareBacktestDataPrompt,
  runBacktestPrompt,
  analyzeBacktestRunPrompt,
  iterateStrategyPrompt,
];
