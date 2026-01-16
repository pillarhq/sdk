/**
 * Workflow Store
 * Signal-based state management for multi-step workflows
 */

import { signal, computed } from '@preact/signals';
import type { Workflow, WorkflowStep, WorkflowStepStatus } from '../core/workflow';

// ============================================================================
// State Signals
// ============================================================================

/** Active workflow (only one at a time) */
export const activeWorkflow = signal<Workflow | null>(null);

/** Completed/cancelled workflows for the session (for analytics/history) */
export const workflowHistory = signal<Workflow[]>([]);

// ============================================================================
// Computed Values
// ============================================================================

/** Whether there's an active workflow */
export const hasActiveWorkflow = computed(() => activeWorkflow.value !== null);

/** Current step of the active workflow */
export const currentStep = computed((): WorkflowStep | null => {
  if (!activeWorkflow.value) return null;
  return activeWorkflow.value.steps[activeWorkflow.value.current_step] || null;
});

/** Number of completed steps */
export const completedStepsCount = computed((): number => {
  if (!activeWorkflow.value) return 0;
  return activeWorkflow.value.steps.filter(
    (s) => s.status === 'completed' || s.status === 'skipped'
  ).length;
});

/** Progress as a fraction (0-1) */
export const workflowProgress = computed((): number => {
  if (!activeWorkflow.value) return 0;
  return completedStepsCount.value / activeWorkflow.value.total_steps;
});

// ============================================================================
// Actions
// ============================================================================

/**
 * Start a new workflow.
 * Sets the first step to either 'active' or 'awaiting_initiation' based on auto_run.
 */
export function startWorkflow(workflow: Workflow): void {
  // Cancel any existing workflow
  if (activeWorkflow.value) {
    workflowHistory.value = [...workflowHistory.value, activeWorkflow.value];
  }

  // Ensure first step has correct status
  // auto_run=true -> 'active' (executes immediately)
  // auto_run=false -> 'awaiting_initiation' (wait for user click)
  const steps = workflow.steps.map((step, idx) => {
    if (idx === 0) {
      return {
        ...step,
        status: step.auto_run
          ? ('active' as WorkflowStepStatus)
          : ('awaiting_initiation' as WorkflowStepStatus),
      };
    }
    return { ...step, status: 'pending' as WorkflowStepStatus };
  });

  activeWorkflow.value = {
    ...workflow,
    steps,
    current_step: 0,
  };
}

/**
 * Update a step's status.
 */
export function updateStepStatus(
  stepIndex: number,
  status: WorkflowStepStatus
): void {
  if (!activeWorkflow.value) return;

  const steps = activeWorkflow.value.steps.map((step, idx) =>
    idx === stepIndex ? { ...step, status } : step
  );

  activeWorkflow.value = { ...activeWorkflow.value, steps };
}

/**
 * Advance to the next step in the workflow.
 * Returns the next step, or null if workflow is complete.
 */
export function advanceToNextStep(): WorkflowStep | null {
  if (!activeWorkflow.value) return null;

  const nextIndex = activeWorkflow.value.current_step + 1;

  if (nextIndex >= activeWorkflow.value.steps.length) {
    // Workflow complete
    return null;
  }

  // Get next step and set its initial status
  // auto_run=true -> 'active' (executes immediately)
  // auto_run=false -> 'awaiting_initiation' (wait for user click)
  const nextStep = activeWorkflow.value.steps[nextIndex];
  const nextStatus: WorkflowStepStatus = nextStep.auto_run
    ? 'active'
    : 'awaiting_initiation';

  // Update workflow with new current step and status
  const steps = activeWorkflow.value.steps.map((step, idx) =>
    idx === nextIndex ? { ...step, status: nextStatus } : step
  );

  activeWorkflow.value = {
    ...activeWorkflow.value,
    steps,
    current_step: nextIndex,
  };

  return activeWorkflow.value.steps[nextIndex];
}

/**
 * Complete the current workflow.
 * Moves it to history and clears active workflow.
 */
export function completeWorkflow(): Workflow | null {
  if (!activeWorkflow.value) return null;

  const completed = activeWorkflow.value;
  workflowHistory.value = [...workflowHistory.value, completed];
  activeWorkflow.value = null;

  return completed;
}

/**
 * Cancel the active workflow.
 */
export function cancelWorkflow(): Workflow | null {
  if (!activeWorkflow.value) return null;

  const cancelled = activeWorkflow.value;
  activeWorkflow.value = null;

  return cancelled;
}

/**
 * Get the current active step.
 */
export function getCurrentStep(): WorkflowStep | null {
  return currentStep.value;
}

/**
 * Reset all workflow state.
 */
export function resetWorkflow(): void {
  activeWorkflow.value = null;
  workflowHistory.value = [];
}

