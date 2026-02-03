/**
 * Main Pillar SDK Class
 * Entry point for all SDK functionality
 */

import { getActionDefinition, hasAction, setClientInfo } from "../actions";
import { APIClient } from "../api/client";
import { EdgeTrigger } from "../components/Button/EdgeTrigger";
import { MobileTrigger } from "../components/Button/MobileTrigger";
import { Panel } from "../components/Panel/Panel";
import { TextSelectionManager } from "../components/TextSelection/TextSelectionManager";
import {
  conversationId as chatConversationId,
  messages as chatMessages,
  historyInvalidationCounter,
  resetChat,
} from "../store/chat";
import {
  resetContext,
  clearErrorState as storeClearErrorState,
  reportAction as storeReportAction,
  setContext as storeSetContext,
  setErrorState as storeSetErrorState,
  setUserProfile as storeSetUserProfile,
} from "../store/context";
import {
  isHoverMode,
  isOpen as panelIsOpen,
  resetPanel,
  setFullWidthBreakpoint,
  setMobileBreakpoint,
} from "../store/panel";
import { activePlan, resetPlanStore } from "../store/plan";
import { resetRouter } from "../store/router";
import {
  activeWorkflow,
  advanceToNextStep,
  resetWorkflow,
  cancelWorkflow as storeCancelWorkflow,
  completeWorkflow as storeCompleteWorkflow,
  startWorkflow as storeStartWorkflow,
  updateStepStatus,
} from "../store/workflow";
import { h, render } from "preact";
import { debug, setDebugMode, debugLog, isDebugEnabled } from "../utils/debug";
import { DebugPanel } from "../components/DebugPanel";
import { domReady } from "../utils/dom";
import { clearPillarUrlParams, parsePillarUrlParams } from "../utils/urlParams";
import {
  mergeServerConfig,
  resolveConfig,
  type PillarConfig,
  type ResolvedConfig,
  type ThemeConfig,
} from "./config";
import {
  DEFAULT_CONTEXT,
  DEFAULT_USER_PROFILE,
  MAX_RECENT_ACTIONS,
  type Context,
  type InternalContext,
  type Suggestion,
  type UserProfile,
} from "./context";
import {
  EventEmitter,
  type CardRenderer,
  type PillarEvents,
  type TaskExecutePayload,
} from "./events";
import type { ExecutionPlan } from "./plan";
import { PlanExecutor } from "./plan-executor";
import type { Workflow, WorkflowStep } from "./workflow";

export type PillarState = "uninitialized" | "initializing" | "ready" | "error";

/**
 * Chat context for escalation to human support.
 */
export interface ChatContext {
  /** Server-assigned thread ID, or null if not yet assigned */
  threadId: string | null;
  /** Messages in the conversation */
  messages: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}

export class Pillar {
  private static instance: Pillar | null = null;

  private _state: PillarState = "uninitialized";
  private _config: ResolvedConfig | null = null;
  private _events: EventEmitter;
  private _api: APIClient | null = null;
  private _planExecutor: PlanExecutor | null = null;
  private _textSelectionManager: TextSelectionManager | null = null;
  private _panel: Panel | null = null;
  private _edgeTrigger: EdgeTrigger | null = null;
  private _mobileTrigger: MobileTrigger | null = null;
  private _initPromise: Promise<void> | null = null;
  private _rootContainer: HTMLElement | null = null;
  private _unsubscribeHoverMode: (() => void) | null = null;

  // Context state (uses InternalContext to track recentActions internally)
  private _context: InternalContext = { ...DEFAULT_CONTEXT };
  private _userProfile: UserProfile = { ...DEFAULT_USER_PROFILE };

  // User identity (for cross-device conversation history)
  private _externalUserId: string | null = null;

  // Task handlers
  private _taskHandlers: Map<string, (data: Record<string, unknown>) => void> =
    new Map();
  private _anyTaskHandler:
    | ((name: string, data: Record<string, unknown>) => void)
    | null = null;

  // Registered actions (for demos and runtime registration)
  // Public property for demos to access (e.g., window.Pillar._registeredActions)
  public _registeredActions: Map<string, Record<string, unknown>> = new Map();

  // Card renderers for inline_ui type actions
  private _cardRenderers: Map<string, CardRenderer> = new Map();

  // Debug panel container
  private _debugPanelContainer: HTMLElement | null = null;

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
    let container = document.getElementById("pillar-root");
    if (container) {
      // Subscribe to hover mode changes to update z-index
      this._subscribeToHoverModeForRoot(container);
      return container;
    }

    // Create new container
    container = document.createElement("div");
    container.id = "pillar-root";
    // Initial z-index based on current hover mode
    const initialZIndex = isHoverMode.value ? "20" : "-1";
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
      container.style.zIndex = inHoverMode ? "20" : "-1";
    });
  }

  // ============================================================================
  // Static Methods
  // ============================================================================

  /**
   * Initialize the Pillar SDK
   */
  static async init(config: PillarConfig): Promise<Pillar> {
    if (!config.productKey) {
      throw new Error("[Pillar] productKey is required");
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
    return this._state === "ready";
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
   * Whether debug mode is enabled
   */
  get isDebugEnabled(): boolean {
    return this._config?.debug ?? false;
  }

  /**
   * Get debug log entries (for debug panel).
   * Returns empty array if debug mode is not enabled.
   */
  getDebugLog(): import('../utils/debug').DebugEntry[] {
    if (!this._config?.debug) return [];
    return debugLog.getEntries();
  }

  /**
   * Subscribe to debug log updates (for debug panel).
   * Returns unsubscribe function.
   */
  onDebugLog(callback: (entries: import('../utils/debug').DebugEntry[]) => void): () => void {
    return debugLog.subscribe(callback);
  }

  /**
   * Clear debug log entries.
   */
  clearDebugLog(): void {
    debugLog.clear();
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
  open(options?: {
    view?: string;
    article?: string;
    search?: string;
    focusInput?: boolean;
  }): void {
    if (!this._panel) return;

    this._panel.open(options);
    this._events.emit("panel:open");
  }

  /**
   * Close the help panel
   */
  close(): void {
    if (!this._panel) return;

    this._panel.close();
    this._events.emit("panel:close");
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
    this._events.emit("panel:navigate", { view, params });
  }

  /**
   * Set context for the assistant.
   * Use this to tell Pillar what the user is doing for smarter, more relevant assistance.
   *
   * @param ctx - Context fields to set (merges with existing context)
   *
   * @example
   * ```typescript
   * pillar.setContext({
   *   currentPage: '/settings/billing',
   *   currentFeature: 'Billing Settings',
   *   userRole: 'admin',
   * });
   * ```
   */
  setContext(ctx: Partial<Context>): void {
    this._context = {
      ...this._context,
      ...ctx,
    };
    // Sync to store for components
    storeSetContext(ctx);
    this._events.emit("context:change", { context: this._context });
  }

  /**
   * Get the current chat context (conversation ID and messages).
   * Useful for escalation to human support with conversation history.
   *
   * @returns Chat context with conversation ID and messages, or null if no conversation
   *
   * @example
   * // Get chat context for escalation
   * const context = pillar.getChatContext();
   * if (context) {
   *   const summary = context.messages
   *     .map(m => `${m.role}: ${m.content.slice(0, 100)}`)
   *     .join('\n');
   *   showIntercom(`Escalating from AI assistant:\n${summary}`);
   * }
   */
  getChatContext(): ChatContext | null {
    const messages = chatMessages.value;
    const currentConversationId = chatConversationId.value;

    if (messages.length === 0) {
      return null;
    }

    return {
      threadId: currentConversationId,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    };
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
    this._events.emit("theme:change", { theme: this._config.theme });
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
    this._events.emit("textSelection:change", { enabled });
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
  // Context API
  // ============================================================================

  /**
   * Get the current context
   */
  get context(): Context {
    return { ...this._context };
  }

  /**
   * Get the current user profile
   */
  get userProfile(): UserProfile {
    return { ...this._userProfile };
  }

  /**
   * Set the user profile for personalization.
   */
  setUserProfile(profile: UserProfile): void {
    this._userProfile = { ...profile };
    // Sync to store for components
    storeSetUserProfile(this._userProfile);
    this._events.emit("profile:change", { profile: this._userProfile });
  }

  /**
   * Identify the current user after login.
   *
   * Call this when a user logs into your application to:
   * - Link their anonymous conversation history to their account
   * - Enable cross-device conversation history retrieval
   * - Associate future conversations with their user ID
   *
   * @param userId - Your application's user ID for this user
   * @param profile - Optional user profile data (name, email, metadata)
   * @param options - Optional settings for the identify call
   * @param options.preserveConversation - If true, keeps the current conversation (default: false)
   *
   * @example
   * ```typescript
   * // When user logs in
   * await pillar.identify('user-123', {
   *   name: 'John Doe',
   *   email: 'john@example.com',
   * });
   *
   * // Keep current conversation when identifying
   * await pillar.identify('user-123', undefined, { preserveConversation: true });
   * ```
   */
  async identify(
    userId: string,
    profile?: {
      name?: string;
      email?: string;
      metadata?: Record<string, unknown>;
    },
    options?: { preserveConversation?: boolean }
  ): Promise<void> {
    if (!this._api) {
      debug.warn("[Pillar] SDK not initialized, cannot identify user");
      return;
    }

    if (!userId) {
      debug.warn("[Pillar] userId is required for identify()");
      return;
    }

    try {
      // Call backend to merge anonymous visitor with authenticated user
      await this._api.identify(userId, profile);

      // Store the external user ID for future requests
      this._externalUserId = userId;

      // Update user profile with the user ID
      this._userProfile = {
        ...this._userProfile,
        userId,
        ...(profile?.name && { name: profile.name }),
      };
      storeSetUserProfile(this._userProfile);

      // Notify the API client and MCP client of the identity change
      this._api.setExternalUserId(userId);

      // Reset current conversation unless preserveConversation is true
      if (!options?.preserveConversation) {
        resetChat();
      }

      // Invalidate conversation history cache - will refetch with authenticated user's history
      historyInvalidationCounter.value += 1;

      this._events.emit("user:identified", { userId, profile });
    } catch (error) {
      debug.error("[Pillar] Failed to identify user:", error);
      throw error;
    }
  }

  /**
   * Clear the user's identity (logout).
   *
   * Call this when a user logs out of your application.
   * Future conversations will be tracked anonymously until identify() is called again.
   *
   * Note: This does not delete existing conversations - they remain associated
   * with the user's account for future retrieval.
   *
   * @param options - Optional settings for the logout call
   * @param options.preserveConversation - If true, keeps the current conversation (default: false)
   *
   * @example
   * ```typescript
   * // When user logs out
   * pillar.logout();
   *
   * // Keep current conversation when logging out
   * pillar.logout({ preserveConversation: true });
   * ```
   */
  logout(options?: { preserveConversation?: boolean }): void {
    // Clear the external user ID
    this._externalUserId = null;

    // Reset user profile
    this._userProfile = { ...DEFAULT_USER_PROFILE };
    storeSetUserProfile(this._userProfile);

    // Notify the API client and MCP client to stop sending the external user ID
    this._api?.clearExternalUserId();

    // Reset current conversation unless preserveConversation is true
    if (!options?.preserveConversation) {
      resetChat();
    }

    // Invalidate conversation history cache - will refetch with visitor ID only
    historyInvalidationCounter.value += 1;

    this._events.emit("user:logout", {});
  }

  /**
   * Get the current external user ID (if identified).
   */
  get externalUserId(): string | null {
    return this._externalUserId;
  }

  /**
   * Whether the current user is identified (logged in).
   */
  get isIdentified(): boolean {
    return this._externalUserId !== null;
  }

  /**
   * Report a user action for context building.
   * Recent actions are tracked and sent with chat requests for better context.
   *
   * @param action - Description of the action (e.g., "clicked_upgrade", "viewed_invoice")
   * @param metadata - Optional metadata about the action
   */
  reportAction(action: string, metadata?: Record<string, unknown>): void {
    const recentActions = this._context.recentActions || [];

    // Keep only the most recent actions
    const updatedActions = [
      ...recentActions.slice(-(MAX_RECENT_ACTIONS - 1)),
      action,
    ];

    this._context = {
      ...this._context,
      recentActions: updatedActions,
    };

    // Sync to store for components
    storeReportAction(action);
    this._events.emit("action:report", { action, metadata });
  }

  /**
   * Clear any error state from the context.
   */
  clearErrorState(): void {
    if (this._context.errorState) {
      const { errorState: _, ...rest } = this._context;
      this._context = rest as InternalContext;
      // Sync to store for components
      storeClearErrorState();
      this._events.emit("context:change", { context: this._context });
    }
  }

  /**
   * Set an error state in the context.
   * The assistant will use this to provide relevant troubleshooting help.
   */
  setErrorState(code: string, message: string): void {
    this._context = {
      ...this._context,
      errorState: { code, message },
    };
    // Sync to store for components
    storeSetErrorState(code, message);
    this._events.emit("context:change", { context: this._context });
  }

  /**
   * Get contextual help suggestions based on current context.
   * Returns relevant articles, videos, and actions.
   */
  async getSuggestions(): Promise<Suggestion[]> {
    if (!this._api) {
      debug.warn("[Pillar] SDK not initialized, cannot get suggestions");
      return [];
    }

    try {
      return await this._api.getSuggestions(this._context, this._userProfile);
    } catch (error) {
      debug.error("[Pillar] Failed to get suggestions:", error);
      return [];
    }
  }

  /**
   * Get the full context object to send to the backend.
   * Used internally by the API client.
   */
  getAssistantContext(): { product: Context; user: UserProfile } {
    return {
      product: this._context,
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
  onTask(
    taskName: string,
    handler: (data: Record<string, unknown>) => void
  ): () => void {
    this._taskHandlers.set(taskName, handler);
    return () => this._taskHandlers.delete(taskName);
  }

  /**
   * Register an action definition at runtime.
   *
   * This is primarily for demos and development. In production, actions
   * should be synced via the `pillar-sync` CLI during CI/CD.
   *
   * The action definition is stored locally and can be used by `onTask`
   * handlers. For actions with `returnsData: true`, the handler's return
   * value is sent back to the agent.
   *
   * @param action - Action definition with name and properties
   *
   * @example
   * pillar.registerAction({
   *   name: 'list_datasets',
   *   description: 'List available datasets',
   *   type: 'query',
   *   returnsData: true,
   * });
   */
  registerAction(action: { name: string } & Record<string, unknown>): void {
    const { name, ...definition } = action;

    if (!name) {
      debug.warn("[Pillar] registerAction called without a name");
      return;
    }

    // Store the action definition
    this._registeredActions.set(name, {
      name,
      ...definition,
      // Normalize property names for consistency
      returns: definition.returnsData || definition.returns || false,
      autoRun: definition.autoRun ?? definition.auto_run ?? false,
      autoComplete: definition.autoComplete ?? definition.auto_complete ?? true,
    });

    debug.log(`[Pillar] Registered action: ${name}`);
  }

  /**
   * Get a registered action definition by name.
   *
   * @param name - Action name
   * @returns Action definition or undefined
   */
  getRegisteredAction(name: string): Record<string, unknown> | undefined {
    return this._registeredActions.get(name);
  }

  /**
   * Get handler for an action, checking all registration systems.
   *
   * Lookup order:
   * 1. Code-first action registry (synced via pillar-sync CLI) - handler in definition
   * 2. Task handlers (registered via onTask at runtime)
   *
   * This is the recommended pattern:
   * - Action definitions synced to server via CLI (so AI knows what's possible)
   * - Handlers registered at runtime via onTask (client-side execution)
   *
   * @param actionName - Action name to look up
   * @returns Handler function or undefined if not found
   *
   * @example
   * const handler = pillar.getHandler('list_datasources');
   * if (handler) {
   *   const result = await handler({ limit: 10 });
   * }
   */
  getHandler(
    actionName: string
  ): ((data: Record<string, unknown>) => unknown) | undefined {
    // 1. Check code-first action registry (synced via CLI)
    const actionDefinition = hasAction(actionName)
      ? getActionDefinition(actionName)
      : undefined;
    if (actionDefinition?.handler) {
      return actionDefinition.handler;
    }

    // 2. Check task handlers (registered via onTask)
    const taskHandler = this._taskHandlers.get(actionName);
    if (taskHandler) {
      return taskHandler;
    }

    return undefined;
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
  onAnyTask(
    handler: (name: string, data: Record<string, unknown>) => void
  ): () => void {
    this._anyTaskHandler = handler;
    return () => {
      this._anyTaskHandler = null;
    };
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
    this._events.emit("task:execute", payload);

    // Call the any-task handler if registered
    if (this._anyTaskHandler) {
      try {
        this._anyTaskHandler(name, data);
      } catch (error) {
        debug.error(`[Pillar] Error in onAnyTask handler:`, error);
      }
    }

    // Look for handlers in this order:
    // 1. Code-first action registry (synced via pillar-sync CLI)
    // 2. Specific handler by action name (via onTask)
    // 3. Generic handler by task type (e.g., "navigate")
    // 4. Built-in handlers as fallback
    const actionDefinition = hasAction(name)
      ? getActionDefinition(name)
      : undefined;
    const runtimeAction = this._registeredActions.get(name);
    const registryHandler = actionDefinition?.handler;
    const specificHandler = this._taskHandlers.get(name);
    const typeHandler = taskType ? this._taskHandlers.get(taskType) : undefined;
    const handler = registryHandler || specificHandler || typeHandler;

    // Check if action returns data (from code-first registry or runtime registration)
    const actionReturnsData =
      actionDefinition?.returns || runtimeAction?.returns;

    if (handler) {
      const handlerStartTime = performance.now();
      debugLog.add({
        event: 'handler:execute',
        data: { action: name, taskType, params: data },
        source: 'handler',
        level: 'info',
      });

      try {
        // Merge path into data for navigate handlers
        const handlerData =
          taskType === "navigate" && path ? { ...data, path } : data;
        const result = handler(handlerData);

        // If action returns data, send it back to the agent
        if (actionReturnsData && result !== undefined) {
          // Handle both sync and async handlers
          Promise.resolve(result)
            .then(async (resolvedResult) => {
              const duration = Math.round(performance.now() - handlerStartTime);
              if (resolvedResult !== undefined) {
                await this.sendActionResult(name, resolvedResult);

                // Check if result indicates failure (e.g., {success: false, message: "..."})
                // and emit task:complete with correct success status
                let taskSuccess = true;
                if (
                  resolvedResult &&
                  typeof resolvedResult === "object" &&
                  !Array.isArray(resolvedResult)
                ) {
                  const resultObj = resolvedResult as Record<string, unknown>;
                  if (resultObj.success === false) {
                    taskSuccess = false;
                  }
                }
                debugLog.add({
                  event: 'handler:complete',
                  data: { action: name, duration, success: taskSuccess, returnsData: true },
                  source: 'handler',
                  level: taskSuccess ? 'info' : 'warn',
                });
                this._events.emit("task:complete", {
                  name,
                  success: taskSuccess,
                  data: resolvedResult as Record<string, unknown> | undefined,
                });
              } else {
                debugLog.add({
                  event: 'handler:complete',
                  data: { action: name, duration, success: true },
                  source: 'handler',
                  level: 'info',
                });
                this._events.emit("task:complete", {
                  name,
                  success: true,
                  data,
                });
              }
            })
            .catch((error) => {
              const duration = Math.round(performance.now() - handlerStartTime);
              debugLog.add({
                event: 'handler:error',
                data: { action: name, duration, error: error instanceof Error ? error.message : String(error) },
                source: 'handler',
                level: 'error',
              });
              debug.error(`[Pillar] Error in query action "${name}":`, error);
              this._events.emit("task:complete", {
                name,
                success: false,
                data,
              });
            });
        } else {
          // No data returned - assume success
          const duration = Math.round(performance.now() - handlerStartTime);
          debugLog.add({
            event: 'handler:complete',
            data: { action: name, duration, success: true },
            source: 'handler',
            level: 'info',
          });
          this._events.emit("task:complete", { name, success: true, data });
        }
      } catch (error) {
        const duration = Math.round(performance.now() - handlerStartTime);
        debugLog.add({
          event: 'handler:error',
          data: { action: name, duration, error: error instanceof Error ? error.message : String(error) },
          source: 'handler',
          level: 'error',
        });
        debug.error(`[Pillar] Error executing task "${name}":`, error);
        this._events.emit("task:complete", { name, success: false, data });
      }
    } else {
      // Handle built-in task types if no custom handler
      switch (taskType) {
        case "navigate":
          if (path && typeof window !== "undefined") {
            // Fallback to hard redirect only if no handler was registered
            debug.warn(
              `[Pillar] No 'navigate' handler registered. Using window.location.href as fallback.`
            );
            window.location.href = path;
            this._events.emit("task:complete", { name, success: true, data });
          }
          break;
        case "external_link":
          if (externalUrl && typeof window !== "undefined") {
            window.open(externalUrl, "_blank", "noopener,noreferrer");
            this._events.emit("task:complete", { name, success: true, data });
          }
          break;
        case "copy_text":
          if (
            data.text &&
            typeof navigator !== "undefined" &&
            navigator.clipboard
          ) {
            navigator.clipboard
              .writeText(String(data.text))
              .then(() => {
                this._events.emit("task:complete", {
                  name,
                  success: true,
                  data,
                });
              })
              .catch(() => {
                this._events.emit("task:complete", {
                  name,
                  success: false,
                  data,
                });
              });
          }
          break;
        default:
          debug.warn(
            `[Pillar] No handler registered for task "${name}". Register one with pillar.onTask('${name}', handler)`
          );
          // Emit failure for unhandled tasks
          this._events.emit("task:complete", {
            name,
            success: false,
            data: { error: "No handler registered" },
          });
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
  completeTask(
    taskName: string,
    success: boolean = true,
    data?: Record<string, unknown>
  ): void {
    this._events.emit("task:complete", { name: taskName, success, data });
  }

  /**
   * Signal that an action has completed.
   *
   * For simple actions, this emits the completion event.
   * For wizard actions (modals, multi-step flows), call this when the user
   * finishes the flow.
   *
   * If there's an active plan waiting on this action, the plan automatically
   * advances to the next step.
   *
   * @param actionName - The action identifier
   * @param success - Whether the action completed successfully (default: true)
   * @param data - Optional result data
   *
   * @example
   * // In your wizard completion handler:
   * pillar.completeAction('add_source', true, { sourceId: source.id });
   */
  async completeAction(
    actionName: string,
    success: boolean = true,
    data?: Record<string, unknown>
  ): Promise<void> {
    // Emit the task:complete event for standalone action tracking
    this._events.emit("task:complete", { name: actionName, success, data });

    // If there's an active plan with this action awaiting, advance it
    if (this._planExecutor) {
      await this._planExecutor.completeStepByAction(actionName, success, data);
    }
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
    status: "success" | "failure",
    details?: {
      error?: string;
      duration_ms?: number;
      [key: string]: unknown;
    }
  ): void {
    if (!taskId) {
      debug.warn("[Pillar] confirmTaskExecution called without taskId");
      return;
    }

    if (!this._api) {
      debug.warn(
        "[Pillar] SDK not initialized, cannot confirm task execution"
      );
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
    this._events.emit("workflow:start", activeWorkflow.value!);

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
      debug.warn("[Pillar] No active workflow");
      return;
    }

    const idx = stepIndex ?? workflow.current_step;
    const step = workflow.steps[idx];

    if (!step) {
      debug.warn(`[Pillar] Invalid step index: ${idx}`);
      return;
    }

    if (step.status !== "awaiting_initiation") {
      debug.warn(`[Pillar] Step ${idx} is not awaiting initiation`);
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
    updateStepStatus(idx, success ? "completed" : "failed");
    this._events.emit("workflow:step:complete", {
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
      this._events.emit("workflow:complete", activeWorkflow.value!);
      storeCompleteWorkflow();
      return;
    }

    this._events.emit("workflow:step:active", {
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

    updateStepStatus(idx, "skipped");
    this._events.emit("workflow:step:skip", {
      workflow: activeWorkflow.value!,
      step: activeWorkflow.value!.steps[idx],
    });

    // Advance to next step
    const nextStep = advanceToNextStep();

    if (!nextStep) {
      // Workflow complete
      this._events.emit("workflow:complete", activeWorkflow.value!);
      storeCompleteWorkflow();
      return;
    }

    this._events.emit("workflow:step:active", {
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

    this._events.emit("workflow:cancel", workflow);
    storeCancelWorkflow();
  }

  /**
   * Execute a workflow step.
   * Internal method that runs the task and handles auto_complete.
   */
  private _executeWorkflowStep(step: WorkflowStep): void {
    updateStepStatus(step.index, "active");

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
   * Resume plan execution if it appears stuck.
   *
   * This is a fallback for cases where auto-execute failed or
   * the plan got into an inconsistent state. It manually triggers
   * execution of the next ready step.
   */
  async resumePlan(): Promise<void> {
    debug.log("[Pillar] Manual plan resume triggered");
    await this._planExecutor?.resumeExecution();
  }

  /**
   * Confirm a plan step requiring confirmation.
   *
   * @param stepId - UUID of the step to confirm
   * @param data - Optional modified data from user input
   */
  async confirmPlanStep(
    stepId: string,
    data?: Record<string, unknown>
  ): Promise<void> {
    await this._planExecutor?.confirmStep(stepId, data);
  }

  /**
   * Confirm an inline_ui step with data from the inline card.
   *
   * This is called when the user interacts with an inline card (e.g., invite form)
   * within a plan step and clicks confirm.
   *
   * @param stepId - UUID of the step to confirm
   * @param data - Data from the inline card (e.g., email, form fields)
   */
  async confirmInlinePlanStep(
    stepId: string,
    data?: Record<string, unknown>
  ): Promise<void> {
    await this._planExecutor?.confirmInlineStep(stepId, data);
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
   * @returns Promise that resolves when the result is delivered
   * @internal
   */
  async sendActionResult(actionName: string, result: unknown): Promise<void> {
    if (!this._api) {
      debug.warn("[Pillar] SDK not initialized, cannot send action result");
      return;
    }

    debug.log(`[Pillar] Sending action result for "${actionName}":`, result);
    await this._api.mcp.sendActionResult(actionName, result);
    this._events.emit("action:result", { actionName, result });
  }

  /**
   * Execute a query action and send the result back to the agent.
   *
   * This is called when the agent sends a `query_request` event.
   * Query actions are expected to return data that the agent can use
   * for further reasoning.
   *
   * @param actionName - The name of the action to execute
   * @param args - Arguments for the action
   * @param schema - Optional schema for parameter validation
   */
  async executeQueryAction(
    actionName: string,
    args: Record<string, unknown> = {},
    schema?: { properties?: Record<string, unknown>; required?: string[] }
  ): Promise<void> {
    const startTime = performance.now();
    
    // Defensive validation: ensure actionName is valid
    if (!actionName || typeof actionName !== 'string' || actionName.trim() === '') {
      debug.error('[Pillar] executeQueryAction called with missing or invalid actionName:', actionName);
      // Cannot send result back without a valid actionName
      return;
    }

    debug.log(`[Pillar] Starting query action "${actionName}"`, args);

    // Validate parameters against schema if provided
    if (schema?.properties) {
      const validationError = this._validateQueryParams(args, schema);
      if (validationError) {
        debug.error(`[Pillar] Query param validation failed: ${validationError}`);
        await this.sendActionResult(actionName, {
          success: false,
          error: validationError,
        });
        return;
      }
    }

    // Look for handlers
    const actionDefinition = hasAction(actionName)
      ? getActionDefinition(actionName)
      : undefined;
    const runtimeAction = this._registeredActions.get(actionName);
    const registryHandler = actionDefinition?.handler;
    const specificHandler = this._taskHandlers.get(actionName);
    const queryTypeHandler = this._taskHandlers.get("query");
    const handler = registryHandler || specificHandler || queryTypeHandler;

    if (!handler) {
      debug.error(
        `[Pillar] No handler registered for query action "${actionName}". ` +
          `Register one with: pillar.onTask('${actionName}', async (data) => { ... return result; })`
      );
      // Send error result back to agent so it doesn't hang
      await this.sendActionResult(actionName, {
        error: `No handler registered for action "${actionName}"`,
        success: false,
      });
      return;
    }

    debugLog.add({
      event: 'handler:execute',
      data: { action: actionName, type: 'query', params: args },
      source: 'handler',
      level: 'info',
    });

    try {
      const handlerStart = performance.now();
      const result = await Promise.resolve(handler(args));
      const handlerElapsed = Math.round(performance.now() - handlerStart);
      
      debug.log(
        `[Pillar] Query action "${actionName}" handler completed in ${handlerElapsed}ms`,
        result
      );

      if (result !== undefined) {
        debugLog.add({
          event: 'handler:complete',
          data: { action: actionName, duration: handlerElapsed, success: true, returnsData: true },
          source: 'handler',
          level: 'info',
        });
        await this.sendActionResult(actionName, result);
        const totalElapsed = Math.round(performance.now() - startTime);
        debug.log(`[Pillar] Query action "${actionName}" total time: ${totalElapsed}ms`);
      } else {
        debugLog.add({
          event: 'handler:complete',
          data: { action: actionName, duration: handlerElapsed, success: false, error: 'returned undefined' },
          source: 'handler',
          level: 'warn',
        });
        debug.warn(
          `[Pillar] Query action "${actionName}" returned undefined. ` +
            `Make sure your handler returns data for the agent.`
        );
        await this.sendActionResult(actionName, {
          error: `Handler returned undefined`,
          success: false,
        });
      }
    } catch (error) {
      const elapsed = Math.round(performance.now() - startTime);
      debugLog.add({
        event: 'handler:error',
        data: { action: actionName, duration: elapsed, error: error instanceof Error ? error.message : String(error) },
        source: 'handler',
        level: 'error',
      });
      debug.error(
        `[Pillar] Error executing query action "${actionName}" after ${elapsed}ms:`,
        error
      );
      await this.sendActionResult(actionName, {
        error: error instanceof Error ? error.message : String(error),
        success: false,
      });
    }
  }

  /**
   * Validate query parameters against a schema.
   * @returns Error message if validation fails, null if valid
   */
  private _validateQueryParams(
    params: Record<string, unknown>,
    schema: { properties?: Record<string, unknown>; required?: string[] }
  ): string | null {
    const properties = schema.properties || {};
    const required = schema.required || [];
    const expectedParams = Object.keys(properties);

    // Check required params are present
    const missing = required.filter((p) => !(p in params));
    if (missing.length > 0) {
      return `Missing required parameters: ${missing.join(", ")}. Expected: ${expectedParams.join(", ")}`;
    }

    // Check for unknown params (LLM used wrong names)
    const unknown = Object.keys(params).filter((p) => !(p in properties));
    if (unknown.length > 0) {
      return `Unknown parameters: ${unknown.join(", ")}. Expected: ${expectedParams.join(", ")}`;
    }

    return null;
  }

  // ============================================================================
  // Internal Methods
  // ============================================================================

  /**
   * Internal initialization
   */
  private async _init(config: PillarConfig): Promise<void> {
    // If already initializing, wait for it to complete
    if (this._state === "initializing" && this._initPromise) {
      debug.log("[Pillar] Already initializing, waiting for completion");
      await this._initPromise;
      return;
    }

    if (this._state === "ready") {
      debug.log("[Pillar] Already initialized");
      return;
    }

    this._state = "initializing";

    // Create and store the init promise so other callers can wait
    this._initPromise = this._doInit(config);
    await this._initPromise;
  }

  /**
   * Actual initialization logic
   */
  private async _doInit(config: PillarConfig): Promise<void> {
    try {
      // Enable debug mode if requested
      if (config.debug) {
        setDebugMode(true);
        debugLog.add({
          event: 'sdk:init:start',
          data: { productKey: config.productKey, debug: true },
          source: 'sdk',
          level: 'info',
        });
      }

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
        debug.warn(
          "[Pillar] Failed to fetch server config, using local config only:",
          error
        );
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

      // Configure debug logger to forward logs to server (for debugging client-server issues)
      debug.configure(this._api.mcp, { forwardToServer: true });

      // Initialize PlanExecutor for multi-step plans
      this._planExecutor = new PlanExecutor(
        this._api.mcp,
        this._events,
        this._config.productKey // Use productKey for plan persistence - unique across all sites
      );

      // Connect action results to plan step completion
      // When an action with returns=true completes, sendActionResult emits 'action:result'.
      // If there's an active plan step awaiting this result, complete it with the data.
      this._events.on("action:result", ({ actionName, result }) => {
        if (this._planExecutor) {
          this._planExecutor.completeStepByAction(
            actionName,
            true,
            result as Record<string, unknown>
          );
        }
      });

      // Connect task:complete to plan step completion
      // When executeTask runs a handler (via onTask), it emits task:complete.
      // If there's an active plan step awaiting this task, complete it with the data.
      this._events.on("task:complete", ({ name, success, data }) => {
        if (this._planExecutor) {
          this._planExecutor.completeStepByAction(name, success, data);
        }
      });

      // Set up debug event capturing when debug mode is enabled
      if (this._config.debug) {
        this._setupDebugEventCapture();
      }

      // Create shared root container for all Pillar UI elements
      // Uses isolation: isolate to create a new stacking context
      this._rootContainer = this._createRootContainer();

      // Set breakpoints for responsive behavior
      setMobileBreakpoint(this._config.mobileTrigger.breakpoint);
      setFullWidthBreakpoint(this._config.panel.fullWidthBreakpoint);

      // Initialize panel if enabled
      if (this._config.panel.enabled) {
        this._panel = new Panel(
          this._config,
          this._api,
          this._events,
          this._rootContainer
        );
        await this._panel.init();
      }

      // Initialize edge trigger if enabled
      if (this._config.edgeTrigger.enabled) {
        this._edgeTrigger = new EdgeTrigger(
          this._config,
          this._events,
          () => this.toggle(),
          this._rootContainer
        );
        this._edgeTrigger.init();
      }

      // Initialize mobile trigger if enabled (shows on small screens when edge trigger is hidden)
      if (this._config.mobileTrigger.enabled) {
        this._mobileTrigger = new MobileTrigger(
          this._config,
          this._events,
          () => this.toggle(),
          this._rootContainer
        );
        this._mobileTrigger.init();
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

      this._state = "ready";
      this._events.emit("ready");
      this._config.onReady?.();

      debug.log("[Pillar] SDK initialized successfully");

      // Mount debug panel if debug mode is enabled
      if (this._config.debug) {
        this._mountDebugPanel();
      }

      // Attempt to recover any active plan from localStorage
      await this._planExecutor?.recoverPlan();

      // Check URL params for auto-opening
      if (this._config.urlParams.enabled) {
        await this._handleUrlParams();
      }
    } catch (error) {
      this._state = "error";
      const err = error instanceof Error ? error : new Error(String(error));
      this._events.emit("error", err);
      this._config?.onError?.(err);
      debug.error("[Pillar] Failed to initialize:", error);
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
   * Mount the debug panel to the document body.
   */
  private _mountDebugPanel(): void {
    // Create container for debug panel
    this._debugPanelContainer = document.createElement('div');
    this._debugPanelContainer.id = 'pillar-debug-panel-root';
    document.body.appendChild(this._debugPanelContainer);

    // Render debug panel
    render(h(DebugPanel, null), this._debugPanelContainer);
    
    debugLog.add({
      event: 'debug:panel:mounted',
      source: 'sdk',
      level: 'info',
    });
  }

  /**
   * Set up debug event capturing for all SDK events.
   * Logs all events to the debug log store for display in the debug panel.
   */
  private _setupDebugEventCapture(): void {
    // Plan events
    this._events.on('plan:start', (data) => {
      debugLog.add({ event: 'plan:start', data, source: 'sdk', level: 'info' });
    });
    this._events.on('plan:step:active', (data) => {
      debugLog.add({ event: 'plan:step:active', data: { stepIndex: data.step?.index, action: data.step?.action_name }, source: 'sdk', level: 'info' });
    });
    this._events.on('plan:step:complete', (data) => {
      debugLog.add({ event: 'plan:step:complete', data: { stepIndex: data.step?.index, action: data.step?.action_name, success: data.success }, source: 'sdk', level: 'info' });
    });
    this._events.on('plan:step:failed', (data) => {
      debugLog.add({ event: 'plan:step:failed', data: { stepIndex: data.step?.index, action: data.step?.action_name, error: data.error?.message }, source: 'sdk', level: 'error' });
    });
    this._events.on('plan:complete', (data) => {
      debugLog.add({ event: 'plan:complete', data: { planId: data.id, goal: data.goal }, source: 'sdk', level: 'info' });
    });
    this._events.on('plan:error', (data) => {
      debugLog.add({ event: 'plan:error', data: { planId: data.plan?.id, error: data.error?.message }, source: 'sdk', level: 'error' });
    });
    this._events.on('plan:cancel', (data) => {
      debugLog.add({ event: 'plan:cancel', data: { planId: data.id }, source: 'sdk', level: 'warn' });
    });

    // Task events
    this._events.on('task:execute', (data) => {
      debugLog.add({ event: 'task:execute', data: { name: data.name, taskType: data.taskType }, source: 'sdk', level: 'info' });
    });
    this._events.on('task:complete', (data) => {
      debugLog.add({ event: 'task:complete', data: { name: data.name, success: data.success }, source: 'sdk', level: data.success ? 'info' : 'error' });
    });

    // Action events
    this._events.on('action:result', (data) => {
      debugLog.add({ event: 'action:result', data: { actionName: data.actionName, hasResult: !!data.result }, source: 'sdk', level: 'info' });
    });

    // General events
    this._events.on('ready', () => {
      debugLog.add({ event: 'sdk:ready', source: 'sdk', level: 'info' });
    });
    this._events.on('error', (data) => {
      debugLog.add({ event: 'sdk:error', data: { message: data.message }, source: 'sdk', level: 'error' });
    });

    debug.log('[Pillar] Debug event capture enabled');
  }

  /**
   * Internal cleanup
   */
  private _destroy(): void {
    this._textSelectionManager?.destroy();
    this._panel?.destroy();
    this._edgeTrigger?.destroy();
    this._mobileTrigger?.destroy();
    this._api?.cancelAllRequests();
    this._events.removeAllListeners();

    // Clean up hover mode subscription
    this._unsubscribeHoverMode?.();
    this._unsubscribeHoverMode = null;

    // Remove root container
    this._rootContainer?.remove();
    this._rootContainer = null;

    // Remove debug panel
    if (this._debugPanelContainer) {
      render(null, this._debugPanelContainer);
      this._debugPanelContainer.remove();
      this._debugPanelContainer = null;
    }

    // Reset all stores
    resetPanel();
    resetRouter();
    resetChat();
    resetContext();
    resetWorkflow();
    resetPlanStore();

    // Reset internal context state
    this._context = { ...DEFAULT_CONTEXT };
    this._userProfile = { ...DEFAULT_USER_PROFILE };

    // Clear task handlers
    this._taskHandlers.clear();
    this._anyTaskHandler = null;

    this._textSelectionManager = null;
    this._panel = null;
    this._edgeTrigger = null;
    this._mobileTrigger = null;
    this._api = null;
    this._planExecutor = null;
    this._config = null;
    this._state = "uninitialized";

    debug.log("[Pillar] SDK destroyed");
  }
}

/**
 * Get the API client from the current Pillar instance.
 * Returns null if SDK is not initialized.
 */
export function getApiClient(): APIClient | null {
  return Pillar.getInstance()?.["_api"] ?? null;
}

// Export for script tag usage
export default Pillar;
