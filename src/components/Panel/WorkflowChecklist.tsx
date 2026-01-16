/**
 * WorkflowChecklist Component
 * 
 * Renders an active workflow as an interactive checklist.
 * Shows progress, step status, and action buttons.
 */

import { h, Fragment } from 'preact';
import { useComputed, useSignal } from '@preact/signals';
import {
  activeWorkflow,
  completedStepsCount,
} from '../../store/workflow';
import type { WorkflowStep, WorkflowStepStatus } from '../../core/workflow';
import Pillar from '../../core/Pillar';

// ============================================================================
// Icons
// ============================================================================

const ICONS = {
  pending: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`,
  awaiting: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>`,
  active: `<svg class="pillar-workflow-step__spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>`,
  completed: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="9,12 12,15 16,10"/></svg>`,
  skipped: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" stroke-dasharray="4,2"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`,
  failed: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  workflow: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
};

function getStatusIcon(status: WorkflowStepStatus): string {
  switch (status) {
    case 'pending':
      return ICONS.pending;
    case 'awaiting_initiation':
      return ICONS.awaiting;
    case 'active':
      return ICONS.active;
    case 'completed':
      return ICONS.completed;
    case 'skipped':
      return ICONS.skipped;
    case 'failed':
      return ICONS.failed;
    default:
      return ICONS.pending;
  }
}

// ============================================================================
// WorkflowStep Component
// ============================================================================

interface WorkflowStepItemProps {
  step: WorkflowStep;
  isCurrentStep: boolean;
}

function WorkflowStepItem({ step, isCurrentStep }: WorkflowStepItemProps) {
  const handleStart = () => {
    const pillar = Pillar.getInstance();
    if (pillar) {
      pillar.initiateWorkflowStep(step.index);
    }
  };

  const handleSkip = () => {
    const pillar = Pillar.getInstance();
    if (pillar) {
      pillar.skipWorkflowStep(step.index);
    }
  };

  const statusClass = `pillar-workflow-step pillar-workflow-step--${step.status}`;

  return (
    <div class={statusClass}>
      <div class="pillar-workflow-step__icon">
        <span dangerouslySetInnerHTML={{ __html: getStatusIcon(step.status) }} />
      </div>
      <div class="pillar-workflow-step__content">
        <div class="pillar-workflow-step__label">{step.label}</div>
        {step.note && (
          <div class="pillar-workflow-step__note">{step.note}</div>
        )}
        {step.status === 'awaiting_initiation' && (
          <div class="pillar-workflow-step__actions">
            <button
              type="button"
              class="pillar-workflow-step__start-btn"
              onClick={handleStart}
            >
              Start
            </button>
            <button
              type="button"
              class="pillar-workflow-step__skip-btn"
              onClick={handleSkip}
            >
              Skip
            </button>
          </div>
        )}
        {step.status === 'active' && (
          <div class="pillar-workflow-step__status-text">Running...</div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// WorkflowChecklist Component
// ============================================================================

export function WorkflowChecklist() {
  const workflow = activeWorkflow.value;

  if (!workflow) {
    return null;
  }

  const handleCancel = () => {
    const pillar = Pillar.getInstance();
    if (pillar) {
      pillar.cancelWorkflow();
    }
  };

  const completed = completedStepsCount.value;
  const total = workflow.total_steps;

  return (
    <div class="pillar-workflow">
      <div class="pillar-workflow__header">
        <div class="pillar-workflow__icon">
          <span dangerouslySetInnerHTML={{ __html: ICONS.workflow }} />
        </div>
        <div class="pillar-workflow__title">{workflow.title}</div>
        <div class="pillar-workflow__progress">
          {completed}/{total}
        </div>
      </div>

      {workflow.description && (
        <div class="pillar-workflow__description">{workflow.description}</div>
      )}

      <div class="pillar-workflow__steps">
        {workflow.steps.map((step, idx) => (
          <WorkflowStepItem
            key={`${workflow.id}-step-${step.index}`}
            step={step}
            isCurrentStep={idx === workflow.current_step}
          />
        ))}
      </div>

      <div class="pillar-workflow__footer">
        <button
          type="button"
          class="pillar-workflow__cancel-btn"
          onClick={handleCancel}
        >
          Cancel workflow
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Styles
// ============================================================================

export const WORKFLOW_STYLES = `
/* Workflow Checklist Container */
.pillar-workflow {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  margin: 12px 0;
}

/* Header */
.pillar-workflow__header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pillar-workflow__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
}

.pillar-workflow__title {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
}

.pillar-workflow__progress {
  font-size: 12px;
  font-weight: 500;
  color: #6b7280;
  padding: 2px 8px;
  background: #e5e7eb;
  border-radius: 10px;
}

.pillar-workflow__description {
  font-size: 13px;
  color: #6b7280;
}

/* Steps List */
.pillar-workflow__steps {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* Individual Step */
.pillar-workflow-step {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  transition: all 0.15s ease;
}

.pillar-workflow-step__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  color: #9ca3af;
}

.pillar-workflow-step__icon svg {
  width: 18px;
  height: 18px;
}

.pillar-workflow-step__content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pillar-workflow-step__label {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
}

.pillar-workflow-step__note {
  font-size: 12px;
  color: #9ca3af;
}

.pillar-workflow-step__status-text {
  font-size: 12px;
  color: #2563eb;
  font-style: italic;
}

.pillar-workflow-step__actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

/* Step States */
.pillar-workflow-step--pending {
  opacity: 0.6;
}

.pillar-workflow-step--awaiting_initiation {
  background: #fef3c7;
  border-color: #fcd34d;
}

.pillar-workflow-step--awaiting_initiation .pillar-workflow-step__icon {
  color: #d97706;
}

.pillar-workflow-step--active {
  background: #eff6ff;
  border-color: #93c5fd;
}

.pillar-workflow-step--active .pillar-workflow-step__icon {
  color: #2563eb;
}

.pillar-workflow-step--completed .pillar-workflow-step__icon {
  color: #059669;
}

.pillar-workflow-step--completed .pillar-workflow-step__label {
  text-decoration: line-through;
  color: #6b7280;
}

.pillar-workflow-step--skipped {
  opacity: 0.5;
}

.pillar-workflow-step--skipped .pillar-workflow-step__icon {
  color: #9ca3af;
}

.pillar-workflow-step--skipped .pillar-workflow-step__label {
  text-decoration: line-through;
  color: #9ca3af;
}

.pillar-workflow-step--failed {
  background: #fef2f2;
  border-color: #fca5a5;
}

.pillar-workflow-step--failed .pillar-workflow-step__icon {
  color: #dc2626;
}

/* Start Button */
.pillar-workflow-step__start-btn {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  background: #2563eb;
  color: #ffffff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.pillar-workflow-step__start-btn:hover {
  background: #1d4ed8;
}

/* Skip Button */
.pillar-workflow-step__skip-btn {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  font-family: inherit;
  background: transparent;
  color: #6b7280;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.pillar-workflow-step__skip-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

/* Spinner Animation for Active Step */
@keyframes pillar-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.pillar-workflow-step__spinner {
  animation: pillar-spin 1s linear infinite;
}

/* Footer */
.pillar-workflow__footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
  border-top: 1px solid #e5e7eb;
}

.pillar-workflow__cancel-btn {
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  font-family: inherit;
  background: transparent;
  color: #9ca3af;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
}

.pillar-workflow__cancel-btn:hover {
  color: #dc2626;
}
`;

