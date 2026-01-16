/**
 * Action Types - Type definitions for code-first action definitions.
 *
 * These types enable developers to define actions in their application code
 * rather than in the admin UI, with full TypeScript support.
 *
 * @example
 * ```ts
 * import { defineActions } from '@pillar-ai/sdk/actions';
 *
 * const actions = defineActions({
 *   open_settings: {
 *     description: 'Navigate to the settings page',
 *     type: 'navigate',
 *     path: '/settings',
 *     handler: () => router.push('/settings'),
 *   },
 * });
 * ```
 */

/**
 * Supported action types.
 *
 * - navigate: Navigate to a page within the app
 * - open_modal: Open a modal or dialog
 * - fill_form: Fill form fields with data
 * - trigger_action: Trigger a custom action
 * - copy_text: Copy text to clipboard
 * - external_link: Open an external URL
 * - start_tutorial: Start a tutorial/walkthrough
 * - inline_ui: Display inline UI card in chat
 */
export type ActionType =
  | 'navigate'
  | 'open_modal'
  | 'fill_form'
  | 'trigger_action'
  | 'copy_text'
  | 'external_link'
  | 'start_tutorial'
  | 'inline_ui';

/**
 * Supported platforms for action deployments.
 */
export type Platform = 'web' | 'ios' | 'android' | 'desktop';

/**
 * JSON Schema definition for action data.
 *
 * When provided, the AI will extract data from the user's query
 * and populate the action's data field before execution.
 */
export interface ActionDataSchema {
  type: 'object';
  properties: Record<
    string,
    {
      type: 'string' | 'number' | 'boolean' | 'array' | 'object';
      description?: string;
      enum?: string[];
      default?: unknown;
    }
  >;
  required?: string[];
}

/**
 * Definition for a single action.
 *
 * Actions are defined in code and synced to the server during CI/CD.
 * The server stores the metadata, and the SDK executes the handler locally.
 *
 * @template TData - Type for the data passed to the handler
 */
export interface ActionDefinition<TData = Record<string, unknown>> {
  /**
   * Human-readable description for AI matching.
   *
   * The AI uses semantic similarity to match user queries to this description.
   * Be specific about when this action should be suggested.
   *
   * @example "Navigate to the billing page. Suggest when user asks about payments, invoices, or subscription."
   */
  description: string;

  /**
   * Example user queries that should trigger this action.
   *
   * Provide 3-5 natural phrasings users might say:
   * - Imperative: "open settings", "go to billing"
   * - Questions: "where can I change my password?"
   * - Informal: "settings", "show analytics"
   *
   * These are embedded and used for semantic matching alongside the description.
   */
  examples?: string[];

  /**
   * Type of action - determines how the SDK handles it.
   */
  type: ActionType;

  /**
   * Path for navigate actions.
   *
   * Can include template variables like `/users/{userId}`.
   */
  path?: string;

  /**
   * External URL for external_link actions.
   */
  externalUrl?: string;

  /**
   * JSON Schema for data extraction from user query.
   *
   * When provided, the AI will attempt to extract structured data
   * from the conversation before executing the action.
   */
  dataSchema?: ActionDataSchema;

  /**
   * Default data to pass to the handler.
   */
  defaultData?: TData;

  /**
   * Context required for this action to be available.
   *
   * @example { loggedIn: true, plan: 'pro' }
   */
  requiredContext?: Record<string, unknown>;

  /**
   * Whether to auto-run this action without user confirmation.
   *
   * Only the highest-scoring action can auto-run.
   * Use for simple navigations where user intent is clear.
   *
   * @default false
   */
  autoRun?: boolean;

  /**
   * Whether the action completes immediately after execution.
   *
   * If false, the SDK waits for host app confirmation.
   * Use true for simple navigations and clipboard operations.
   *
   * @default false
   */
  autoComplete?: boolean;

  /**
   * Whether this action returns data for the agent.
   *
   * If true, the handler's return value is sent back to the agent
   * for further reasoning. Use for query/lookup actions that inform
   * the agent's next decision.
   *
   * @default false
   */
  returns?: boolean;

  /**
   * Handler function executed when the action is triggered.
   *
   * This runs in the client - the server only stores metadata.
   * If `returns: true`, the return value is sent to the agent.
   */
  handler: (data: TData) => void | unknown | Promise<void | unknown>;
}

/**
 * Map of action name to definition.
 *
 * Action names should be snake_case identifiers.
 */
export type ActionDefinitions = Record<string, ActionDefinition<any>>;

/**
 * Metadata for a single action in the manifest (no handler).
 *
 * This is what gets synced to the server.
 */
export interface ActionManifestEntry {
  name: string;
  description: string;
  examples?: string[];
  type: ActionType;
  path?: string;
  external_url?: string;
  auto_run?: boolean;
  auto_complete?: boolean;
  returns_data?: boolean;
  data_schema?: ActionDataSchema;
  default_data?: Record<string, unknown>;
  required_context?: Record<string, unknown>;
}

/**
 * Action manifest - synced to server during CI/CD.
 *
 * Contains all action metadata without handlers.
 */
export interface ActionManifest {
  /**
   * Platform this manifest is for.
   */
  platform: Platform;

  /**
   * Version of the client app (semver or git SHA).
   */
  version: string;

  /**
   * Git commit SHA for traceability.
   */
  gitSha?: string;

  /**
   * When this manifest was generated.
   */
  generatedAt: string;

  /**
   * Action definitions (without handlers).
   */
  actions: ActionManifestEntry[];
}

/**
 * Client info set during SDK initialization.
 */
export interface ClientInfo {
  platform: Platform;
  version: string;
}

/**
 * Action definition for syncing (without handler).
 *
 * Use this type when defining actions for CI/CD sync.
 * Handlers are registered separately at runtime via pillar.onTask().
 *
 * @example
 * ```ts
 * import type { SyncActionDefinitions } from '@pillar-ai/sdk';
 *
 * export const actions: SyncActionDefinitions = {
 *   open_settings: {
 *     description: 'Navigate to settings page',
 *     type: 'navigate',
 *     path: '/settings',
 *     autoRun: true,
 *   },
 * };
 * ```
 */
export interface SyncActionDefinition<TData = Record<string, unknown>> {
  /** Human-readable description for AI matching */
  description: string;

  /** Example user queries that should trigger this action */
  examples?: string[];

  /** Type of action */
  type: ActionType;

  /** Path for navigate actions */
  path?: string;

  /** External URL for external_link actions */
  externalUrl?: string;

  /** JSON Schema for data extraction from user query */
  dataSchema?: ActionDataSchema;

  /** Default data to pass to the handler */
  defaultData?: TData;

  /** Context required for this action to be available */
  requiredContext?: Record<string, unknown>;

  /** Whether to auto-run this action without user confirmation */
  autoRun?: boolean;

  /** Whether the action completes immediately after execution */
  autoComplete?: boolean;

  /**
   * Whether this action returns data for the agent.
   * If true, the handler's return value is sent back to the agent.
   */
  returns?: boolean;
}

/**
 * Map of action name to sync definition (no handlers).
 *
 * Use this type for your actions file that gets synced via CI/CD.
 */
export type SyncActionDefinitions = Record<string, SyncActionDefinition<any>>;

// ============================================================================
// Type Utilities for Type-Safe onTask
// ============================================================================

/**
 * Base data types for each action type.
 * These are automatically inferred from the action's `type` field.
 */
export interface NavigateActionData {
  /** CSS selector to highlight after navigation */
  highlight_selector?: string;
  /** Path that was navigated to (injected by SDK) */
  path?: string;
}

export interface TriggerActionData {
  /** The action being triggered */
  action?: string;
  /** Additional action parameters */
  [key: string]: unknown;
}

export interface InlineUIData {
  /** Card type for rendering */
  card_type: string;
  /** Additional card data */
  [key: string]: unknown;
}

export interface ExternalLinkData {
  /** The URL being opened */
  url?: string;
}

export interface CopyTextData {
  /** Text to copy to clipboard */
  text?: string;
}

/**
 * Maps action types to their default data shapes.
 * Used for automatic type inference in onTask handlers.
 */
export interface ActionTypeDataMap {
  navigate: NavigateActionData;
  trigger_action: TriggerActionData;
  inline_ui: InlineUIData;
  external_link: ExternalLinkData;
  copy_text: CopyTextData;
  open_modal: Record<string, unknown>;
  fill_form: Record<string, unknown>;
  start_tutorial: Record<string, unknown>;
}

/**
 * Extract the data type for a specific action from an ActionDefinitions map.
 *
 * Type inference priority:
 * 1. If `defaultData` is defined, use that type (for custom fields)
 * 2. Otherwise, infer from the action's `type` field using ActionTypeDataMap
 * 3. Fall back to Record<string, unknown>
 *
 * @example
 * ```ts
 * const actions = {
 *   // Inferred from type: "navigate" → NavigateActionData
 *   open_settings: {
 *     description: '...',
 *     type: 'navigate',
 *     path: '/settings',
 *   },
 *   // Custom data via defaultData
 *   add_source: {
 *     description: '...',
 *     type: 'navigate',
 *     defaultData: { type: '', url: '', name: '' },
 *   },
 * } as const satisfies SyncActionDefinitions;
 * ```
 */
export type ActionDataType<
  TActions extends SyncActionDefinitions | ActionDefinitions,
  TName extends keyof TActions,
> = TActions[TName] extends { defaultData: infer D }
  ? D extends Record<string, unknown>
    ? D
    : Record<string, unknown>
  : TActions[TName] extends { type: infer T }
    ? T extends keyof ActionTypeDataMap
      ? ActionTypeDataMap[T]
      : Record<string, unknown>
    : Record<string, unknown>;

/**
 * Extract all action names from an ActionDefinitions map.
 *
 * @example
 * ```ts
 * const actions = { open_settings: {...}, add_source: {...} };
 * type Names = ActionNames<typeof actions>; // 'open_settings' | 'add_source'
 * ```
 */
export type ActionNames<T extends SyncActionDefinitions | ActionDefinitions> =
  Extract<keyof T, string>;

/**
 * Typed task handler function.
 *
 * @template TData - The data type for this action
 */
export type TypedTaskHandler<TData = Record<string, unknown>> = (
  data: TData
) => void | Promise<void>;

/**
 * Type-safe onTask method signature.
 *
 * When actions are provided to PillarProvider, this type enables
 * TypeScript to infer the correct data type for each action handler.
 *
 * @template TActions - The action definitions map
 */
export interface TypedOnTask<
  TActions extends SyncActionDefinitions | ActionDefinitions,
> {
  <TName extends ActionNames<TActions>>(
    taskName: TName,
    handler: TypedTaskHandler<ActionDataType<TActions, TName>>
  ): () => void;

  // Fallback overload for arbitrary string keys (runtime-only tasks)
  (taskName: string, handler: TypedTaskHandler): () => void;
}

/**
 * Extended Pillar interface with type-safe onTask.
 *
 * Use this when you want strongly typed task handlers based on
 * your action definitions.
 *
 * @template TActions - The action definitions map
 *
 * @example
 * ```ts
 * import type { TypedPillar } from '@pillar-ai/sdk';
 * import type { actions } from './actions';
 *
 * const pillar = usePillar<typeof actions>();
 *
 * // TypeScript knows `data` has { type, url, name }
 * pillar.onTask('add_source', (data) => {
 *   console.log(data.url);
 * });
 * ```
 */
export interface TypedPillarMethods<
  TActions extends SyncActionDefinitions | ActionDefinitions,
> {
  onTask: TypedOnTask<TActions>;
}
