/**
 * PlanView Component
 *
 * Renders an active execution plan as an interactive to-do list.
 * Shows plan goal, progress, step list with status indicators,
 * and action buttons (Start/Cancel).
 */

import { h } from 'preact';
import { activePlan } from '../../store/plan';
import { PlanStepItem } from './PlanStepItem';
import { debug } from '../../utils/debug';
import { usePillarInstance } from '../../hooks';
import { PreactMarkdown } from '../../utils/preact-markdown';

// ============================================================================
// PlanView Component
// ============================================================================

export function PlanView() {
  const plan = activePlan.value;
  if (!plan) return null;

  const isAwaitingStart = plan.status === 'awaiting_start';
  const isExecuting = plan.status === 'executing';
  const isReady = plan.status === 'ready';
  const pillar = usePillarInstance();

  // Check if plan appears stuck - has auto_execute but no step is actively executing
  const hasActiveStep = plan.steps.some(s => s.status === 'executing');
  const hasReadyStep = plan.steps.some(s => s.status === 'ready');
  const isStuck = plan.auto_execute && 
    (isExecuting || isReady) && 
    !hasActiveStep && 
    hasReadyStep;

  const handleStart = () => {
    pillar?.startPlan();
  };

  const handleResume = async () => {
    // Manually trigger execution of next step
    debug.log('[PlanView] Manual resume triggered');
    await pillar?.resumePlan();
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

  const handleInlineConfirm = (stepId: string, data?: Record<string, unknown>) => {
    pillar?.confirmInlinePlanStep(stepId, data);
  };

  return (
    <div class="pillar-plan">
      {/* Plan goal as simple text */}
      <div class="pillar-plan__goal">{plan.goal}</div>

      {/* Plan document/approach shown as regular text */}
      {plan.document && (
        <div class="pillar-plan__approach">
          <PreactMarkdown content={plan.document} />
        </div>
      )}

      {/* Stuck warning */}
      {isStuck && (
        <div class="pillar-plan__warning">
          Plan execution may be stuck. Click Resume to continue.
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
            onInlineConfirm={handleInlineConfirm}
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
        {isStuck && (
          <button
            type="button"
            class="pillar-plan__start-btn"
            onClick={handleResume}
          >
            Resume
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
/* Plan Container - minimal, chat-native styling */
.pillar-plan {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 4px 0;
}

/* Plan goal - simple text styling */
.pillar-plan__goal {
  font-size: 14px;
  font-weight: 500;
  color: var(--pillar-text-primary, #1a1a1a);
  line-height: 1.4;
}

/* Approach text - simple inline text, not collapsible */
.pillar-plan__approach {
  font-size: 13px;
  line-height: 1.5;
  color: var(--pillar-text-secondary, #6b7280);
  margin-bottom: 4px;
}

.pillar-plan__approach p {
  margin: 0 0 4px 0;
}

.pillar-plan__approach p:last-child {
  margin-bottom: 0;
}

/* Steps List */
.pillar-plan__steps {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* Footer - minimal */
.pillar-plan__footer {
  display: flex;
  justify-content: flex-start;
  gap: 8px;
  margin-top: 4px;
}

/* Start Button */
.pillar-plan__start-btn {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  font-family: inherit;
  background: var(--pillar-primary, #2563eb);
  color: #ffffff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.pillar-plan__start-btn:hover {
  background: var(--pillar-primary-hover, #1d4ed8);
}

/* Cancel Button - text-only style */
.pillar-plan__cancel-btn {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  font-family: inherit;
  background: transparent;
  color: var(--pillar-text-tertiary, #9ca3af);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.pillar-plan__cancel-btn:hover {
  color: var(--pillar-danger, #dc2626);
  background: var(--pillar-bg-tertiary, #f3f4f6);
}

/* Warning Message */
.pillar-plan__warning {
  padding: 8px 12px;
  font-size: 12px;
  color: var(--pillar-warning-text, #92400e);
  background: var(--pillar-warning-bg, #fef3c7);
  border: 1px solid var(--pillar-warning-border, #fcd34d);
  border-radius: 6px;
}
`;
