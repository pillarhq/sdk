/**
 * PlanExecutor - Orchestrates execution of multi-step plans.
 *
 * Manages the execution lifecycle of server-generated execution plans:
 * - Receives plans from streaming events
 * - Executes steps using registered action handlers
 * - Sends results back to server when needed
 * - Handles user confirmations and cancellations
 * - Emits events for UI updates
 */

import type { ExecutionPlan, ExecutionStep } from './plan';
import type { EventEmitter } from './events';
import type { MCPClient } from '../api/mcp-client';
import { getActionDefinition, getHandler, hasAction } from '../actions/registry';
import {
  activePlan,
  updatePlan,
  updatePlanStep,
  clearPlan,
  setPlan,
} from '../store/plan';
import {
  savePlan,
  loadSavedPlan,
  clearSavedPlan,
} from '../store/plan-persistence';

export class PlanExecutor {
  private mcpClient: MCPClient;
  private events: EventEmitter;
  private siteId: string;

  constructor(mcpClient: MCPClient, events: EventEmitter, siteId: string) {
    this.mcpClient = mcpClient;
    this.events = events;
    this.siteId = siteId;
  }

  /**
   * Receive a new plan and start execution if auto_execute.
   *
   * Called when the ReAct agent creates a plan via the create_plan tool.
   */
  async handlePlanReceived(plan: ExecutionPlan): Promise<void> {
    console.log(`[PlanExecutor] Received plan ${plan.id} (auto_execute=${plan.auto_execute}, status=${plan.status})`);

    setPlan(plan);
    this.persistPlan(plan);

    // Auto-execute if plan is configured for it AND status indicates ready to run
    // Accept both 'executing' and 'ready' status for robustness
    const shouldAutoExecute = plan.auto_execute && 
      ['executing', 'ready'].includes(plan.status);

    if (shouldAutoExecute) {
      this.events.emit('plan:start', plan);
      await this.executeNextStep();
    }
    // If auto_execute=false (status='awaiting_start'), wait for startPlan() call
  }

  /**
   * Attempt to recover an active plan from localStorage.
   *
   * Called during SDK initialization to resume plans after page refresh.
   * Fetches latest state from server to ensure consistency.
   *
   * @returns The recovered plan or null if none found/invalid
   */
  async recoverPlan(): Promise<ExecutionPlan | null> {
    const savedPlan = loadSavedPlan(this.siteId);
    if (!savedPlan) {
      console.log('[PlanExecutor] No saved plan found');
      return null;
    }

    console.log(`[PlanExecutor] Found saved plan ${savedPlan.id}, fetching latest state from server`);

    try {
      // Fetch latest state from server
      const response = await this.mcpClient.getPlan(savedPlan.id);
      const latestPlan = response.plan;

      // Check if plan is still active
      const activeStatuses = ['planning', 'ready', 'executing', 'awaiting_start', 'awaiting_input', 'awaiting_result'];
      if (!activeStatuses.includes(latestPlan.status)) {
        console.log(
          `[PlanExecutor] Plan ${latestPlan.id} is no longer active (status: ${latestPlan.status}), clearing`
        );
        clearSavedPlan(this.siteId);
        return null;
      }

      // Restore the plan
      setPlan(latestPlan);
      this.events.emit('plan:updated', latestPlan);

      console.log(`[PlanExecutor] Recovered plan ${latestPlan.id} with status ${latestPlan.status}`);

      // If plan was executing, continue
      if (latestPlan.status === 'executing') {
        await this.executeNextStep();
      }

      return latestPlan;
    } catch (error) {
      console.error('[PlanExecutor] Failed to recover plan from server:', error);
      // Clear the stale saved plan
      clearSavedPlan(this.siteId);
      return null;
    }
  }

  /**
   * Persist the current plan to localStorage.
   */
  private persistPlan(plan: ExecutionPlan): void {
    savePlan(plan, this.siteId);
  }

  /**
   * User clicks "Start Plan" for plans with auto_execute=false.
   */
  async startPlan(): Promise<void> {
    const plan = activePlan.value;
    if (!plan) {
      console.warn('[PlanExecutor] No active plan to start');
      return;
    }

    if (plan.status !== 'awaiting_start') {
      console.warn(
        `[PlanExecutor] Plan ${plan.id} is not in awaiting_start status`
      );
      return;
    }

    try {
      const response = await this.mcpClient.startPlan(plan.id);
      updatePlan(response.plan);
      this.events.emit('plan:start', response.plan);
      await this.executeNextStep();
    } catch (error) {
      console.error('[PlanExecutor] Failed to start plan:', error);
      this.events.emit('plan:error', {
        plan,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  /**
   * Resume execution of a stuck plan.
   * 
   * This is a fallback method for when auto-execution fails or
   * the plan gets into an inconsistent state. It manually triggers
   * execution of the next ready step without requiring server confirmation.
   */
  async resumeExecution(): Promise<void> {
    const plan = activePlan.value;
    if (!plan) return;

    // Emit start event if not already started
    if (plan.status !== 'executing') {
      updatePlan({ ...plan, status: 'executing' });
      this.events.emit('plan:start', activePlan.value!);
    }

    await this.executeNextStep();
  }

  /**
   * Execute the next ready step.
   */
  private async executeNextStep(): Promise<void> {
    const plan = activePlan.value;
    if (!plan) return;

    // Find next step to execute - look for 'ready' status first
    let step = plan.steps.find((s) => s.status === 'ready');

    // If no ready step, check for steps awaiting confirmation
    if (!step) {
      step = plan.steps.find(
        (s) => s.status === 'awaiting_confirmation' && s.requires_user_confirmation
      );
    }

    if (!step) {
      // No more steps to execute - check if plan is complete
      const allDone = plan.steps.every(
        (s) =>
          s.status === 'completed' ||
          s.status === 'skipped' ||
          s.status === 'failed'
      );

      if (allDone) {
        console.log(`[PlanExecutor] Plan ${plan.id} complete`);
        updatePlan({ ...plan, status: 'completed' });
        this.events.emit('plan:complete', activePlan.value!);
        clearSavedPlan(this.siteId);
      }
      return;
    }

    // If step needs confirmation, wait for user
    if (step.requires_user_confirmation && step.status !== 'awaiting_confirmation') {
      updatePlanStep(step.id, { status: 'awaiting_confirmation' });
      this.events.emit('plan:step:confirm', { plan: activePlan.value!, step });
      return;
    }

    // If step is awaiting confirmation, wait for confirmStep()
    if (step.status === 'awaiting_confirmation') {
      return;
    }

    // For inline_ui actions, stay in 'ready' and let the UI render the card
    const actionType = (step as unknown as { action_type?: string }).action_type;
    if (actionType === 'inline_ui' && step.status === 'ready') {
      this.events.emit('plan:step:active', { plan: activePlan.value!, step });
      return;
    }

    // Execute the step
    await this.executeStep(step);
  }

  /**
   * User confirms a step requiring confirmation.
   *
   * @param stepId - UUID of the step to confirm
   * @param modifiedData - Optional modified data from user input
   */
  async confirmStep(
    stepId: string,
    modifiedData?: Record<string, unknown>
  ): Promise<void> {
    const plan = activePlan.value;
    if (!plan) return;

    const step = plan.steps.find((s) => s.id === stepId);
    if (!step) {
      console.warn(`[PlanExecutor] Step ${stepId} not found`);
      return;
    }

    // Merge modified data if provided
    if (modifiedData) {
      updatePlanStep(stepId, {
        action_data: { ...step.action_data, ...modifiedData },
      });
    }

    // Get the updated step
    const updatedPlan = activePlan.value;
    const updatedStep = updatedPlan?.steps.find((s) => s.id === stepId);
    if (!updatedStep) return;

    await this.executeStep(updatedStep);
  }

  /**
   * User confirms an inline_ui step via the inline card.
   * 
   * This is called when an inline_ui card completes its work (e.g., after
   * making an API call, filling a form, etc.). The card has already done
   * the action - this just marks the step as complete and advances the plan.
   *
   * @param stepId - UUID of the step to confirm
   * @param data - Result data from the inline card (e.g., email address, form fields)
   */
  async confirmInlineStep(
    stepId: string,
    data?: Record<string, unknown>
  ): Promise<void> {
    const plan = activePlan.value;
    if (!plan) {
      console.warn('[PlanExecutor] No active plan for inline confirmation');
      return;
    }

    const step = plan.steps.find((s) => s.id === stepId);
    if (!step) {
      console.warn(`[PlanExecutor] Step ${stepId} not found`);
      return;
    }

    // Report completion to server with the confirmation data
    // This allows the server to analyze the result (e.g., selected datasource)
    // and update subsequent steps with the data (requires_result_feedback)
    await this.reportStepComplete(step, true, data, undefined);
  }

  /**
   * User skips a step.
   *
   * @param stepId - UUID of the step to skip
   */
  async skipStep(stepId: string): Promise<void> {
    const plan = activePlan.value;
    if (!plan) return;

    const step = plan.steps.find((s) => s.id === stepId);
    if (!step) {
      console.warn(`[PlanExecutor] Step ${stepId} not found`);
      return;
    }

    try {
      // Notify server about skip
      const response = await this.mcpClient.skipStep(plan.id, stepId);
      updatePlan(response.plan);
      this.events.emit('plan:step:skip', { plan: response.plan, step });

      // Continue to next step
      await this.executeNextStep();
    } catch (error) {
      console.error('[PlanExecutor] Failed to skip step:', error);
      // Update locally even if server call fails
      updatePlanStep(stepId, { status: 'skipped' });
      
      // Activate the next pending step so executeNextStep can find it
      const nextStepIndex = step.index + 1;
      const updatedPlan = activePlan.value;
      if (updatedPlan && nextStepIndex < updatedPlan.steps.length) {
        const nextStep = updatedPlan.steps[nextStepIndex];
        if (nextStep.status === 'pending') {
          updatePlanStep(nextStep.id, { status: 'ready' });
        }
      }
      
      this.events.emit('plan:step:skip', { plan: activePlan.value!, step });
      await this.executeNextStep();
    }
  }

  /**
   * Retry a failed step.
   *
   * @param stepId - UUID of the step to retry
   */
  async retryStep(stepId: string): Promise<void> {
    const plan = activePlan.value;
    if (!plan) return;

    const step = plan.steps.find((s) => s.id === stepId);
    if (!step) {
      console.warn(`[PlanExecutor] Step ${stepId} not found`);
      return;
    }

    if (!step.is_retriable) {
      console.warn(`[PlanExecutor] Step ${stepId} is not retriable`);
      return;
    }

    if (step.retry_count >= step.max_retries) {
      console.warn(
        `[PlanExecutor] Step ${stepId} has exceeded max retries (${step.retry_count}/${step.max_retries})`
      );
      return;
    }

    try {
      // Notify server about retry
      const response = await this.mcpClient.retryStep(plan.id, stepId);
      updatePlan(response.plan);

      const updatedStep = response.plan.steps.find((s) => s.id === stepId);
      this.events.emit('plan:step:retry', {
        plan: response.plan,
        step: updatedStep || step,
        retryCount: updatedStep?.retry_count || step.retry_count + 1,
      });

      // Execute the step again
      await this.executeNextStep();
    } catch (error) {
      console.error('[PlanExecutor] Failed to retry step:', error);
      this.events.emit('plan:error', {
        plan: activePlan.value!,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  /**
   * Cancel the active plan.
   */
  async cancel(): Promise<void> {
    const plan = activePlan.value;
    if (!plan) {
      console.warn('[PlanExecutor] No active plan to cancel');
      return;
    }

    try {
      const response = await this.mcpClient.cancelPlan(plan.id);
      updatePlan(response.plan);
      this.events.emit('plan:cancel', response.plan);
      clearPlan(true);
      clearSavedPlan(this.siteId);
    } catch (error) {
      console.error('[PlanExecutor] Failed to cancel plan:', error);
      // Still clear locally even if server call fails
      this.events.emit('plan:cancel', plan);
      clearPlan(true);
      clearSavedPlan(this.siteId);
    }
  }

  /**
   * Dismiss a completed plan from the UI.
   * 
   * Called when user wants to close a plan that's in 'completed' status.
   * Unlike cancel(), this doesn't notify the server since the plan is already done.
   */
  dismissPlan(): void {
    const plan = activePlan.value;
    if (!plan) {
      console.warn('[PlanExecutor] No active plan to dismiss');
      return;
    }

    if (plan.status !== 'completed' && plan.status !== 'failed') {
      console.warn(`[PlanExecutor] Plan ${plan.id} is not completed/failed (status: ${plan.status}), use cancel() instead`);
      return;
    }

    // Use plan:complete event (plan:dismissed isn't in PillarEvents)
    this.events.emit('plan:complete', plan);
    clearPlan(true);
  }

  /**
   * Complete a plan step by action name.
   * 
   * Used by host apps when a wizard/flow completes (e.g., after user finishes
   * adding a knowledge source). The step must be in 'awaiting_result' status.
   * 
   * @param actionName - The action name (e.g., 'add_new_source')
   * @param success - Whether the action completed successfully
   * @param data - Optional result data
   */
  async completeStepByAction(
    actionName: string,
    success: boolean = true,
    data?: Record<string, unknown>
  ): Promise<void> {
    const plan = activePlan.value;
    if (!plan) {
      // No active plan - this is fine, action was standalone
      return;
    }

    // Find the step by action name that's awaiting result
    const step = plan.steps.find(
      (s) => s.action_name === actionName && s.status === 'awaiting_result'
    );

    if (!step) {
      // No active plan step waiting for this action - that's fine, it was standalone
      return;
    }

    if (success) {
      await this.markStepComplete(step.id, data);
    } else {
      // Mark step failed
      updatePlanStep(step.id, { status: 'failed', result: { error: 'Action failed by host app' } });

      this.events.emit('plan:step:failed', {
        plan: activePlan.value!,
        step: activePlan.value!.steps.find((s) => s.id === step.id)!,
        error: new Error('Action failed by host app'),
        canRetry: step.is_retriable,
      });
    }
  }

  /**
   * Mark a step as done by step ID.
   * 
   * Called by UI when user clicks "Done" button for a wizard step.
   * The step must be in 'awaiting_result' status.
   * 
   * @param stepId - UUID of the step to mark done
   */
  async markStepDone(stepId: string): Promise<void> {
    const plan = activePlan.value;
    if (!plan) {
      console.warn('[PlanExecutor] No active plan');
      return;
    }

    const step = plan.steps.find((s) => s.id === stepId);
    if (!step) {
      console.warn(`[PlanExecutor] Step ${stepId} not found`);
      return;
    }

    if (step.status !== 'awaiting_result') {
      console.warn(`[PlanExecutor] Step ${stepId} is not awaiting result (status: ${step.status})`);
      return;
    }

    await this.markStepComplete(stepId);
  }

  /**
   * Internal helper to mark a step complete and advance to next.
   */
  private async markStepComplete(stepId: string, data?: Record<string, unknown>): Promise<void> {
    updatePlanStep(stepId, { status: 'completed', result: data });

    const updatedPlan = activePlan.value!;
    const updatedStep = updatedPlan.steps.find((s) => s.id === stepId)!;

    // Activate the next pending step so executeNextStep can find it
    const nextStepIndex = updatedStep.index + 1;
    if (nextStepIndex < updatedPlan.steps.length) {
      const nextStep = updatedPlan.steps[nextStepIndex];
      if (nextStep.status === 'pending') {
        updatePlanStep(nextStep.id, { status: 'ready' });
      }
    }

    this.events.emit('plan:step:complete', {
      plan: activePlan.value!,
      step: updatedStep,
      success: true,
    });

    await this.executeNextStep();
  }

  /**
   * Execute a single step.
   */
  private async executeStep(step: ExecutionStep): Promise<void> {
    const plan = activePlan.value;
    if (!plan) return;

    // Handle guidance steps - they don't execute, just get acknowledged
    if (step.step_type === 'guidance') {
      // Mark as completed immediately (user acknowledges by viewing)
      updatePlanStep(step.id, { status: 'completed' });
      
      const updatedPlan = activePlan.value!;
      const updatedStep = updatedPlan.steps.find((s) => s.id === step.id)!;
      
      // Activate the next pending step
      const nextStepIndex = step.index + 1;
      if (nextStepIndex < updatedPlan.steps.length) {
        const nextStep = updatedPlan.steps[nextStepIndex];
        if (nextStep.status === 'pending') {
          updatePlanStep(nextStep.id, { status: 'ready' });
        }
      }
      
      this.events.emit('plan:step:complete', {
        plan: activePlan.value!,
        step: updatedStep,
        success: true,
      });
      
      // Continue to next step
      await this.executeNextStep();
      return;
    }

    const actionName = step.action_name || 'unknown';

    updatePlanStep(step.id, { status: 'executing' });
    this.events.emit('plan:step:active', { plan: activePlan.value!, step });

    try {
      // Get Pillar instance for handler lookup
      const { default: Pillar } = await import('./Pillar');
      const pillar = Pillar.getInstance();
      
      // Get action definition for metadata (returns data flag, etc.)
      const actionDefinition = actionName && hasAction(actionName) ? getActionDefinition(actionName) : undefined;
      
      // Get handler using unified lookup (checks code-first registry + onTask handlers)
      // This is the key fix: handlers registered via onTask() are now found
      const handler = pillar?.getHandler(actionName);
      
      // Also check runtime-registered actions for metadata
      const runtimeAction = pillar?.getRegisteredAction(actionName);
      const actionReturnsData = actionDefinition?.returns || runtimeAction?.returns;
      
      // Extract action type for wizard detection (needed for auto_complete logic below)
      const actionType = (step as unknown as { action_type?: string }).action_type as 
        'navigate' | 'open_modal' | 'fill_form' | 'trigger_action' | 'copy_text' | 'external_link' | 'start_tutorial' | 'inline_ui' | undefined;
      
      let result: unknown = undefined;
      
      if (handler) {
        result = await Promise.resolve(handler(step.action_data || {}));
        
        // If action returns data, send it back to the agent
        if (actionReturnsData && result !== undefined) {
          if (pillar) {
            pillar.sendActionResult(actionName, result);
          }
        }
      } else {
        // No handler found - use Pillar's executeTask for built-in fallbacks
        // (navigate, external_link, copy_text, etc.)
        if (pillar) {
          const path = step.action_data?.path as string | undefined;
          const externalUrl = step.action_data?.url as string | undefined;
          
          // executeTask has built-in handlers for navigate, external_link, etc.
          pillar.executeTask({
            id: step.id,
            name: actionName,
            taskType: actionType,
            path,
            externalUrl,
            data: step.action_data || {},
          });
          
          result = { executed: true, action: actionName };
        } else {
          throw new Error(`No handler for action: ${actionName} (Pillar not initialized)`);
        }
      }

      // Check if this is a wizard action that needs to wait for user completion
      const usedFallback = !handler;
      const isWizardAction = actionType === 'navigate' || actionType === 'open_modal';
      
      if (usedFallback && isWizardAction && !step.auto_complete) {
        // Wizard actions wait for user to complete the flow
        updatePlanStep(step.id, { status: 'awaiting_result', result });
        this.events.emit('plan:step:active', { plan: activePlan.value!, step });
        // Don't advance - wait for completePlanStep() or markStepDone() to be called
        return;
      }
      
      // STEP-BY-STEP VERIFICATION: Report success to server
      await this.reportStepComplete(step, true, result, undefined);
      
    } catch (error) {
      console.error(
        `[PlanExecutor] Step ${step.index} failed:`,
        error
      );

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // STEP-BY-STEP VERIFICATION: Report failure to server
      await this.reportStepComplete(step, false, undefined, errorMessage);
    }
  }

  /**
   * Report step completion to server and handle the decision.
   * 
   * This is the core of step-by-step verification:
   * - Every step reports its result (success or failure)
   * - Server decides what to do next
   * - SDK executes the decision
   */
  private async reportStepComplete(
    step: ExecutionStep,
    success: boolean,
    result: unknown,
    errorMessage?: string
  ): Promise<void> {
    const plan = activePlan.value;
    if (!plan) {
      console.warn('[PlanExecutor] No active plan for step completion');
      return;
    }

    try {
      const response = await this.mcpClient.stepComplete(
        plan.id,
        step.id,
        success,
        result,
        errorMessage
      );

      // Handle the server's decision
      await this.handleServerDecision(step, response, success, errorMessage);
    } catch (serverError) {
      console.error('[PlanExecutor] Failed to report step completion:', serverError);
      
      // Fallback: handle locally
      if (success) {
        // Mark complete and try to advance
        updatePlanStep(step.id, { status: 'completed', result });
        this.events.emit('plan:step:complete', {
          plan: activePlan.value!,
          step,
          success: true,
        });
        await this.executeNextStep();
      } else {
        // Mark failed
        updatePlanStep(step.id, {
          status: 'failed',
          error_message: errorMessage || 'Unknown error',
        });
        this.events.emit('plan:step:failed', {
          plan: activePlan.value!,
          step,
          error: new Error(errorMessage || 'Unknown error'),
          canRetry: false,
        });
        this.events.emit('plan:error', {
          plan: activePlan.value!,
          error: new Error(errorMessage || 'Unknown error'),
        });
      }
    }
  }

  /**
   * Handle the server's decision after step completion.
   */
  private async handleServerDecision(
    step: ExecutionStep,
    response: import('../api/mcp-client').StepCompleteResponse,
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    const { action, plan: updatedPlan, retry_step_id, message } = response;

    // Update local plan state
    updatePlan(updatedPlan);
    this.events.emit('plan:updated', updatedPlan);

    switch (action) {
      case 'proceed':
        // Step succeeded, move to next step
        this.events.emit('plan:step:complete', {
          plan: updatedPlan,
          step: updatedPlan.steps.find(s => s.id === step.id) || step,
          success: true,
        });
        await this.executeNextStep();
        break;

      case 'modify_step':
        // Server modified the next step, proceed
        this.events.emit('plan:step:complete', {
          plan: updatedPlan,
          step: updatedPlan.steps.find(s => s.id === step.id) || step,
          success: true,
        });
        await this.executeNextStep();
        break;

      case 'retry':
        // Server wants us to retry the step with modified params
        const retryStep = updatedPlan.steps.find(s => s.id === (retry_step_id || step.id));
        if (retryStep) {
          this.events.emit('plan:step:retry', {
            plan: updatedPlan,
            step: retryStep,
            retryCount: retryStep.retry_count || 1,
          });
          await this.executeStep(retryStep);
        } else {
          console.error('[PlanExecutor] Retry step not found');
          await this.executeNextStep();
        }
        break;

      case 'end_plan':
        // Plan is complete (success or failure)
        if (updatedPlan.status === 'completed') {
          this.events.emit('plan:step:complete', {
            plan: updatedPlan,
            step: updatedPlan.steps.find(s => s.id === step.id) || step,
            success: true,
          });
          this.events.emit('plan:complete', updatedPlan);
          clearSavedPlan(this.siteId);
        } else {
          this.events.emit('plan:step:failed', {
            plan: updatedPlan,
            step: updatedPlan.steps.find(s => s.id === step.id) || step,
            error: new Error(message || errorMessage || 'Plan failed'),
            canRetry: false,
          });
          this.events.emit('plan:error', {
            plan: updatedPlan,
            error: new Error(message || errorMessage || 'Plan failed'),
          });
        }
        break;

      default:
        console.warn(`[PlanExecutor] Unknown server action: ${action}`);
        await this.executeNextStep();
    }
  }

  /**
   * Get the current active plan.
   */
  getActivePlan(): ExecutionPlan | null {
    return activePlan.value;
  }
}
