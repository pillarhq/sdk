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
import { getWorkflowStatusIcon, getWorkflowIcon } from '../shared/icons';

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
        <span dangerouslySetInnerHTML={{ __html: getWorkflowStatusIcon(step.status, 18, 'pillar-workflow-step__spinner') }} />
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
          <span dangerouslySetInnerHTML={{ __html: getWorkflowIcon(16) }} />
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
// Styles have been moved to workflow-checklist.css

