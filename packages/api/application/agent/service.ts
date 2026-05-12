import { Effect, Context, Layer } from "effect";
import { DomainError } from "../errors";
import type { AgentSession, AgentPlan, AgentAction } from "../../schemas/agent";
import { AgentRepository } from "../ports/agent-repository";

type OpenSessionInput = {
  id: string;
  source: string;
  objective: string;
  context_scope?: string;
  actor_kind?: string;
  actor_name?: string;
  source_system?: string;
  trace_id?: string;
  span_id?: string;
  correlation_id?: string;
  request_id?: string;
};

type SavePlanInput = {
  id: string;
  session_id: string;
  version: number;
  title: string;
  content_markdown?: string;
  structured_plan?: string | unknown;
  trace_id?: string;
  span_id?: string;
  correlation_id?: string;
  request_id?: string;
};

type RecordActionInput = {
  id: string;
  session_id: string;
  plan_id?: string;
  action_type: "thought" | "action" | "observation" | "planning" | "reasoning";
  target_type?: string;
  target_id?: string;
  input_payload?: string | unknown;
  result_payload?: string | unknown;
  status: "pending" | "running" | "completed" | "failed";
  error_code?: string;
  error_message?: string;
  trace_id?: string;
  span_id?: string;
  correlation_id?: string;
  request_id?: string;
  parent_span_id?: string;
};

export class AgentServices extends Context.Tag("AgentServices")<
  AgentServices,
  {
    readonly openSession: (input: OpenSessionInput) => Effect.Effect<AgentSession, DomainError>;
    readonly getSession: (id: string) => Effect.Effect<AgentSession, DomainError>;
    readonly savePlan: (input: SavePlanInput) => Effect.Effect<AgentPlan, DomainError>;
    readonly getPlansBySession: (sessionId: string) => Effect.Effect<AgentPlan[], DomainError>;
    readonly recordAction: (input: RecordActionInput) => Effect.Effect<AgentAction, DomainError>;
    readonly getActionsBySession: (sessionId: string) => Effect.Effect<AgentAction[], DomainError>;
  }
>() {}

export const makeAgentService = (repo: AgentRepository) =>
  AgentServices.of({
    openSession: (input: OpenSessionInput) =>
      Effect.tryPromise({
        try: () =>
          repo.insertSession({
            id: input.id,
            source: input.source,
            objective: input.objective,
            status: "pending",
            context_scope: input.context_scope,
            actor_kind: input.actor_kind,
            actor_name: input.actor_name,
            source_system: input.source_system,
            trace_id: input.trace_id,
            span_id: input.span_id,
            correlation_id: input.correlation_id,
            request_id: input.request_id,
            started_at: new Date().toISOString(),
          }),
        catch: (e) =>
          new DomainError({
            code: "VALIDATION_ERROR",
            message: "Failed to create session",
            cause: e,
          }),
      }),

    getSession: (id: string) =>
      Effect.gen(function* () {
        const session = yield* Effect.tryPromise({
          try: () => repo.getSession(id),
          catch: (err) =>
            new DomainError({
              code: "VALIDATION_ERROR",
              message: "Failed to get session",
              cause: err,
            }),
        });
        if (!session) {
          return yield* Effect.fail(
            new DomainError({ code: "NOT_FOUND", message: `Session ${id} not found` })
          );
        }
        return session;
      }),

    savePlan: (input: SavePlanInput) =>
      Effect.tryPromise({
        try: () =>
          repo.insertPlan({
            id: input.id,
            session_id: input.session_id,
            version: input.version,
            title: input.title,
            content_markdown: input.content_markdown,
            structured_plan: input.structured_plan,
            trace_id: input.trace_id,
            span_id: input.span_id,
            correlation_id: input.correlation_id,
            request_id: input.request_id,
            created_at: new Date().toISOString(),
          }),
        catch: (e) =>
          new DomainError({ code: "VALIDATION_ERROR", message: "Failed to save plan", cause: e }),
      }),

    getPlansBySession: (sessionId: string) =>
      Effect.tryPromise({
        try: () => repo.getPlansBySession(sessionId),
        catch: (err) =>
          new DomainError({
            code: "VALIDATION_ERROR",
            message: "Failed to get plans for session",
            cause: err,
          }),
      }),

    recordAction: (input: RecordActionInput) =>
      Effect.tryPromise({
        try: () =>
          repo.insertAction({
            id: input.id,
            session_id: input.session_id,
            plan_id: input.plan_id,
            action_type: input.action_type,
            target_type: input.target_type,
            target_id: input.target_id,
            input_payload: input.input_payload,
            result_payload: input.result_payload,
            status: input.status,
            error_code: input.error_code,
            error_message: input.error_message,
            trace_id: input.trace_id,
            span_id: input.span_id,
            correlation_id: input.correlation_id,
            request_id: input.request_id,
            parent_span_id: input.parent_span_id,
            created_at: new Date().toISOString(),
          }),
        catch: (e) =>
          new DomainError({
            code: "VALIDATION_ERROR",
            message: "Failed to record action",
            cause: e,
          }),
      }),

    getActionsBySession: (sessionId: string) =>
      Effect.tryPromise({
        try: () => repo.getActionsBySession(sessionId),
        catch: (err) =>
          new DomainError({
            code: "VALIDATION_ERROR",
            message: "Failed to get actions for session",
            cause: err,
          }),
      }),
  });

export const AgentServicesLive = Layer.effect(
  AgentServices,
  Effect.gen(function* () {
    const repo = yield* AgentRepository;
    return makeAgentService(repo);
  })
);
