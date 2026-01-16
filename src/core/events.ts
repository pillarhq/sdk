/**
 * Simple EventEmitter for SDK events
 */

import type { ResolvedThemeConfig } from './config';
import type { ProductContext, UserProfile } from './context';
import type { ExecutionPlan, ExecutionStep } from './plan';
import type { Workflow, WorkflowStep } from './workflow';

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
  taskType?: 'navigate' | 'open_modal' | 'fill_form' | 'trigger_action' | 'copy_text' | 'external_link' | 'start_tutorial' | 'inline_ui';
  /** Path template for navigate type (already resolved with params) */
  path?: string;
  /** External URL for external_link type */
  externalUrl?: string;
}

/**
 * Callbacks provided to custom card renderers.
 */
export interface CardCallbacks {
  /** Called when user confirms the action. Pass modified data if needed. */
  onConfirm: (modifiedData?: Record<string, unknown>) => void;
  /** Called when user cancels the action */
  onCancel: () => void;
  /** Called to report card state changes (for analytics/confirmation) */
  onStateChange?: (state: 'loading' | 'success' | 'error', message?: string) => void;
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
  type: 'text' | 'number' | 'email' | 'select' | 'multiselect' | 'checkbox' | 'textarea' | 'date' | 'hidden';
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
    variant?: 'default' | 'compact' | 'wide';
    confirmLabel?: string;
    cancelLabel?: string;
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
 * Customers register these to render custom confirmation cards.
 * 
 * @param container - DOM element to render the card into
 * @param data - Action data including extracted values from AI
 * @param callbacks - Callbacks for confirm/cancel actions
 * @returns Optional cleanup function called when card is unmounted
 */
export type CardRenderer = (
  container: HTMLElement,
  data: Record<string, unknown>,
  callbacks: CardCallbacks
) => (() => void) | void;

export interface PillarEvents {
  'ready': void;
  'error': Error;
  'panel:open': void;
  'panel:close': void;
  'panel:navigate': { view: string; params?: Record<string, string> };
  'article:view': { articleSlug: string };
  'search:query': { query: string };
  'chat:message': { message: string };
  'textSelection:shown': { text: string };
  'textSelection:click': { text: string };
  // Context events
  'context:change': { context: ProductContext };
  'profile:change': { profile: UserProfile };
  'action:report': { action: string; metadata?: Record<string, unknown> };
  // Query action events - for actions that return data to the agent
  'action:result': { actionName: string; result: unknown };
  // Task events - for AI-suggested actions
  'task:execute': TaskExecutePayload;
  'task:complete': { id?: string; name: string; success: boolean; data?: Record<string, unknown> };

  // Workflow events - for multi-step sequences
  'workflow:start': Workflow;
  'workflow:step:active': { workflow: Workflow; step: WorkflowStep };
  'workflow:step:complete': { workflow: Workflow; step: WorkflowStep; success: boolean };
  'workflow:step:skip': { workflow: Workflow; step: WorkflowStep };
  'workflow:complete': Workflow;
  'workflow:cancel': Workflow;

  // Plan events - for server-generated multi-step plans
  'plan:start': ExecutionPlan;
  'plan:step:active': { plan: ExecutionPlan; step: ExecutionStep };
  'plan:step:confirm': { plan: ExecutionPlan; step: ExecutionStep };
  'plan:step:complete': { plan: ExecutionPlan; step: ExecutionStep; success: boolean };
  'plan:step:skip': { plan: ExecutionPlan; step: ExecutionStep };
  'plan:step:retry': { plan: ExecutionPlan; step: ExecutionStep; retryCount: number };
  'plan:step:failed': { plan: ExecutionPlan; step: ExecutionStep; error: Error; canRetry?: boolean };
  'plan:updated': ExecutionPlan;
  'plan:complete': ExecutionPlan;
  'plan:cancel': ExecutionPlan;
  'plan:error': { plan: ExecutionPlan; error: Error };

  // Theme events
  'theme:change': { theme: ResolvedThemeConfig };

  // Text selection feature toggle
  'textSelection:change': { enabled: boolean };
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

  emit<K extends keyof PillarEvents>(
    event: K,
    data?: PillarEvents[K]
  ): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[Pillar] Error in event handler for "${event}":`, error);
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
