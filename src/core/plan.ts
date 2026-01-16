/**
 * Execution Plan Types
 *
 * Types for server-generated multi-step execution plans. These types
 * match the backend ExecutionPlan and ExecutionStep model `to_dict()` output.
 *
 * Plans are created by the ReAct agent when it determines that a user's
 * request requires multiple sequential actions. The plan is persisted
 * server-side and streamed to the client for execution.
 *
 * @see backend/apps/mcp/models/execution_plan.py
 */

/**
 * Plan status values from PlanStatus enum.
 * Matches backend PlanStatus.choices.
 */
export type PlanStatus =
  | 'planning'
  | 'ready'
  | 'executing'
  | 'awaiting_start' // User must click Start (auto_execute=false)
  | 'awaiting_input'
  | 'awaiting_result'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Step status values from StepStatus enum.
 * Matches backend StepStatus.choices.
 */
export type StepStatus =
  | 'pending'
  | 'ready'
  | 'awaiting_confirmation'
  | 'executing'
  | 'awaiting_result'
  | 'completed'
  | 'skipped'
  | 'failed';

/**
 * Execution location for a step.
 */
export type ExecutionLocation = 'client' | 'server';

/**
 * A multi-step execution plan.
 * Matches ExecutionPlan.to_dict() output.
 */
export interface ExecutionPlan {
  /** UUID string */
  id: string;
  /** Interpreted goal statement */
  goal: string;
  /** Original user query */
  query: string;
  /** Current plan status */
  status: PlanStatus;
  /** If true, plan starts executing immediately. If false, user must click Start. */
  auto_execute: boolean;
  /** Total number of steps in the plan */
  total_steps: number;
  /** Number of completed steps */
  completed_steps: number;
  /** Minutes before plan is considered timed out */
  timeout_minutes: number;
  /** All steps in the plan */
  steps: ExecutionStep[];
  /** When the plan was created (ISO timestamp) */
  created_at: string | null;
  /** When the plan completed (ISO timestamp) */
  completed_at: string | null;
}

/**
 * A single step in an execution plan.
 * Matches ExecutionStep.to_dict() output.
 */
export interface ExecutionStep {
  /** UUID string */
  id: string;
  /** Step order (0-indexed) */
  index: number;
  /** Human-readable step description */
  description: string;
  /** Name of the action to execute */
  action_name: string;
  /** Data payload for the action */
  action_data: Record<string, unknown>;
  /** Where this step executes (client or server) */
  execution_location: ExecutionLocation;
  /** If true, pause for user confirmation before executing */
  requires_user_confirmation: boolean;
  /** If true, client must send result back to server */
  requires_result_feedback: boolean;
  /** Execute immediately without user clicking */
  auto_run: boolean;
  /** Mark complete immediately after execution */
  auto_complete: boolean;
  /** Custom card type for confirmation UI */
  confirmation_card_type: string;
  /** Configuration for the confirmation card */
  confirmation_card_config: Record<string, unknown>;
  /** List of step UUIDs this step depends on */
  depends_on: string[];
  /** Current step status */
  status: StepStatus;
  /** Result data from step execution */
  result: unknown | null;
  /** Error message if step failed */
  error_message: string;
  /** Number of retry attempts made */
  retry_count: number;
  /** Maximum retry attempts allowed */
  max_retries: number;
  /** Whether this step can be retried on failure */
  is_retriable: boolean;
  /**
   * @deprecated LLM now generates contextual guidance in the response text instead.
   * This field is no longer populated by the backend.
   */
  awaiting_instruction?: string;
}

/**
 * Plan-related events emitted by the SDK.
 */
export interface PlanEvents {
  /** Plan execution has started */
  'plan:start': ExecutionPlan;
  /** A step has become active (started executing) */
  'plan:step:active': { plan: ExecutionPlan; step: ExecutionStep };
  /** A step is awaiting user confirmation */
  'plan:step:confirm': { plan: ExecutionPlan; step: ExecutionStep };
  /** A step has completed (success or failure) */
  'plan:step:complete': {
    plan: ExecutionPlan;
    step: ExecutionStep;
    success: boolean;
  };
  /** A step was skipped by the user */
  'plan:step:skip': { plan: ExecutionPlan; step: ExecutionStep };
  /** A step has failed (includes retry info) */
  'plan:step:failed': {
    plan: ExecutionPlan;
    step: ExecutionStep;
    error: Error;
    canRetry: boolean;
  };
  /** A step is being retried */
  'plan:step:retry': {
    plan: ExecutionPlan;
    step: ExecutionStep;
    retryCount: number;
  };
  /** Plan was updated (e.g., after server analysis) */
  'plan:updated': ExecutionPlan;
  /** All steps complete, plan finished */
  'plan:complete': ExecutionPlan;
  /** Plan was cancelled by the user */
  'plan:cancel': ExecutionPlan;
  /** An error occurred during plan execution */
  'plan:error': { plan: ExecutionPlan; error: Error };
}
