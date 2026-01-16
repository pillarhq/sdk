/**
 * Main Pillar SDK Class
 * Entry point for all SDK functionality
 */

import { getActionDefinition, getHandler, hasAction, setClientInfo } from '../actions';
import { APIClient } from '../api/client';
import { MCPClient } from '../api/mcp-client';
import { EdgeTrigger } from '../components/Button/EdgeTrigger';
import { Panel } from '../components/Panel/Panel';
import { TextSelectionManager } from '../components/TextSelection/TextSelectionManager';
import { resetChat } from '../store/chat';
import {
  resetContext,
  clearErrorState as storeClearErrorState,
  reportAction as storeReportAction,
  setErrorState as storeSetErrorState,
  setProductContext as storeSetProductContext,
  setUserProfile as storeSetUserProfile,
  updateContext as storeUpdateContext,
} from '../store/context';
import {
  isHoverMode,
  isOpen as panelIsOpen,
  resetPanel
} from '../store/panel';
import {
  activePlan,
  resetPlanStore,
} from '../store/plan';
import {
  resetRouter
} from '../store/router';
import {
  activeWorkflow,
  advanceToNextStep,
  resetWorkflow,
  cancelWorkflow as storeCancelWorkflow,
  completeWorkflow as storeCompleteWorkflow,
  startWorkflow as storeStartWorkflow,
  updateStepStatus
} from '../store/workflow';
import { domReady } from '../utils/dom';
import { clearPillarUrlParams, parsePillarUrlParams } from '../utils/urlParams';
import { resolveConfig, mergeServerConfig, type PillarConfig, type ResolvedConfig, type ThemeConfig } from './config';
import {
  DEFAULT_PRODUCT_CONTEXT,
  DEFAULT_USER_PROFILE,
  MAX_RECENT_ACTIONS,
  type ProductContext,
  type Suggestion,
  type UserProfile,
} from './context';
import { EventEmitter, type CardRenderer, type PillarEvents, type TaskExecutePayload } from './events';
import type { ExecutionPlan } from './plan';
import { PlanExecutor } from './plan-executor';
import type { Workflow, WorkflowStep } from './workflow';

export type PillarState = 'uninitialized' | 'initializing' | 'ready' | 'error';

export class Pillar {
  private static instance: Pillar | null = null;

  private _state: PillarState = 'uninitialized';
  private _config: ResolvedConfig | null = null;
  private _events: EventEmitter;
  private _api: APIClient | null = null;
  private _mcpClient: MCPClient | null = null;
  private _planExecutor: PlanExecutor | null = null;
  private _textSelectionManager: TextSelectionManager | null = null;
  private _panel: Panel | null = null;
  private _edgeTrigger: EdgeTrigger | null = null;
  private _initPromise: Promise<void> | null = null;
  private _rootContainer: HTMLElement | null = null;
  private _unsubscribeHoverMode: (() => void) | null = null;

  // Product context state
  private _productContext: ProductContext = { ...DEFAULT_PRODUCT_CONTEXT };
  private _userProfile: UserProfile = { ...DEFAULT_USER_PROFILE };

  // Task handlers
  private _taskHandlers: Map<string, (data: Record<string, unknown>) => void> = new Map();
  private _anyTaskHandler: ((name: string, data: Record<string, unknown>) => void) | null = null;

  // Card renderers for inline_ui type actions
  private _cardRenderers: Map<string, CardRenderer> = new Map();

  constructor() {
    this._events = new EventEmitter();
  }

  /**
   * Create or get the shared root container for all Pillar UI elements.
   * Uses isolation: isolate to create a new stacking context.
   * Z-index changes based on hover mode (999 in hover mode, -1 in push mode).
   */
  private _createRootContainer(): HTMLElement {
    // Check if container already exists
    let container = document.getElementById('pillar-root');
    if (container) {
      // Subscribe to hover mode changes to update z-index
      this._subscribeToHoverModeForRoot(container);
      return container;
    }

    // Create new container
    container = document.createElement('div');
    container.id = 'pillar-root';
    // Initial z-index based on current hover mode
    const initialZIndex = isHoverMode.value ? '20' : '-1';
    container.style.cssText = `isolation: isolate; z-index: ${initialZIndex}; position: relative;`;
    document.body.appendChild(container);
    
    // Subscribe to hover mode changes to update z-index
    this._subscribeToHoverModeForRoot(container);
    
    return container;
  }

  /**
   * Subscribe to hover mode changes and update root container z-index.
   */
  private _subscribeToHoverModeForRoot(container: HTMLElement): void {
    // Clean up existing subscription if any
    this._unsubscribeHoverMode?.();

    this._unsubscribeHoverMode = isHoverMode.subscribe((inHoverMode) => {
      // Use z-index 999 in hover mode to integrate with page,
      // -1 in push mode since panel handles its own stacking
      container.style.zIndex = inHoverMode ? '20' : '-1';
    });
  }

  // ============================================================================
  // Static Methods
  // ============================================================================

  /**
   * Initialize the Pillar SDK
   */
  static async init(config: PillarConfig): Promise<Pillar> {
    if (!config.helpCenter || !config.publicKey) {
      throw new Error('[Pillar] helpCenter and publicKey are required');
    }

    // Create singleton if doesn't exist
    if (!Pillar.instance) {
      Pillar.instance = new Pillar();
    }

    await Pillar.instance._init(config);
    return Pillar.instance;
  }

  /**
   * Get the current Pillar instance
   */
  static getInstance(): Pillar | null {
    return Pillar.instance;
  }

  /**
   * Destroy the Pillar instance
   */
  static destroy(): void {
    if (Pillar.instance) {
      Pillar.instance._destroy();
      Pillar.instance = null;
    }
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Current SDK state
   */
  get state(): PillarState {
    return this._state;
  }

  /**
   * Whether SDK is ready
   */
  get isReady(): boolean {
    return this._state === 'ready';
  }

  /**
   * Whether the panel is currently open
   */
  get isPanelOpen(): boolean {
    return panelIsOpen.value;
  }

  /**
   * Get the resolved configuration
   */
  get config(): ResolvedConfig | null {
    return this._config;
  }

  /**
   * Subscribe to SDK events
   */
  on<K extends keyof PillarEvents>(
    event: K,
    callback: (data: PillarEvents[K]) => void
  ): () => void {
    return this._events.on(event, callback);
  }

  /**
   * Open the help panel
   */
  open(options?: { view?: string; article?: string; search?: string; focusInput?: boolean }): void {
    if (!this._panel) return;

    this._panel.open(options);
    this._events.emit('panel:open');
  }

  /**
   * Close the help panel
   */
  close(): void {
    if (!this._panel) return;

    this._panel.close();
    this._events.emit('panel:close');
  }

  /**
   * Toggle the help panel
   */
  toggle(): void {
    if (this.isPanelOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Navigate to a specific view in the panel
   */
  navigate(view: string, params?: Record<string, string>): void {
    this._panel?.navigate(view, params);
    this._events.emit('panel:navigate', { view, params });
  }

  /**
   * Update the user context
   */
  setContext(context: ResolvedConfig['context']): void {
    if (this._config) {
      this._config.context = { ...this._config.context, ...context };
    }
  }

  /**
   * Update the theme at runtime.
   * Use this to sync with your app's theme (e.g., dark mode toggle).
   * 
   * @param theme - Partial theme config to merge with current theme
   * 
   * @example
   * // Switch to dark mode
   * pillar.setTheme({ mode: 'dark' });
   * 
   * // Switch to light mode with custom primary color
   * pillar.setTheme({ mode: 'light', colors: { primary: '#ff0000' } });
   * 
   * // Let system preference decide
   * pillar.setTheme({ mode: 'auto' });
   */
  setTheme(theme: Partial<ThemeConfig>): void {
    if (!this._config) return;

    // Update config
    this._config.theme = {
      ...this._config.theme,
      ...theme,
      mode: theme.mode ?? this._config.theme.mode,
      colors: { ...this._config.theme.colors, ...theme.colors },
      darkColors: { ...this._config.theme.darkColors, ...theme.darkColors },
    };

    // Update panel theme
    this._panel?.setTheme(this._config.theme);

    // Emit event
    this._events.emit('theme:change', { theme: this._config.theme });
  }

  /**
   * Enable or disable the text selection "Ask AI" popover at runtime.
   * 
   * @param enabled - Whether to show the popover when text is selected
   * 
   * @example
   * // Disable text selection popover
   * pillar.setTextSelectionEnabled(false);
   * 
   * // Re-enable it
   * pillar.setTextSelectionEnabled(true);
   */
  setTextSelectionEnabled(enabled: boolean): void {
    if (!this._config) return;

    const wasEnabled = this._config.textSelection.enabled;

    // No change needed
    if (wasEnabled === enabled) return;

    // Update config
    this._config.textSelection.enabled = enabled;

    if (enabled) {
      // Enable: initialize manager if panel is enabled
      if (this._config.panel.enabled && !this._textSelectionManager) {
        this._textSelectionManager = new TextSelectionManager(
          this._config,
          this._events,
          () => this.open()
        );
        this._textSelectionManager.init();
      }
    } else {
      // Disable: destroy manager if exists
      if (this._textSelectionManager) {
        this._textSelectionManager.destroy();
        this._textSelectionManager = null;
      }
    }

    // Emit event
    this._events.emit('textSelection:change', { enabled });
  }

  /**
   * Mount the panel to a specific container element.
   * Used for manual mounting mode (e.g., from React component).
   */
  mountPanelTo(container: HTMLElement): void {
    this._panel?.mountTo(container);
  }

  /**
   * Get the panel host element for external mounting
   */
  getPanelHostElement(): HTMLElement | null {
    return this._panel?.getHostElement() ?? null;
  }

  // ============================================================================
  // Product Context API
  // ============================================================================

  /**
   * Get the current product context
   */
  get productContext(): ProductContext {
    return { ...this._productContext };
  }

  /**
   * Get the current user profile
   */
  get userProfile(): UserProfile {
    return { ...this._userProfile };
  }

  /**
   * Set the complete product context.
   * Use this when navigating to a new page or starting a new session.
   */
  setProductContext(context: ProductContext): void {
    this._productContext = {
      ...context,
      recentActions: context.recentActions || [],
    };
    // Sync to store for components
    storeSetProductContext(this._productContext);
    this._events.emit('context:change', { context: this._productContext });
  }

  /**
   * Update specific product context fields without replacing the entire context.
   * Use this for incremental updates like tracking actions.
   */
  updateContext(updates: Partial<ProductContext>): void {
    this._productContext = {
      ...this._productContext,
      ...updates,
    };
    // Sync to store for components
    storeUpdateContext(updates);
    this._events.emit('context:change', { context: this._productContext });
  }

  /**
   * Set the user profile for personalization.
   */
  setUserProfile(profile: UserProfile): void {
    this._userProfile = { ...profile };
    // Sync to store for components
    storeSetUserProfile(this._userProfile);
    this._events.emit('profile:change', { profile: this._userProfile });
  }

  /**
   * Report a user action for context building.
   * Recent actions are tracked and sent with chat requests for better context.
   * 
   * @param action - Description of the action (e.g., "clicked_upgrade", "viewed_invoice")
   * @param metadata - Optional metadata about the action
   */
  reportAction(action: string, metadata?: Record<string, unknown>): void {
    const recentActions = this._productContext.recentActions || [];
    
    // Keep only the most recent actions
    const updatedActions = [
      ...recentActions.slice(-(MAX_RECENT_ACTIONS - 1)),
      action,
    ];

    this._productContext = {
      ...this._productContext,
      recentActions: updatedActions,
    };

    // Sync to store for components
    storeReportAction(action);
    this._events.emit('action:report', { action, metadata });
  }

  /**
   * Clear any error state from the context.
   */
  clearErrorState(): void {
    if (this._productContext.errorState) {
      const { errorState: _, ...rest } = this._productContext;
      this._productContext = rest as ProductContext;
      // Sync to store for components
      storeClearErrorState();
      this._events.emit('context:change', { context: this._productContext });
    }
  }

  /**
   * Set an error state in the context.
   * The assistant will use this to provide relevant troubleshooting help.
   */
  setErrorState(code: string, message: string): void {
    this._productContext = {
      ...this._productContext,
      errorState: { code, message },
    };
    // Sync to store for components
    storeSetErrorState(code, message);
    this._events.emit('context:change', { context: this._productContext });
  }

  /**
   * Get contextual help suggestions based on current product context.
   * Returns relevant articles, videos, and actions.
   */
  async getSuggestions(): Promise<Suggestion[]> {
    if (!this._api) {
      console.warn('[Pillar] SDK not initialized, cannot get suggestions');
      return [];
    }

    try {
      return await this._api.getSuggestions(this._productContext, this._userProfile);
    } catch (error) {
      console.error('[Pillar] Failed to get suggestions:', error);
      return [];
    }
  }

  /**
   * Get the full context object to send to the backend.
   * Used internally by the API client.
   */
  getAssistantContext(): { product: ProductContext; user: UserProfile } {
    return {
      product: this._productContext,
      user: this._userProfile,
    };
  }

  // ============================================================================
  // Task API - AI-suggested actions
  // ============================================================================

  /**
   * Register a handler for a specific task.
   * Called when the AI suggests a task and the user clicks it.
   * 
   * @param taskName - The task identifier (e.g., 'invite_team_member')
   * @param handler - Function to handle the task execution
   * @returns Unsubscribe function
   * 
   * @example
   * pillar.onTask('invite_team_member', (data) => {
   *   openInviteModal(data);
   * });
   */
  onTask(taskName: string, handler: (data: Record<string, unknown>) => void): () => void {
    this._taskHandlers.set(taskName, handler);
    return () => this._taskHandlers.delete(taskName);
  }

  /**
   * Register a catch-all handler for any task.
   * Useful for logging, analytics, or handling unknown tasks.
   * 
   * @param handler - Function called with task name and data
   * @returns Unsubscribe function
   * 
   * @example
   * pillar.onAnyTask((name, data) => {
   *   analytics.track('task_executed', { name, data });
   * });
   */
  onAnyTask(handler: (name: string, data: Record<string, unknown>) => void): () => void {
    this._anyTaskHandler = handler;
    return () => { this._anyTaskHandler = null; };
  }

  /**
   * Remove a task handler.
   * 
   * @param taskName - The task identifier to stop handling
   */
  offTask(taskName: string): void {
    this._taskHandlers.delete(taskName);
  }

  /**
   * Execute a task programmatically.
   * This is called internally by the widget when a user clicks a task button.
   * Can also be called directly if you want to trigger a task.
   * 
   * @param payload - Task execution payload
   */
  executeTask(payload: TaskExecutePayload): void {
    const { name, data, taskType, path, externalUrl } = payload;

    // Emit the event for external listeners
    this._events.emit('task:execute', payload);

    // Call the any-task handler if registered
    if (this._anyTaskHandler) {
      try {
        this._anyTaskHandler(name, data);
      } catch (error) {
        console.error(`[Pillar] Error in onAnyTask handler:`, error);
      }
    }

    // Look for handlers in this order:
    // 1. Code-first action registry (via defineActions)
    // 2. Specific handler by action name (via onTask)
    // 3. Generic handler by task type (e.g., "navigate")
    // 4. Built-in handlers as fallback
    const actionDefinition = hasAction(name) ? getActionDefinition(name) : undefined;
    const registryHandler = actionDefinition?.handler;
    const specificHandler = this._taskHandlers.get(name);
    const typeHandler = taskType ? this._taskHandlers.get(taskType) : undefined;
    const handler = registryHandler || specificHandler || typeHandler;

    if (handler) {
      try {
        // Merge path into data for navigate handlers
        const handlerData = taskType === 'navigate' && path 
          ? { ...data, path } 
          : data;
        const result = handler(handlerData);
        
        // If action returns data, send it back to the agent
        if (actionDefinition?.returns && result !== undefined) {
          // Handle both sync and async handlers
          Promise.resolve(result).then((resolvedResult) => {
            if (resolvedResult !== undefined) {
              this.sendActionResult(name, resolvedResult);
            }
          }).catch((error) => {
            console.error(`[Pillar] Error in query action "${name}":`, error);
          });
        }
        
        this._events.emit('task:complete', { name, success: true, data });
      } catch (error) {
        console.error(`[Pillar] Error executing task "${name}":`, error);
        this._events.emit('task:complete', { name, success: false, data });
      }
    } else {
      // Handle built-in task types if no custom handler
      switch (taskType) {
        case 'navigate':
          if (path && typeof window !== 'undefined') {
            // Fallback to hard redirect only if no handler was registered
            console.warn(`[Pillar] No 'navigate' handler registered. Using window.location.href as fallback.`);
            window.location.href = path;
            this._events.emit('task:complete', { name, success: true, data });
          }
          break;
        case 'external_link':
          if (externalUrl && typeof window !== 'undefined') {
            window.open(externalUrl, '_blank', 'noopener,noreferrer');
            this._events.emit('task:complete', { name, success: true, data });
          }
          break;
        case 'copy_text':
          if (data.text && typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(String(data.text)).then(() => {
              this._events.emit('task:complete', { name, success: true, data });
            }).catch(() => {
              this._events.emit('task:complete', { name, success: false, data });
            });
          }
          break;
        default:
          console.warn(`[Pillar] No handler registered for task "${name}". Register one with pillar.onTask('${name}', handler) or defineActions()`);
          // Emit failure for unhandled tasks
          this._events.emit('task:complete', { name, success: false, data: { error: 'No handler registered' } });
      }
    }
  }

  /**
   * Mark a task as complete.
   * Call this after your task handler finishes successfully.
   * 
   * @param taskName - The task identifier
   * @param success - Whether the task completed successfully
   * @param data - Optional result data
   */
  completeTask(taskName: string, success: boolean = true, data?: Record<string, unknown>): void {
    this._events.emit('task:complete', { name: taskName, success, data });
  }

  /**
   * Confirm task execution result.
   * Call this after your task handler completes to report success/failure
   * back to Pillar for implementation status tracking.
   * 
   * @param taskId - The database UUID of the task (from task:execute event)
   * @param status - 'success' or 'failure'
   * @param details - Optional execution details
   * 
   * @example
   * pillar.on('task:execute', async (task) => {
   *   const startTime = Date.now();
   *   try {
   *     await performAction(task);
   *     pillar.confirmTaskExecution(task.id, 'success', {
   *       duration_ms: Date.now() - startTime,
   *     });
   *   } catch (error) {
   *     pillar.confirmTaskExecution(task.id, 'failure', {
   *       error: error.message,
   *       duration_ms: Date.now() - startTime,
   *     });
   *   }
   * });
   */
  confirmTaskExecution(
    taskId: string,
    status: 'success' | 'failure',
    details?: {
      error?: string;
      duration_ms?: number;
      [key: string]: unknown;
    }
  ): void {
    if (!taskId) {
      console.warn('[Pillar] confirmTaskExecution called without taskId');
      return;
    }

    if (!this._api) {
      console.warn('[Pillar] SDK not initialized, cannot confirm task execution');
      return;
    }

    // Fire-and-forget - don't block on response
    this._api.confirmTaskExecution(taskId, status, details);
  }

  // ============================================================================
  // Card Renderer API - Custom confirmation cards
  // ============================================================================

  /**
   * Register a custom card renderer for inline_ui type actions.
   * 
   * When the AI returns an action with action_type: 'inline_ui' and
   * a card_type in its data, the SDK will look for a registered renderer
   * and call it to render the inline UI card.
   * 
   * @param cardType - The card type identifier (e.g., 'invite_members')
   * @param renderer - Function that renders the card into a container
   * @returns Unsubscribe function
   * 
   * @example
   * // Vanilla JS
   * pillar.registerCard('invite_members', (container, data, callbacks) => {
   *   container.innerHTML = `
   *     <div class="invite-card">
   *       <h3>Invite Team Members</h3>
   *       ${data.emails.map(e => `<div>${e}</div>`).join('')}
   *       <button id="confirm">Send Invites</button>
   *     </div>
   *   `;
   *   container.querySelector('#confirm').onclick = callbacks.onConfirm;
   *   return () => container.innerHTML = ''; // cleanup
   * });
   */
  registerCard(cardType: string, renderer: CardRenderer): () => void {
    this._cardRenderers.set(cardType, renderer);
    return () => this._cardRenderers.delete(cardType);
  }

  /**
   * Get a registered card renderer by type.
   * Returns undefined if no renderer is registered for the given type.
   * 
   * @param cardType - The card type identifier
   */
  getCardRenderer(cardType: string): CardRenderer | undefined {
    return this._cardRenderers.get(cardType);
  }

  /**
   * Check if a card renderer is registered for a given type.
   * 
   * @param cardType - The card type identifier
   */
  hasCardRenderer(cardType: string): boolean {
    return this._cardRenderers.has(cardType);
  }

  // ============================================================================
  // Workflow API - Multi-step action sequences
  // ============================================================================

  /**
   * Get the active workflow, if any.
   */
  get workflow(): Workflow | null {
    return activeWorkflow.value;
  }

  /**
   * Start a workflow.
   * Called when the AI returns a workflow in its response.
   * 
   * @param workflow - The workflow to start
   */
  startWorkflow(workflow: Workflow): void {
    storeStartWorkflow(workflow);
    this._events.emit('workflow:start', activeWorkflow.value!);

    // Auto-execute first step if it has auto_run enabled
    const firstStep = activeWorkflow.value!.steps[0];
    if (firstStep.auto_run) {
      this._executeWorkflowStep(firstStep);
    }
    // Otherwise, UI shows "Start" button
  }

  /**
   * Initiate a workflow step that requires user confirmation.
   * Called when user clicks "Start" on a step with auto_run=false.
   * 
   * @param stepIndex - Optional step index (defaults to current)
   */
  initiateWorkflowStep(stepIndex?: number): void {
    const workflow = activeWorkflow.value;
    if (!workflow) {
      console.warn('[Pillar] No active workflow');
      return;
    }

    const idx = stepIndex ?? workflow.current_step;
    const step = workflow.steps[idx];

    if (!step) {
      console.warn(`[Pillar] Invalid step index: ${idx}`);
      return;
    }

    if (step.status !== 'awaiting_initiation') {
      console.warn(`[Pillar] Step ${idx} is not awaiting initiation`);
      return;
    }

    this._executeWorkflowStep(step);
  }

  /**
   * Confirm a workflow step as complete.
   * Called by the host app after the action is done.
   * Automatically advances to the next step.
   * 
   * @param success - Whether the step completed successfully
   * @param stepIndex - Optional step index (defaults to current)
   */
  confirmWorkflowStep(success: boolean, stepIndex?: number): void {
    const workflow = activeWorkflow.value;
    if (!workflow) return;

    const idx = stepIndex ?? workflow.current_step;
    const step = workflow.steps[idx];

    // Update step status
    updateStepStatus(idx, success ? 'completed' : 'failed');
    this._events.emit('workflow:step:complete', {
      workflow: activeWorkflow.value!,
      step: activeWorkflow.value!.steps[idx],
      success,
    });

    if (!success) {
      // Don't advance on failure
      return;
    }

    // Try to advance to next step
    const nextStep = advanceToNextStep();

    if (!nextStep) {
      // Workflow complete
      this._events.emit('workflow:complete', activeWorkflow.value!);
      storeCompleteWorkflow();
      return;
    }

    this._events.emit('workflow:step:active', {
      workflow: activeWorkflow.value!,
      step: nextStep,
    });

    // Auto-execute next step if it has auto_run enabled
    if (nextStep.auto_run) {
      this._executeWorkflowStep(nextStep);
    }
    // Otherwise, UI shows "Start" button for next step
  }

  /**
   * Skip a workflow step.
   * 
   * @param stepIndex - Optional step index (defaults to current)
   */
  skipWorkflowStep(stepIndex?: number): void {
    const workflow = activeWorkflow.value;
    if (!workflow) return;

    const idx = stepIndex ?? workflow.current_step;
    const step = workflow.steps[idx];

    updateStepStatus(idx, 'skipped');
    this._events.emit('workflow:step:skip', {
      workflow: activeWorkflow.value!,
      step: activeWorkflow.value!.steps[idx],
    });

    // Advance to next step
    const nextStep = advanceToNextStep();

    if (!nextStep) {
      // Workflow complete
      this._events.emit('workflow:complete', activeWorkflow.value!);
      storeCompleteWorkflow();
      return;
    }

    this._events.emit('workflow:step:active', {
      workflow: activeWorkflow.value!,
      step: nextStep,
    });

    // Auto-execute next step if it has auto_run enabled
    if (nextStep.auto_run) {
      this._executeWorkflowStep(nextStep);
    }
  }

  /**
   * Cancel the active workflow.
   */
  cancelWorkflow(): void {
    const workflow = activeWorkflow.value;
    if (!workflow) return;

    this._events.emit('workflow:cancel', workflow);
    storeCancelWorkflow();
  }

  /**
   * Execute a workflow step.
   * Internal method that runs the task and handles auto_complete.
   */
  private _executeWorkflowStep(step: WorkflowStep): void {
    updateStepStatus(step.index, 'active');

    // Execute the task
    this.executeTask({
      id: step.task_id,
      name: step.task_name,
      taskType: step.task_type,
      data: step.data,
      path: step.data?.path as string | undefined,
      externalUrl: step.data?.url as string | undefined,
    });

    // If auto_complete, immediately confirm
    if (step.auto_complete) {
      // Use setTimeout to allow the UI to update
      setTimeout(() => {
        this.confirmWorkflowStep(true, step.index);
      }, 100);
    }
    // Otherwise, wait for host app to call confirmWorkflowStep()
  }

  // ============================================================================
  // Plan API - Server-generated multi-step execution plans
  // ============================================================================

  /**
   * Get the active execution plan, if any.
   */
  get activePlan(): ExecutionPlan | null {
    return activePlan.value;
  }

  /**
   * Handle a plan received from the AI streaming response.
   * Called when the ReAct agent creates a plan via the create_plan tool.
   *
   * @param plan - The execution plan from the server
   */
  handlePlanReceived(plan: ExecutionPlan): void {
    this._planExecutor?.handlePlanReceived(plan);
  }

  /**
   * Start a plan that was waiting for user confirmation.
   * For plans with auto_execute=false, the user must explicitly start execution.
   */
  async startPlan(): Promise<void> {
    await this._planExecutor?.startPlan();
  }

  /**
   * Confirm a plan step requiring confirmation.
   *
   * @param stepId - UUID of the step to confirm
   * @param data - Optional modified data from user input
   */
  async confirmPlanStep(stepId: string, data?: Record<string, unknown>): Promise<void> {
    await this._planExecutor?.confirmStep(stepId, data);
  }

  /**
   * Skip a plan step.
   *
   * @param stepId - UUID of the step to skip
   */
  async skipPlanStep(stepId: string): Promise<void> {
    await this._planExecutor?.skipStep(stepId);
  }

  /**
   * Retry a failed step in the active plan.
   *
   * @param stepId - UUID of the step to retry
   */
  async retryPlanStep(stepId: string): Promise<void> {
    await this._planExecutor?.retryStep(stepId);
  }

  /**
   * Cancel the active plan.
   */
  async cancelPlan(): Promise<void> {
    await this._planExecutor?.cancel();
  }

  /**
   * Complete a plan step by action name.
   * 
   * Use this when the host app completes a wizard or flow that was started
   * by a plan step. The plan will advance to the next step.
   * 
   * @param actionName - The action name (e.g., 'add_new_source')
   * @param success - Whether the action completed successfully (default: true)
   * @param data - Optional result data
   * 
   * @example
   * // In your source creation success handler:
   * pillar.completePlanStepByAction('add_new_source');
   */
  async completePlanStepByAction(
    actionName: string,
    success: boolean = true,
    data?: Record<string, unknown>
  ): Promise<void> {
    await this._planExecutor?.completeStepByAction(actionName, success, data);
  }

  /**
   * Mark a plan step as done by step ID.
   * 
   * Use this when the UI "Done" button is clicked for a wizard step.
   * The step must be in 'awaiting_result' status.
   * 
   * @param stepId - UUID of the step to mark as done
   */
  async markPlanStepDone(stepId: string): Promise<void> {
    await this._planExecutor?.markStepDone(stepId);
  }

  // ============================================================================
  // Query Action API - Actions that return data to the agent
  // ============================================================================

  /**
   * Send action result back to the agent.
   * 
   * Called automatically for actions with `returns: true` after their
   * handler completes. The result is sent to the agent for further reasoning.
   * 
   * @param actionName - The name of the action that was executed
   * @param result - The result data to send back to the agent
   * @internal
   */
  sendActionResult(actionName: string, result: unknown): void {
    if (!this._mcpClient) {
      console.warn('[Pillar] SDK not initialized, cannot send action result');
      return;
    }

    this._mcpClient.sendActionResult(actionName, result);
    this._events.emit('action:result', { actionName, result });
  }

  // ============================================================================
  // Internal Methods
  // ============================================================================

  /**
   * Internal initialization
   */
  private async _init(config: PillarConfig): Promise<void> {
    // If already initializing, wait for it to complete
    if (this._state === 'initializing' && this._initPromise) {
      console.log('[Pillar] Already initializing, waiting for completion');
      await this._initPromise;
      return;
    }

    if (this._state === 'ready') {
      console.log('[Pillar] Already initialized');
      return;
    }

    this._state = 'initializing';

    // Create and store the init promise so other callers can wait
    this._initPromise = this._doInit(config);
    await this._initPromise;
  }

  /**
   * Actual initialization logic
   */
  private async _doInit(config: PillarConfig): Promise<void> {
    try {
      // Wait for DOM to be ready
      await domReady();

      // Create temporary API client to fetch server config
      // We need a minimal resolved config for the API client
      const tempConfig = resolveConfig(config);
      const tempApi = new APIClient(tempConfig);
      
      // Fetch server-side embed config (admin-configured settings)
      // This allows admins to change SDK behavior without requiring
      // customers to update their integration code
      const serverConfig = await tempApi.fetchEmbedConfig().catch((error) => {
        console.warn('[Pillar] Failed to fetch server config, using local config only:', error);
        return null;
      });
      
      // Merge configs with priority: DEFAULT_CONFIG < serverConfig < localConfig
      // Local config (passed to Pillar.init) always wins
      const mergedConfig = mergeServerConfig(config, serverConfig);
      
      // Resolve the merged configuration
      this._config = resolveConfig(mergedConfig);

      // Set client info for action registry (used for manifest generation)
      if (this._config.platform && this._config.version) {
        setClientInfo(this._config.platform, this._config.version);
      }

      // Initialize API client with the final merged config
      this._api = new APIClient(this._config);

      // Initialize MCP client and PlanExecutor for multi-step plans
      this._mcpClient = new MCPClient(this._config);
      this._planExecutor = new PlanExecutor(
        this._mcpClient,
        this._events,
        this._config.helpCenter // Use helpCenter (Pillar slug) for plan persistence - unique across all sites
      );

      // Create shared root container for all Pillar UI elements
      // Uses isolation: isolate to create a new stacking context
      this._rootContainer = this._createRootContainer();

      // Initialize panel if enabled
      if (this._config.panel.enabled) {
        this._panel = new Panel(this._config, this._api, this._events, this._rootContainer);
        await this._panel.init();
      }

      // Initialize edge trigger if enabled
      if (this._config.edgeTrigger.enabled) {
        this._edgeTrigger = new EdgeTrigger(this._config, () => this.toggle(), this._rootContainer);
        this._edgeTrigger.init();
      }

      // Initialize text selection "Ask AI" popover if enabled
      if (this._config.textSelection.enabled && this._config.panel.enabled) {
        this._textSelectionManager = new TextSelectionManager(
          this._config,
          this._events,
          () => this.open()
        );
        this._textSelectionManager.init();
      }

      this._state = 'ready';
      this._events.emit('ready');
      this._config.onReady?.();

      console.log('[Pillar] SDK initialized successfully');

      // Attempt to recover any active plan from localStorage
      await this._planExecutor?.recoverPlan();

      // Check URL params for auto-opening
      if (this._config.urlParams.enabled) {
        await this._handleUrlParams();
      }
    } catch (error) {
      this._state = 'error';
      const err = error instanceof Error ? error : new Error(String(error));
      this._events.emit('error', err);
      this._config?.onError?.(err);
      console.error('[Pillar] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Handle URL parameters for auto-opening the panel
   */
  private async _handleUrlParams(): Promise<void> {
    if (!this._config) return;

    const params = parsePillarUrlParams(this._config.urlParams.prefix);

    // Check for open param
    if (params.open) {
      this.open();
    } else {
      // No relevant params found
      return;
    }

    // Clear URL params after opening if configured
    if (this._config.urlParams.clearAfterOpen) {
      clearPillarUrlParams(this._config.urlParams.prefix);
    }
  }

  /**
   * Internal cleanup
   */
  private _destroy(): void {
    this._textSelectionManager?.destroy();
    this._panel?.destroy();
    this._edgeTrigger?.destroy();
    this._api?.cancelAllRequests();
    this._events.removeAllListeners();

    // Clean up hover mode subscription
    this._unsubscribeHoverMode?.();
    this._unsubscribeHoverMode = null;

    // Remove root container
    this._rootContainer?.remove();
    this._rootContainer = null;

    // Reset all stores
    resetPanel();
    resetRouter();
    resetChat();
    resetContext();
    resetWorkflow();
    resetPlanStore();

    // Reset internal context state
    this._productContext = { ...DEFAULT_PRODUCT_CONTEXT };
    this._userProfile = { ...DEFAULT_USER_PROFILE };

    // Clear task handlers
    this._taskHandlers.clear();
    this._anyTaskHandler = null;

    this._textSelectionManager = null;
    this._panel = null;
    this._edgeTrigger = null;
    this._api = null;
    this._mcpClient = null;
    this._planExecutor = null;
    this._config = null;
    this._state = 'uninitialized';

    console.log('[Pillar] SDK destroyed');
  }
}

// Export for script tag usage
export default Pillar;
