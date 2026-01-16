/**
 * PlanView Component
 *
 * Renders an active execution plan as an interactive to-do list.
 * Shows plan goal, progress, step list with status indicators,
 * and action buttons (Start/Cancel).
 */

import { h } from 'preact';
import { activePlan, planProgress } from '../../store/plan';
import type { ExecutionStep } from '../../core/plan';
import { PlanStepItem } from './PlanStepItem';
import Pillar from '../../core/Pillar';

// ============================================================================
// Icons
// ============================================================================

const ICONS = {
  plan: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>`,
};

// ============================================================================
// PlanView Component
// ============================================================================

export function PlanView() {
  const plan = activePlan.value;
  if (!plan) return null;

  const isAwaitingStart = plan.status === 'awaiting_start';
  const isExecuting = plan.status === 'executing';
  const progress = planProgress.value;
  const pillar = Pillar.getInstance();

  const handleStart = () => {
    pillar?.startPlan();
  };

  const handleCancel = () => {
    pillar?.cancelPlan();
  };

  const handleConfirmStep = (stepId: string, data?: Record<string, unknown>) => {
    pillar?.confirmPlanStep(stepId, data);
  };

  const handleSkipStep = (stepId: string) => {
    pillar?.skipPlanStep(stepId);
  };

  const handleRetryStep = (stepId: string) => {
    pillar?.retryPlanStep(stepId);
  };

  const handleDoneStep = (stepId: string) => {
    pillar?.markPlanStepDone(stepId);
  };

  return (
    <div class="pillar-plan">
      <div class="pillar-plan__header">
        <div class="pillar-plan__icon">
          <span dangerouslySetInnerHTML={{ __html: ICONS.plan }} />
        </div>
        <div class="pillar-plan__title">{plan.goal}</div>
        <div class="pillar-plan__progress">
          {plan.completed_steps}/{plan.total_steps}
        </div>
      </div>

      {/* Progress bar */}
      {isExecuting && (
        <div class="pillar-plan__progress-bar">
          <div
            class="pillar-plan__progress-fill"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}

      <div class="pillar-plan__steps">
        {plan.steps.map((step) => (
          <PlanStepItem
            key={step.id}
            step={step}
            onConfirm={handleConfirmStep}
            onSkip={handleSkipStep}
            onRetry={handleRetryStep}
            onDone={handleDoneStep}
          />
        ))}
      </div>

      <div class="pillar-plan__footer">
        {isAwaitingStart && (
          <button
            type="button"
            class="pillar-plan__start-btn"
            onClick={handleStart}
          >
            Start Plan
          </button>
        )}
        <button
          type="button"
          class="pillar-plan__cancel-btn"
          onClick={handleCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Styles
// ============================================================================

export const PLAN_STYLES = `
/* Plan Container */
.pillar-plan {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: var(--pillar-bg-secondary, #f9fafb);
  border: 1px solid var(--pillar-border, #e5e7eb);
  border-radius: 12px;
  margin: 12px 0;
}

/* Header */
.pillar-plan__header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pillar-plan__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--pillar-text-secondary, #6b7280);
}

.pillar-plan__title {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: var(--pillar-text-primary, #1a1a1a);
  line-height: 1.4;
}

.pillar-plan__progress {
  font-size: 12px;
  font-weight: 500;
  color: var(--pillar-text-secondary, #6b7280);
  padding: 2px 8px;
  background: var(--pillar-bg-tertiary, #e5e7eb);
  border-radius: 10px;
}

/* Progress Bar */
.pillar-plan__progress-bar {
  height: 4px;
  background: var(--pillar-bg-tertiary, #e5e7eb);
  border-radius: 2px;
  overflow: hidden;
}

.pillar-plan__progress-fill {
  height: 100%;
  background: var(--pillar-primary, #2563eb);
  border-radius: 2px;
  transition: width 0.3s ease;
}

/* Steps List */
.pillar-plan__steps {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* Footer */
.pillar-plan__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--pillar-border, #e5e7eb);
}

/* Start Button */
.pillar-plan__start-btn {
  display: inline-flex;
  align-items: center;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  background: var(--pillar-primary, #2563eb);
  color: #ffffff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.pillar-plan__start-btn:hover {
  background: var(--pillar-primary-hover, #1d4ed8);
}

/* Cancel Button */
.pillar-plan__cancel-btn {
  display: inline-flex;
  align-items: center;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  background: transparent;
  color: var(--pillar-text-secondary, #6b7280);
  border: 1px solid var(--pillar-border, #d1d5db);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.pillar-plan__cancel-btn:hover {
  background: var(--pillar-bg-tertiary, #f3f4f6);
  color: var(--pillar-danger, #dc2626);
  border-color: var(--pillar-danger, #dc2626);
}
`;
