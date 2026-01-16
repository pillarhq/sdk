/**
 * Workflow Types
 *
 * Types for dynamic workflow composition - multi-step sequences
 * composed from atomic ActionTasks at runtime.
 */

/**
 * Status of a workflow step
 */
export type WorkflowStepStatus =
  | 'pending'              // Not yet reached
  | 'awaiting_initiation'  // Current step, waiting for user to click Start
  | 'active'               // Currently executing
  | 'completed'            // Successfully finished
  | 'skipped'              // User skipped this step
  | 'failed';              // Execution failed

/**
 * A single step in a workflow
 */
export interface WorkflowStep {
  /** Step index in the workflow */
  index: number;
  /** Database ID of the ActionTask */
  task_id?: string;
  /** Task identifier */
  task_name: string;
  /** Task type for built-in handling */
  task_type: 'navigate' | 'open_modal' | 'fill_form' | 'trigger_action' | 'copy_text' | 'external_link' | 'start_tutorial';
  /** Human-readable label */
  label: string;
  /** Task description */
  description?: string;
  /** Helpful note for the user */
  note?: string;
  /** Data payload for this step */
  data: Record<string, unknown>;
  /** Current step status */
  status: WorkflowStepStatus;

  // === Execution Behavior Flags ===

  /**
   * If true, action executes immediately without user clicking.
   * If false, shows button and waits for user interaction.
   * Used for safe, reversible actions like navigation.
   */
  auto_run: boolean;

  /**
   * If true, step completes immediately after execution without
   * waiting for host app confirmation.
   * Used for simple navigations and clipboard operations.
   */
  auto_complete: boolean;
}

/**
 * A workflow composed of multiple steps
 */
export interface Workflow {
  /** Unique workflow ID for this session (ephemeral) */
  id: string;
  /** Human-readable title */
  title: string;
  /** Workflow description */
  description?: string;
  /** Ordered steps */
  steps: WorkflowStep[];
  /** Total number of steps */
  total_steps: number;
  /** Currently active step index */
  current_step: number;
}

/**
 * Events emitted during workflow execution
 */
export interface WorkflowEvents {
  /** Workflow has started */
  'workflow:start': Workflow;
  /** A step has become active (started executing) */
  'workflow:step:active': { workflow: Workflow; step: WorkflowStep };
  /** A step has completed (success or failure) */
  'workflow:step:complete': { workflow: Workflow; step: WorkflowStep; success: boolean };
  /** A step was skipped by the user */
  'workflow:step:skip': { workflow: Workflow; step: WorkflowStep };
  /** All steps complete, workflow finished */
  'workflow:complete': Workflow;
  /** Workflow was cancelled by the user */
  'workflow:cancel': Workflow;
}

