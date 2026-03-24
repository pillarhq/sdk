/**
 * Simple EventEmitter for SDK events
 */

import type { CompactScanResult } from "../types/dom-scanner";
import { debug } from "../utils/debug";
import type { ResolvedThemeConfig } from "./config";
import type { Context, UserProfile } from "./context";
import type { Workflow, WorkflowStep } from "./workflow";

export type EventCallback<T = unknown> = (data: T) => void;

/**
 * Task execution payload - sent when a task button is clicked.
 */
export interface TaskExecutePayload {
  /** Database UUID for the task (used for confirmation) */
  id?: string;
  /** Task unique identifier (e.g., 'invite_team_member') */
  name: string;
  /** Task data payload */
  data: Record<string, unknown>;
  /** Task type hint */
  taskType?:
    | "navigate"
    | "open_modal"
    | "fill_form"
    | "trigger_action"
    | "copy_text"
    | "external_link"
    | "start_tutorial"
    | "inline_ui";
  /** Path template for navigate type (already resolved with params) */
  path?: string;
  /** External URL for external_link type */
  externalUrl?: string;
}

/**
 * Callbacks provided to custom card renderers.
 */
export interface CardCallbacks {
  /** Confirm the action — triggers the tool's `execute` handler. Only present when the tool has `needsConfirmation`. */
  onConfirm?: (modifiedData?: Record<string, unknown>) => void;
  /** Cancel the action — dismisses the card. Only present when the tool has `needsConfirmation`. */
  onCancel?: () => void;
  /** Send a result back to the AI agent so it can continue reasoning. */
  sendResult?: (result: Record<string, unknown>) => Promise<void>;
  /** Called to report card state changes (for analytics/confirmation) */
  onStateChange?: (
    state: "loading" | "success" | "error",
    message?: string
  ) => void;
}

/**
 * Context about a card's position in the chat.
 * Passed to card renderers so they can adapt their UI
 * (e.g., collapse when no longer the latest card).
 */
export interface ToolCardContext {
  /** True when this is the last card segment across all messages. */
  isLatest: boolean;
  /** True when no message is being streamed — safe to call sendResult. */
  isReady: boolean;
  /** Zero-based index of the message containing this card. */
  messageIndex: number;
  /** Zero-based index of this segment within its message's segments array. */
  segmentIndex: number;
  /** The tool name / card type. */
  toolName: string;
}

/**
 * Card field schema definition for declarative card configuration.
 */
export interface CardFieldSchema {
  /** Field name/key */
  name: string;
  /** Display label */
  label: string;
  /** Field type */
  type:
    | "text"
    | "number"
    | "email"
    | "select"
    | "multiselect"
    | "checkbox"
    | "textarea"
    | "date"
    | "hidden";
  /** Whether field is required */
  required?: boolean;
  /** Default value */
  defaultValue?: unknown;
  /** Placeholder text */
  placeholder?: string;
  /** Help text shown below field */
  helpText?: string;
  /** Options for select/multiselect types */
  options?: Array<{ value: string; label: string }>;
  /** Validation rules */
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    patternMessage?: string;
  };
}

/**
 * Enhanced card registration options.
 */
export interface CardRegistrationOptions {
  /** Card type identifier (e.g., 'add_to_deal', 'invite_member') */
  cardType: string;
  /** Human-readable card title */
  title?: string;
  /** Card description */
  description?: string;
  /** Schema defining form fields (for auto-generated forms) */
  schema?: CardFieldSchema[];
  /** Custom renderer function (overrides schema-based rendering) */
  renderer?: CardRenderer;
  /** Theme/styling options */
  theme?: {
    variant?: "default" | "compact" | "wide";
  };
}

/**
 * Registered card with metadata.
 */
export interface RegisteredCard {
  cardType: string;
  options: CardRegistrationOptions;
  renderer?: CardRenderer;
}

/**
 * Card renderer function signature.
 * Customers register these to render custom inline UI cards.
 *
 * @param container - DOM element to render the card into
 * @param data - Action data including extracted values from AI
 * @param callbacks - Callbacks for state reporting
 * @returns Optional cleanup function called when card is unmounted
 */
export type CardRenderer = (
  container: HTMLElement,
  data: Record<string, unknown>,
  callbacks: CardCallbacks,
  context?: ToolCardContext
) => (() => void) | void;

export interface PillarEvents {
  /** SDK is initialized and ready. */
  ready: void;
  /** SDK encountered an error. */
  error: Error;
  /** Panel was opened. */
  "panel:open": void;
  /** Panel was closed. */
  "panel:close": void;
  /** Panel navigated to a different view. */
  "panel:navigate": { view: string; params?: Record<string, string> };
  /** User viewed an article. */
  "article:view": { articleSlug: string };
  /** User performed a search. */
  "search:query": { query: string };
  /** User sent a chat message. */
  "chat:message": { message: string };
  /** Text selection popover was shown. */
  "textSelection:shown": { text: string };
  /** User clicked the text selection popover. */
  "textSelection:click": { text: string };
  /** Context was updated. */
  "context:change": { context: Context };
  /** User profile was updated. */
  "profile:change": { profile: UserProfile };
  /** User action was reported. */
  "action:report": { action: string; metadata?: Record<string, unknown> };

  /** User was identified. */
  "user:identified": {
    userId: string;
    profile?: {
      name?: string;
      email?: string;
      metadata?: Record<string, unknown>;
    };
  };
  /** User logged out. */
  "user:logout": Record<string, never>;
  /** Query tool returned a result to the agent. */
  "tool:result": { toolName: string; result: unknown; toolCallId?: string };
  /** @deprecated Use tool:result instead */
  "action:result": { actionName: string; result: unknown; toolCallId?: string };
  /** AI-suggested task is being executed. */
  "task:execute": TaskExecutePayload;
  /** Task completed. */
  "task:complete": {
    id?: string;
    name: string;
    success: boolean;
    data?: Record<string, unknown>;
  };

  /** Multi-step workflow started. */
  "workflow:start": Workflow;
  /** Workflow step became active. */
  "workflow:step:active": { workflow: Workflow; step: WorkflowStep };
  /** Workflow step completed. */
  "workflow:step:complete": {
    workflow: Workflow;
    step: WorkflowStep;
    success: boolean;
  };
  /** Workflow step was skipped. */
  "workflow:step:skip": { workflow: Workflow; step: WorkflowStep };
  /** Workflow completed all steps. */
  "workflow:complete": Workflow;
  /** Workflow was cancelled. */
  "workflow:cancel": Workflow;

  /** Theme was changed. */
  "theme:change": { theme: ResolvedThemeConfig };

  /** Text selection feature was toggled. */
  "textSelection:change": { enabled: boolean };

  /** DOM was scanned. */
  "dom:scanned": CompactScanResult;
  /** DOM scanning feature was toggled. */
  "domScanning:change": { enabled: boolean };

  /** Page-aware suggestions were updated. */
  "suggestions:updated": {
    suggestions: Array<{ id: string; text: string }>;
    route: string;
  };

  /** Sidebar tab was clicked. Use to integrate external support systems. */
  "sidebar:click": { tabId: string; label: string };

  /** A tool was registered or unregistered. */
  "tools:change": { action: "add" | "remove"; name: string };

  /** A needsConfirmation tool was invoked via MCP streaming and needs a card rendered. */
  "confirmation:request": { toolName: string; data: Record<string, unknown> };

  /** @deprecated Use 'sidebar:click' instead. Will be removed in next major version. */
  "support:request": { tabId: string };
}

export class EventEmitter {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  on<K extends keyof PillarEvents>(
    event: K,
    callback: EventCallback<PillarEvents[K]>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event)!.add(callback as EventCallback);

    // Return unsubscribe function
    return () => {
      this.off(event, callback);
    };
  }

  off<K extends keyof PillarEvents>(
    event: K,
    callback: EventCallback<PillarEvents[K]>
  ): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback as EventCallback);
    }
  }

  emit<K extends keyof PillarEvents>(event: K, data?: PillarEvents[K]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          debug.error(`[Pillar] Error in event handler for "${event}":`, error);
        }
      });
    }
  }

  removeAllListeners(event?: keyof PillarEvents): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}
