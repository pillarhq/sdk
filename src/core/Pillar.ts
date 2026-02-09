/**
 * Main Pillar SDK Class
 * Entry point for all SDK functionality
 */

import { getActionDefinition, hasAction, setClientInfo } from "../actions";
import { APIClient, type SuggestedQuestion } from "../api/client";
import { EdgeTrigger } from "../components/Button/EdgeTrigger";
import { MobileTrigger } from "../components/Button/MobileTrigger";
import { Panel } from "../components/Panel/Panel";
import { TextSelectionManager } from "../components/TextSelection/TextSelectionManager";
import { PagePilotManager } from "../components/PagePilot/PagePilotManager";
import {
  conversationId as chatConversationId,
  messages as chatMessages,
  historyInvalidationCounter,
  resetChat,
} from "../store/chat";
import {
  resetSuggestions,
  setSuggestionPool,
  setSuggestions,
  setSuggestionsError,
  setSuggestionsLoading,
  sortByPageRelevance,
} from "../store/suggestions";
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
import { RouteObserver, type RouteInfo } from "../utils/route-observer";
import { DebugPanel } from "../components/DebugPanel";
import { domReady } from "../utils/dom";
import { buildSelectorFromRef, isValidPillarRef, isDestructiveElement } from "../utils/dom-scanner";
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
import type { Workflow, WorkflowStep } from "./workflow";

export type PillarState = "uninitialized" | "initializing" | "ready" | "error";

/**
 * Chat context for escalation to human support.
 */
export interface ChatContext {
  /** Client-generated conversation ID, or null if not yet started */
  conversationId: string | null;
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
  private _textSelectionManager: TextSelectionManager | null = null;
  private _pagePilotManager: PagePilotManager | null = null;
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
  // Persisted to localStorage so identity survives page refreshes
  private _externalUserId: string | null = null;

  private static EXTERNAL_USER_ID_STORAGE_KEY = "pillar:external_user_id";

  private _persistExternalUserId(userId: string | null): void {
    if (typeof window === "undefined") return;
    try {
      if (userId === null) {
        localStorage.removeItem(Pillar.EXTERNAL_USER_ID_STORAGE_KEY);
      } else {
        localStorage.setItem(Pillar.EXTERNAL_USER_ID_STORAGE_KEY, userId);
      }
    } catch {
      // Silently fail - localStorage may be unavailable
    }
  }

  private _getStoredExternalUserId(): string | null {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem(Pillar.EXTERNAL_USER_ID_STORAGE_KEY);
    } catch {
      return null;
    }
  }

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

  // Route observer for SPA navigation detection (page-aware suggestions)
  private _routeObserver: RouteObserver | null = null;
  
  // Suggestion pool fetched from backend (cached for client-side sorting)
  private _suggestionPool: SuggestedQuestion[] = [];

  constructor() {
    this._events = new EventEmitter();
  }

  /**
   * Create or get the shared root container for all Pillar UI elements.
   * Uses isolation: isolate to create a new stacking context.
   * Z-index varies by panel mode:
   *   - Push mode: 1000 (above typical navbars but not extreme)
   *   - Hover/overlay mode: 9999 (floats above host app content)
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
    // Set initial z-index based on current mode
    const initialZIndex = isHoverMode.value ? "9999" : "1000";
    container.style.cssText = `isolation: isolate; z-index: ${initialZIndex}; position: relative;`;
    document.body.appendChild(container);

    // Subscribe to hover mode changes to update z-index
    this._subscribeToHoverModeForRoot(container);

    return container;
  }

  /**
   * Subscribe to hover mode changes and update root container z-index.
   * Push mode uses a moderate z-index (1000) so the panel sits alongside content
   * without dominating the stacking order. Hover/overlay mode uses a high z-index
   * (9999) so the panel floats above the host app.
   */
  private _subscribeToHoverModeForRoot(container: HTMLElement): void {
    // Clean up existing subscription if any
    this._unsubscribeHoverMode?.();

    this._unsubscribeHoverMode = isHoverMode.subscribe((inHoverMode) => {
      container.style.zIndex = inHoverMode ? "9999" : "1000";
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
      conversationId: currentConversationId,
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

    // Update page pilot banner primary color
    if (this._config.theme.colors.primary) {
      this._pagePilotManager?.setPrimaryColor(this._config.theme.colors.primary);
    }

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

  // ============================================================================
  // DOM Scanning API
  // ============================================================================

  /**
   * Enable or disable DOM scanning at runtime.
   *
   * @param enabled - Whether to enable DOM scanning
   *
   * @example
   * // Enable DOM scanning
   * pillar.setDOMScanningEnabled(true);
   *
   * // Disable DOM scanning
   * pillar.setDOMScanningEnabled(false);
   */
  setDOMScanningEnabled(enabled: boolean): void {
    if (!this._config) return;

    this._config.domScanning.enabled = enabled;

    // Emit event
    this._events.emit("domScanning:change", { enabled });
  }

  /**
   * Whether DOM scanning is currently enabled.
   */
  get isDOMScanningEnabled(): boolean {
    return this._config?.domScanning.enabled ?? false;
  }

  // ============================================================================
  // DOM Interaction Highlight
  // ============================================================================

  /** Currently highlighted element (for cleanup) */
  private _highlightedElement: HTMLElement | null = null;
  /** Timeout for auto-removing highlight */
  private _highlightTimeout: ReturnType<typeof setTimeout> | null = null;
  /** Timeout for fade-out transition completion */
  private _fadeOutTimeout: ReturnType<typeof setTimeout> | null = null;
  /** Original styles to restore after highlight */
  private _originalStyles: {
    outline: string;
    outlineOffset: string;
    transition: string;
  } | null = null;

  /**
   * Highlight an element to show AI interaction.
   * Scrolls into view if not visible and adds an outline highlight with fade transition.
   *
   * @param el - Element to highlight
   */
  private highlightElement(el: HTMLElement): void {
    const config = this._config?.domScanning.interactionHighlight;
    if (!config?.enabled) {
      return;
    }

    // Clear any existing highlight immediately
    this.clearHighlight(true);

    // Always scroll element to center of screen for better visibility during agent interactions
    if (config.scrollIntoView) {
      el.scrollIntoView({
        behavior: config.scrollBehavior,
        block: 'center',
        inline: 'nearest',
      });
    }

    // Store original styles
    this._originalStyles = {
      outline: el.style.outline,
      outlineOffset: el.style.outlineOffset,
      transition: el.style.transition,
    };
    this._highlightedElement = el;

    // Set up transition for smooth fade in/out
    const existingTransition = el.style.transition;
    const outlineTransition = 'outline-color 0.3s ease-in-out';
    el.style.transition = existingTransition 
      ? `${existingTransition}, ${outlineTransition}`
      : outlineTransition;

    // Start with transparent outline (for fade-in effect)
    el.style.outline = `${config.outlineWidth}px solid transparent`;
    el.style.outlineOffset = `${config.outlineOffset}px`;

    // Trigger reflow to ensure the transparent state is applied
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    el.offsetHeight;

    // Fade in to the actual color
    el.style.outline = `${config.outlineWidth}px solid ${config.outlineColor}`;

    debug.log('[Pillar] Element highlighted with fade-in:', el.tagName);

    // Auto-remove highlight after duration (if duration > 0)
    if (config.duration > 0) {
      this._highlightTimeout = setTimeout(() => {
        this.clearHighlight();
      }, config.duration);
    }
  }

  /**
   * Clear the current element highlight with optional fade-out.
   * @param immediate - If true, skip fade-out transition
   */
  private clearHighlight(immediate = false): void {
    if (this._highlightTimeout) {
      clearTimeout(this._highlightTimeout);
      this._highlightTimeout = null;
    }

    if (this._fadeOutTimeout) {
      clearTimeout(this._fadeOutTimeout);
      this._fadeOutTimeout = null;
    }

    if (this._highlightedElement && this._originalStyles) {
      const el = this._highlightedElement;
      const originalStyles = this._originalStyles;

      if (immediate) {
        // Restore original styles immediately
        el.style.outline = originalStyles.outline;
        el.style.outlineOffset = originalStyles.outlineOffset;
        el.style.transition = originalStyles.transition;
        debug.log('[Pillar] Highlight cleared immediately');
      } else {
        // Fade out to transparent first
        el.style.outline = el.style.outline.replace(/[^,\s]+$/, 'transparent');
        
        // Wait for transition to complete, then restore original styles
        this._fadeOutTimeout = setTimeout(() => {
          el.style.outline = originalStyles.outline;
          el.style.outlineOffset = originalStyles.outlineOffset;
          el.style.transition = originalStyles.transition;
          debug.log('[Pillar] Highlight fade-out complete');
          this._fadeOutTimeout = null;
        }, 300); // Match the transition duration
      }

      this._highlightedElement = null;
      this._originalStyles = null;
    }
  }

  // ============================================================================
  // DOM Interaction Methods
  // ============================================================================

  /**
   * Get a DOM element by its pillar selector.
   *
   * @param selector - CSS selector (typically from DOMNode.selector)
   * @returns The matching element or null
   */
  getElement(selector: string): Element | null {
    return document.querySelector(selector);
  }

  /**
   * Click an element by its selector.
   * Uses realistic mouse event simulation (mousedown → mouseup → click)
   * for better compatibility with UI frameworks.
   *
   * @param selector - CSS selector for the element to click
   * @returns true if the element was found and clicked, false otherwise
   */
  clickElement(selector: string): boolean {
    debug.log('[Pillar] clickElement called with selector:', selector);
    const el = this.getElement(selector);
    debug.log('[Pillar] clickElement found element:', el);
    if (el instanceof HTMLElement) {
      debug.log('[Pillar] clickElement clicking element:', el.tagName, el.textContent?.slice(0, 50));
      
      // Highlight the element to show AI interaction
      this.highlightElement(el);
      
      // Get element position for realistic event coordinates
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const eventOptions: MouseEventInit = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: centerX,
        clientY: centerY,
        button: 0,
        buttons: 1,
      };
      
      // Fire the full mouse event sequence for realistic simulation
      el.dispatchEvent(new MouseEvent('mousedown', eventOptions));
      el.dispatchEvent(new MouseEvent('mouseup', eventOptions));
      el.dispatchEvent(new MouseEvent('click', eventOptions));
      
      debug.log('[Pillar] clickElement full mouse sequence executed');
      return true;
    }
    debug.warn('[Pillar] clickElement element not found or not HTMLElement');
    return false;
  }

  /**
   * Type text into an input element.
   * Uses realistic input simulation that works with React controlled inputs.
   *
   * @param selector - CSS selector for the input element
   * @param text - Text to type into the element
   * @returns true if the element was found and text was entered, false otherwise
   */
  typeInElement(selector: string, text: string): boolean {
    debug.log('[Pillar] typeInElement called with selector:', selector, 'text:', text);
    const el = this.getElement(selector);
    
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      debug.log('[Pillar] typeInElement found input/textarea:', el.tagName, el.type);
      
      // Highlight the element to show AI interaction
      this.highlightElement(el);
      
      // Focus the element first
      el.focus();
      
      // Get the native value setter to bypass React's synthetic event system
      // React overrides the value property, so we need to use the native setter
      const prototype = el instanceof HTMLInputElement 
        ? HTMLInputElement.prototype 
        : HTMLTextAreaElement.prototype;
      const nativeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
      
      if (nativeValueSetter) {
        // Use native setter to set the value (bypasses React)
        nativeValueSetter.call(el, text);
        debug.log('[Pillar] typeInElement set value via native setter');
      } else {
        // Fallback to direct assignment
        el.value = text;
        debug.log('[Pillar] typeInElement set value directly (fallback)');
      }
      
      // Fire beforeinput event (some frameworks check this)
      el.dispatchEvent(new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: text,
      }));
      
      // Fire input event with proper InputEvent type
      // This is what React listens to for controlled inputs
      el.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: text,
      }));
      
      // Fire change event
      el.dispatchEvent(new Event('change', { bubbles: true }));
      
      debug.log('[Pillar] typeInElement complete - events fired');
      return true;
    }
    
    // Handle contenteditable elements
    if (el instanceof HTMLElement && el.getAttribute('contenteditable') === 'true') {
      debug.log('[Pillar] typeInElement found contenteditable element');
      
      // Highlight the element to show AI interaction
      this.highlightElement(el);
      
      el.focus();
      
      // For contenteditable, we need to use execCommand or modify textContent
      // and fire the appropriate events
      el.textContent = text;
      
      el.dispatchEvent(new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: text,
      }));
      
      el.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: text,
      }));
      
      debug.log('[Pillar] typeInElement contenteditable complete');
      return true;
    }
    
    debug.warn('[Pillar] typeInElement element not found or not an input:', el);
    return false;
  }

  /**
   * Select an option in a select element.
   * Uses realistic event simulation for React compatibility.
   *
   * @param selector - CSS selector for the select element
   * @param value - Value of the option to select
   * @returns true if the element was found and option was selected, false otherwise
   */
  selectOption(selector: string, value: string): boolean {
    debug.log('[Pillar] selectOption called with selector:', selector, 'value:', value);
    const el = this.getElement(selector);
    
    if (el instanceof HTMLSelectElement) {
      debug.log('[Pillar] selectOption found select element');
      
      // Highlight the element to show AI interaction
      this.highlightElement(el);
      
      // Focus the element first
      el.focus();
      
      // Get native value setter to bypass React's synthetic events
      const nativeValueSetter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype, 'value'
      )?.set;
      
      if (nativeValueSetter) {
        nativeValueSetter.call(el, value);
        debug.log('[Pillar] selectOption set value via native setter');
      } else {
        el.value = value;
        debug.log('[Pillar] selectOption set value directly (fallback)');
      }
      
      // Fire input event (React listens to this)
      el.dispatchEvent(new Event('input', { bubbles: true }));
      
      // Fire change event
      el.dispatchEvent(new Event('change', { bubbles: true }));
      
      debug.log('[Pillar] selectOption complete');
      return true;
    }
    
    debug.warn('[Pillar] selectOption element not found or not a select:', el);
    return false;
  }

  /**
   * Focus an element by its selector.
   * Fires both focus and focusin events for compatibility.
   *
   * @param selector - CSS selector for the element to focus
   * @returns true if the element was found and focused, false otherwise
   */
  focusElement(selector: string): boolean {
    debug.log('[Pillar] focusElement called with selector:', selector);
    const el = this.getElement(selector);
    
    if (el instanceof HTMLElement) {
      debug.log('[Pillar] focusElement found element:', el.tagName);
      
      // Highlight the element to show AI interaction
      this.highlightElement(el);
      
      // Focus the element (this fires 'focus' event automatically)
      el.focus();
      
      // Fire focusin event (bubbles, unlike focus)
      el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      
      debug.log('[Pillar] focusElement complete');
      return true;
    }
    
    debug.warn('[Pillar] focusElement element not found:', el);
    return false;
  }

  /**
   * Toggle a checkbox or radio element.
   * Uses click simulation for realistic behavior and React compatibility.
   *
   * @param selector - CSS selector for the checkbox/radio element
   * @returns true if the element was found and toggled, false otherwise
   */
  toggleElement(selector: string): boolean {
    debug.log('[Pillar] toggleElement called with selector:', selector);
    const el = this.getElement(selector);
    
    if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
      debug.log('[Pillar] toggleElement found checkbox/radio:', el.type, 'current checked:', el.checked);
      
      // Highlight the element to show AI interaction
      this.highlightElement(el);
      
      // Focus first
      el.focus();
      
      // Get element position for realistic event coordinates
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const eventOptions: MouseEventInit = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: centerX,
        clientY: centerY,
        button: 0,
        buttons: 1,
      };
      
      // Use click simulation - clicking a checkbox naturally toggles it
      // and fires all the right events (including change)
      el.dispatchEvent(new MouseEvent('mousedown', eventOptions));
      el.dispatchEvent(new MouseEvent('mouseup', eventOptions));
      el.dispatchEvent(new MouseEvent('click', eventOptions));
      
      // For React controlled checkboxes, we may also need to fire input event
      el.dispatchEvent(new Event('input', { bubbles: true }));
      
      debug.log('[Pillar] toggleElement complete - new checked:', el.checked);
      return true;
    }
    
    debug.warn('[Pillar] toggleElement element not found or not checkbox/radio:', el);
    return false;
  }

  /**
   * Handle the interact_with_page action from the LLM.
   * Routes to appropriate DOM interaction method based on operation.
   * Validates the ref format, verifies the element attribute, and
   * prompts user confirmation for destructive actions.
   *
   * @param params - Interaction parameters from LLM
   * @returns Result object with success status and optional error
   *
   * @example
   * // Click a button
   * await pillar.handlePageInteraction({ operation: 'click', ref: 'pr-a1' });
   *
   * // Type in an input
   * await pillar.handlePageInteraction({ operation: 'type', ref: 'pr-b1', value: 'hello' });
   */
  async handlePageInteraction(params: {
    operation: 'click' | 'type' | 'select' | 'focus' | 'toggle';
    ref: string;
    value?: string;
  }): Promise<{ success: boolean; error?: string }> {
    debug.log('[Pillar] handlePageInteraction called with params:', params);

    // Validate ref format to prevent CSS selector injection
    if (!isValidPillarRef(params.ref)) {
      debug.warn('[Pillar] handlePageInteraction rejected invalid ref format:', params.ref);
      return { success: false, error: 'Invalid ref format' };
    }

    const selector = buildSelectorFromRef(params.ref);
    debug.log('[Pillar] handlePageInteraction built selector:', selector);

    // Defense-in-depth: verify the element's data-pillar-ref matches exactly
    const targetEl = this.getElement(selector);
    if (!targetEl) {
      debug.warn('[Pillar] handlePageInteraction element not found for ref:', params.ref);
      return { success: false, error: 'Element not found' };
    }
    if (targetEl.getAttribute('data-pillar-ref') !== params.ref) {
      debug.warn('[Pillar] handlePageInteraction ref attribute mismatch');
      return { success: false, error: 'Ref attribute mismatch' };
    }

    // Check for destructive actions and request user confirmation
    if (isDestructiveElement(targetEl)) {
      const label = targetEl.textContent?.trim().slice(0, 50) ||
        targetEl.getAttribute('aria-label') ||
        params.operation;
      debug.log('[Pillar] handlePageInteraction detected destructive element:', label);

      const { requestConfirmation } = await import('../store/pagePilot');
      const confirmed = await requestConfirmation(
        `Agent wants to ${params.operation} "${label}"`
      );

      if (!confirmed) {
        debug.log('[Pillar] handlePageInteraction destructive action denied by user');
        return { success: false, error: 'User denied destructive action' };
      }
      debug.log('[Pillar] handlePageInteraction destructive action confirmed by user');
    }

    let result: { success: boolean; error?: string };

    switch (params.operation) {
      case 'click':
        result = { success: this.clickElement(selector) };
        break;
      case 'type':
        if (!params.value) {
          result = { success: false, error: 'value required for type operation' };
          break;
        }
        result = { success: this.typeInElement(selector, params.value) };
        break;
      case 'select':
        if (!params.value) {
          result = { success: false, error: 'value required for select operation' };
          break;
        }
        result = { success: this.selectOption(selector, params.value) };
        break;
      case 'focus':
        result = { success: this.focusElement(selector) };
        break;
      case 'toggle':
        result = { success: this.toggleElement(selector) };
        break;
      default:
        result = { success: false, error: `Unknown operation: ${params.operation}` };
    }

    debug.log('[Pillar] handlePageInteraction result:', result);
    return result;
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

    // If already identified as this user (e.g. restored from localStorage on refresh),
    // skip redundant re-identification to avoid resetting the active conversation.
    // Use String() coercion so numeric IDs match their localStorage string form.
    if (this._externalUserId !== null && String(this._externalUserId) === String(userId)) {
      debug.log("[Pillar] Already identified as this user, skipping");
      return;
    }

    try {
      // Call backend to merge anonymous visitor with authenticated user
      await this._api.identify(userId, profile);

      // Store the external user ID for future requests (memory + localStorage)
      this._externalUserId = userId;
      this._persistExternalUserId(userId);

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
    // Clear the external user ID (memory + localStorage)
    this._externalUserId = null;
    this._persistExternalUserId(null);

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
   * @param toolCallId - Unique ID for this specific tool invocation (for result correlation)
   * @returns Promise that resolves when the result is delivered
   * @internal
   */
  async sendActionResult(actionName: string, result: unknown, toolCallId?: string): Promise<void> {
    if (!this._api) {
      debug.warn("[Pillar] SDK not initialized, cannot send action result");
      return;
    }

    debug.log(`[Pillar] Sending action result for "${actionName}" (tool_call_id: ${toolCallId}):`, result);
    await this._api.mcp.sendActionResult(actionName, result, toolCallId);
    this._events.emit("action:result", { actionName, result, toolCallId });
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

      // Restore external user ID from localStorage (survives page refreshes)
      const storedUserId = this._getStoredExternalUserId();
      if (storedUserId) {
        this._externalUserId = storedUserId;
        this._api.setExternalUserId(storedUserId);
        debug.log("[Pillar] Restored external user ID from localStorage");
      }

      // Configure debug logger to forward logs to server (for debugging client-server issues)
      debug.configure(this._api.mcp, { forwardToServer: true });

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

      // Initialize page pilot manager for "Page being piloted by Agent" banner
      // This is always initialized as it's needed for interact_with_page actions
      this._pagePilotManager = new PagePilotManager();
      this._pagePilotManager.init(this._config.theme.colors.primary);

      this._state = "ready";
      this._events.emit("ready");
      this._config.onReady?.();

      debug.log("[Pillar] SDK initialized successfully");

      // Mount debug panel if debug mode is enabled
      if (this._config.debug) {
        this._mountDebugPanel();
      }

      // Initialize page-aware suggestions if enabled (non-blocking)
      // Fetch starts immediately but doesn't block SDK ready state
      if (this._config.suggestions.enabled) {
        this._initSuggestions().catch((err) => {
          debug.warn('[Pillar] Background suggestions init failed:', err);
        });
      }

      // Attempt to recover any interrupted session from localStorage
      await this._recoverSession();

      // Check URL params for auto-opening
      if (this._config.urlParams.enabled) {
        await this._handleUrlParams();
      }

      // Restore last conversation from localStorage (runs last so it's not
      // clobbered by other init steps, ready handlers, or host app code).
      await this._restoreConversation();
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
   * Attempt to recover an interrupted session from localStorage.
   * Checks if there's a saved session hint and validates with the server.
   */
  private async _recoverSession(): Promise<void> {
    if (!this._config || !this._api) {
      debug.warn('[Pillar] _recoverSession skipped: config or api not available');
      return;
    }

    const siteId = this._config.productKey;
    debug.log('[Pillar] Checking for saved session hint with siteId:', siteId);
    
    // Import session persistence functions
    const { loadActiveSession, clearActiveSession } = await import('../store/session-persistence');
    const { setInterruptedSession, setConversationId } = await import('../store/chat');
    
    // Check for saved session hint
    const savedSession = loadActiveSession(siteId);
    if (!savedSession) {
      debug.log('[Pillar] No saved session found for siteId:', siteId);
      return;
    }

    debug.log('[Pillar] Found saved session hint, checking with server...');

    try {
      // Validate with server
      const status = await this._api.mcp.getConversationStatus(savedSession.conversationId);
      
      if (!status || !status.resumable) {
        // Session is no longer resumable, clear the hint
        debug.log('[Pillar] Session is no longer resumable, clearing hint');
        clearActiveSession(siteId);
        return;
      }

      // Session is resumable - set up the interrupted session state
      debug.log('[Pillar] Session is resumable, setting up resume state');
      
      // Set conversation ID so we can resume into the same conversation
      setConversationId(savedSession.conversationId);
      
      // Set the interrupted session signal for the UI to pick up
      setInterruptedSession({
        conversationId: savedSession.conversationId,
        userMessage: status.user_message ?? '',
        partialResponse: status.partial_response ?? '',
        summary: status.summary ?? '',
        elapsedMs: status.elapsed_ms ?? 0,
      });

      debug.log('[Pillar] Resume state set up successfully');
    } catch (error) {
      debug.warn('[Pillar] Failed to check session status:', error);
      clearActiveSession(siteId);
    }
  }

  /**
   * Restore the last conversation from localStorage on page refresh.
   * Runs at the very end of init so it is not clobbered by ready handlers,
   * host-app identify() calls, or other init steps.
   *
   * If the restored conversation has a trailing empty assistant message
   * (indicating the response was interrupted mid-stream), this method will
   * strip it and attempt to set up the resume flow so the user can reconnect.
   */
  private async _restoreConversation(): Promise<void> {
    if (!this._api) return;

    const { getStoredConversationId, messages, loadConversation, isLoadingHistory, interruptedSession, setInterruptedSession } = await import('../store/chat');
    const { navigate, currentView } = await import('../store/router');

    const storedId = getStoredConversationId();
    if (!storedId || messages.value.length > 0) return;

    debug.log('[Pillar] Restoring conversation from localStorage:', storedId);

    try {
      // Navigate to chat and show loading state
      isLoadingHistory.value = true;
      if (currentView.value.type !== 'chat') {
        navigate('chat');
      }

      const conversation = await this._api.getConversation(storedId);
      if (conversation && conversation.messages.length > 0) {
        let messagesToLoad = conversation.messages;

        // Check if the last message is an empty assistant message (interrupted response).
        // Strip it so the UI doesn't show a stale "Processing..." spinner.
        const lastMsg = messagesToLoad[messagesToLoad.length - 1];
        const hasStaleAssistantMsg = lastMsg.role === 'assistant' && !lastMsg.content?.trim();

        if (hasStaleAssistantMsg) {
          debug.log('[Pillar] Stripped trailing empty assistant message from restored conversation');
          messagesToLoad = messagesToLoad.slice(0, -1);
        }

        if (messagesToLoad.length > 0) {
          loadConversation(conversation.id, messagesToLoad);
        } else {
          isLoadingHistory.value = false;
        }

        // If we stripped an empty assistant message and _recoverSession didn't
        // already set up the interrupted session, try the status endpoint as
        // a fallback so the resume prompt can still appear.
        if (hasStaleAssistantMsg && !interruptedSession.value && this._api.mcp) {
          debug.log('[Pillar] Checking conversation status as fallback for resume...');
          try {
            const status = await this._api.mcp.getConversationStatus(storedId);
            if (status && status.resumable) {
              debug.log('[Pillar] Fallback: session is resumable, setting up resume state');
              setInterruptedSession({
                conversationId: storedId,
                userMessage: status.user_message ?? '',
                partialResponse: status.partial_response ?? '',
                summary: status.summary ?? '',
                elapsedMs: status.elapsed_ms ?? 0,
              });
            }
          } catch (err) {
            debug.warn('[Pillar] Fallback resume check failed:', err);
          }
        }
      } else {
        isLoadingHistory.value = false;
      }
    } catch (error) {
      debug.warn('[Pillar] Failed to restore conversation:', error);
      isLoadingHistory.value = false;
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

  // ============================================================================
  // Page-Aware Suggestions
  // ============================================================================

  /**
   * Initialize page-aware suggestions.
   * Fetches the suggestion pool from the backend and starts route observation.
   */
  private async _initSuggestions(): Promise<void> {
    if (!this._api || !this._config) return;

    debug.log('[Pillar] Initializing page-aware suggestions');
    setSuggestionsLoading(true);

    try {
      // Fetch the full suggestion pool from backend
      const pool = await this._api.getSuggestedQuestions();
      
      debug.log(`[Pillar] Fetched ${pool.length} suggestions for pool`);
      this._suggestionPool = pool;
      setSuggestionPool(pool);

      // Initialize route observer
      this._routeObserver = new RouteObserver({
        debounceMs: this._config.suggestions.debounceMs,
      });

      // Register route change handler
      this._routeObserver.onRouteChange((route) => {
        this._handleRouteChange(route);
      });

      // Start observing route changes
      this._routeObserver.start();

      // Sort suggestions for the current page immediately
      const currentRoute = this._routeObserver.getCurrentRoute();
      this._handleRouteChange(currentRoute);

      setSuggestionsLoading(false);
    } catch (error) {
      debug.error('[Pillar] Failed to initialize suggestions:', error);
      setSuggestionsError(error instanceof Error ? error.message : String(error));
      setSuggestionsLoading(false);
    }
  }

  /**
   * Handle route change by re-sorting suggestions for the new page context.
   */
  private _handleRouteChange(route: RouteInfo): void {
    if (!this._config) return;

    const { pathname, title } = route;
    const limit = this._config.suggestions.displayLimit;

    debug.log(`[Pillar] Route changed to: ${pathname}, sorting suggestions`);

    // Sort the pool for the current page context
    const sorted = sortByPageRelevance(
      this._suggestionPool,
      pathname,
      title,
      limit
    );

    // Update the displayed suggestions
    setSuggestions(sorted, pathname);

    // Emit event for external listeners
    this._events.emit('suggestions:updated', {
      suggestions: sorted.map((s) => ({ id: s.id, text: s.text })),
      route: pathname,
    });

    debug.log(`[Pillar] Sorted ${sorted.length} suggestions for page`);
  }

  /**
   * Internal cleanup
   */
  private _destroy(): void {
    // Stop route observer
    this._routeObserver?.stop();
    this._routeObserver = null;
    this._suggestionPool = [];
    resetSuggestions();

    this._textSelectionManager?.destroy();
    this._pagePilotManager?.destroy();
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

    // Reset internal context state
    this._context = { ...DEFAULT_CONTEXT };
    this._userProfile = { ...DEFAULT_USER_PROFILE };

    // Clear task handlers
    this._taskHandlers.clear();
    this._anyTaskHandler = null;

    this._textSelectionManager = null;
    this._pagePilotManager = null;
    this._panel = null;
    this._edgeTrigger = null;
    this._mobileTrigger = null;
    this._api = null;
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
