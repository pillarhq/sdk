/**
 * Tool Types - Type definitions for code-first tool definitions.
 *
 * These types enable developers to define tools in their application code
 * rather than in the admin UI, with full TypeScript support.
 *
 * @example
 * ```ts
 * // lib/pillar/tools/index.ts
 * import type { SyncToolDefinitions } from '@pillar-ai/sdk';
 *
 * export const tools = {
 *   open_settings: {
 *     description: 'Navigate to the settings page',
 *     type: 'navigate' as const,
 *     path: '/settings',
 *     autoRun: true,
 *   },
 * } as const satisfies SyncToolDefinitions;
 *
 * export default tools;
 *
 * // Sync via CI/CD: npx pillar-sync --scan ./src
 * // Register handlers at runtime: pillar.onTask('open_settings', () => router.push('/settings'));
 * ```
 */

/**
 * Supported tool types.
 *
 * - navigate: Navigate to a page within the app
 * - open_modal: Open a modal or dialog
 * - fill_form: Fill form fields with data
 * - trigger_tool: Trigger a custom tool
 * - query: Fetch data from the client and return to the agent (implies returns: true)
 * - copy_text: Copy text to clipboard
 * - external_link: Open an external URL
 * - start_tutorial: Start a tutorial/walkthrough
 * - inline_ui: Display inline UI card in chat
 */
export type ToolType =
  | "navigate"
  | "open_modal"
  | "fill_form"
  | "trigger_tool"
  | "query"
  | "copy_text"
  | "external_link"
  | "start_tutorial"
  | "inline_ui";

/**
 * Supported platforms for tool deployments.
 */
export type Platform = "web" | "ios" | "android" | "desktop";

/**
 * Schema property definition for a single field.
 * Supports nested objects and arrays with items.
 */
export interface ToolDataSchemaProperty {
  type: "string" | "number" | "boolean" | "array" | "object";
  description?: string;
  enum?: string[];
  default?: unknown;
  /** Items schema for array types */
  items?: ToolDataSchemaProperty;
  /** Nested properties for object types */
  properties?: Record<string, ToolDataSchemaProperty>;
  /** Required fields for nested object types */
  required?: string[];
}

/**
 * JSON Schema definition for tool data.
 *
 * When provided, the AI will extract data from the user's query
 * and populate the tool's data field before execution.
 */
export interface ToolDataSchema {
  type: "object";
  properties: Record<string, ToolDataSchemaProperty>;
  required?: string[];
}

/**
 * Definition for a single tool.
 *
 * Tools are defined in code and synced to the server during CI/CD.
 * The server stores the metadata, and the SDK executes the handler locally.
 *
 * @template TData - Type for the data passed to the handler
 */
export interface ToolDefinition<TData = Record<string, unknown>> {
  /**
   * Human-readable description for AI matching.
   *
   * The AI uses semantic similarity to match user queries to this description.
   * Be specific about when this tool should be suggested.
   *
   * @example "Navigate to the billing page. Suggest when user asks about payments, invoices, or subscription."
   */
  description: string;

  /**
   * Example user queries that should trigger this tool.
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
   * Type of tool - determines how the SDK handles it.
   */
  type: ToolType;

  /**
   * Path for navigate tools.
   *
   * Can include template variables like `/users/{userId}`.
   */
  path?: string;

  /**
   * External URL for external_link tools.
   */
  externalUrl?: string;

  /**
   * JSON Schema for data extraction from user query.
   *
   * When provided, the AI will attempt to extract structured data
   * from the conversation before executing the tool.
   */
  dataSchema?: ToolDataSchema;

  /**
   * Default data to pass to the handler.
   */
  defaultData?: TData;

  /**
   * Context required for this tool to be available.
   *
   * @example { loggedIn: true, plan: 'pro' }
   */
  requiredContext?: Record<string, unknown>;

  /**
   * Whether to auto-run this tool without user confirmation.
   *
   * Only the highest-scoring tool can auto-run.
   * Use for simple navigations where user intent is clear.
   *
   * @default false
   */
  autoRun?: boolean;

  /**
   * Whether the tool completes immediately after execution.
   *
   * If false, the SDK waits for host app confirmation.
   * Use true for simple navigations and clipboard operations.
   *
   * @default false
   */
  autoComplete?: boolean;

  /**
   * Whether this tool returns data for the agent.
   *
   * If true, the handler's return value is sent back to the agent
   * for further reasoning. Use for query/lookup tools that inform
   * the agent's next decision.
   *
   * @default false
   */
  returns?: boolean;

  /**
   * Concrete examples of valid parameter objects for the AI to reference.
   *
   * Each example should have a `description` explaining the scenario
   * and a `parameters` object matching the `dataSchema`.
   * Useful for complex schemas where the AI benefits from seeing
   * what a correct call looks like.
   */
  parameterExamples?: Array<{
    description: string;
    parameters: Record<string, unknown>;
  }>;

  /**
   * Handler function executed when the tool is triggered.
   *
   * This runs in the client - the server only stores metadata.
   * If `returns: true`, the return value is sent to the agent.
   */
  handler: (data: TData) => void | unknown | Promise<void | unknown>;
}

/**
 * Map of tool name to definition.
 *
 * Tool names should be snake_case identifiers.
 */
export type ToolDefinitions = Record<string, ToolDefinition<unknown>>;

/**
 * Metadata for a single tool in the manifest (no handler).
 *
 * This is what gets synced to the server.
 */
export interface ToolManifestEntry {
  name: string;
  description: string;
  guidance?: string;
  examples?: string[];
  type: ToolType;
  path?: string;
  external_url?: string;
  auto_run?: boolean;
  auto_complete?: boolean;
  returns_data?: boolean;
  data_schema?: ToolDataSchema;
  default_data?: Record<string, unknown>;
  required_context?: Record<string, unknown>;
  parameter_examples?: Array<{
    description: string;
    parameters: Record<string, unknown>;
  }>;
}

/**
 * Tool manifest - synced to server during CI/CD.
 *
 * Contains all tool metadata without handlers.
 */
export interface ToolManifest {
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
   * Tool definitions (without handlers).
   */
  tools: ToolManifestEntry[];

  /**
   * Custom agent guidance synced alongside tools.
   * Injected into the AI agent's prompt as product_guidance.
   */
  agentGuidance?: string;
}

/**
 * Client info set during SDK initialization.
 */
export interface ClientInfo {
  platform: Platform;
  version: string;
}

/**
 * Tool definition for syncing (without handler).
 *
 * Use this type when defining tools for CI/CD sync.
 * Handlers are registered separately at runtime via pillar.onTask().
 *
 * @example
 * ```ts
 * import type { SyncToolDefinitions } from '@pillar-ai/sdk';
 *
 * export const tools: SyncToolDefinitions = {
 *   open_settings: {
 *     description: 'Navigate to settings page',
 *     type: 'navigate',
 *     path: '/settings',
 *     autoRun: true,
 *   },
 * };
 * ```
 */
export interface SyncToolDefinition<TData = Record<string, unknown>> {
  /** Human-readable description for AI matching */
  description: string;

  /** Example user queries that should trigger this tool */
  examples?: string[];

  /** Type of tool */
  type: ToolType;

  /** Path for navigate tools */
  path?: string;

  /** External URL for external_link tools */
  externalUrl?: string;

  /** JSON Schema for data extraction from user query */
  dataSchema?: ToolDataSchema;

  /** Default data to pass to the handler */
  defaultData?: TData;

  /** Context required for this tool to be available */
  requiredContext?: Record<string, unknown>;

  /** Whether to auto-run this tool without user confirmation */
  autoRun?: boolean;

  /** Whether the tool completes immediately after execution */
  autoComplete?: boolean;

  /**
   * Whether this tool returns data for the agent.
   * If true, the handler's return value is sent back to the agent.
   */
  returns?: boolean;

  /**
   * Concrete examples of valid parameter objects for the AI to reference.
   * Each example should have a `description` and a `parameters` object
   * matching the `dataSchema`.
   */
  parameterExamples?: Array<{
    description: string;
    parameters: Record<string, unknown>;
  }>;
}

/**
 * Map of tool name to sync definition (no handlers).
 *
 * Use this type for your tools file that gets synced via CI/CD.
 */
export type SyncToolDefinitions = Record<string, SyncToolDefinition<unknown>>;

// ============================================================================
// Type Utilities for Type-Safe onTask
// ============================================================================

/**
 * Base data types for each tool type.
 * These are automatically inferred from the tool's `type` field.
 */
export interface NavigateToolData {
  /** CSS selector to highlight after navigation */
  highlight_selector?: string;
  /** Path that was navigated to (injected by SDK) */
  path?: string;
}

export interface TriggerToolData {
  /** The tool being triggered */
  tool?: string;
  /** Additional tool parameters */
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

export interface QueryToolData {
  /** Query parameters passed to the handler */
  [key: string]: unknown;
}

/**
 * Maps tool types to their default data shapes.
 * Used for automatic type inference in onTask handlers.
 */
export interface ToolTypeDataMap {
  navigate: NavigateToolData;
  trigger_tool: TriggerToolData;
  query: QueryToolData;
  inline_ui: InlineUIData;
  external_link: ExternalLinkData;
  copy_text: CopyTextData;
  open_modal: Record<string, unknown>;
  fill_form: Record<string, unknown>;
  start_tutorial: Record<string, unknown>;
}

/**
 * Extract the data type for a specific tool from a ToolDefinitions map.
 *
 * Type inference priority:
 * 1. If `defaultData` is defined, use that type (for custom fields)
 * 2. Otherwise, infer from the tool's `type` field using ToolTypeDataMap
 * 3. Fall back to Record<string, unknown>
 *
 * @example
 * ```ts
 * const tools = {
 *   // Inferred from type: "navigate" → NavigateToolData
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
 * } as const satisfies SyncToolDefinitions;
 * ```
 */
export type ToolDataType<
  TTools extends SyncToolDefinitions | ToolDefinitions,
  TName extends keyof TTools,
> = TTools[TName] extends { defaultData: infer D }
  ? D extends Record<string, unknown>
    ? D
    : Record<string, unknown>
  : TTools[TName] extends { type: infer T }
    ? T extends keyof ToolTypeDataMap
      ? ToolTypeDataMap[T]
      : Record<string, unknown>
    : Record<string, unknown>;

/**
 * Extract all tool names from a ToolDefinitions map.
 *
 * @example
 * ```ts
 * const tools = { open_settings: {...}, add_source: {...} };
 * type Names = ToolNames<typeof tools>; // 'open_settings' | 'add_source'
 * ```
 */
export type ToolNames<T extends SyncToolDefinitions | ToolDefinitions> =
  Extract<keyof T, string>;

/**
 * Typed task handler function.
 *
 * @template TData - The data type for this tool
 */
export type TypedTaskHandler<TData = Record<string, unknown>> = (
  data: TData
) => void | Promise<void>;

/**
 * Type-safe onTask method signature.
 *
 * When tools are provided to PillarProvider, this type enables
 * TypeScript to infer the correct data type for each tool handler.
 *
 * @template TTools - The tool definitions map
 */
export interface TypedOnTask<
  TTools extends SyncToolDefinitions | ToolDefinitions,
> {
  <TName extends ToolNames<TTools>>(
    taskName: TName,
    handler: TypedTaskHandler<ToolDataType<TTools, TName>>
  ): () => void;

  // Fallback overload for arbitrary string keys (runtime-only tasks)
  (taskName: string, handler: TypedTaskHandler): () => void;
}

/**
 * Extended Pillar interface with type-safe onTask.
 *
 * Use this when you want strongly typed task handlers based on
 * your tool definitions.
 *
 * @template TTools - The tool definitions map
 *
 * @example
 * ```ts
 * import type { TypedPillar } from '@pillar-ai/sdk';
 * import type { tools } from './tools';
 *
 * const pillar = usePillar<typeof tools>();
 *
 * // TypeScript knows `data` has { type, url, name }
 * pillar.onTask('add_source', (data) => {
 *   console.log(data.url);
 * });
 * ```
 */
export interface TypedPillarMethods<
  TTools extends SyncToolDefinitions | ToolDefinitions,
> {
  onTask: TypedOnTask<TTools>;
}

// ============================================================================
// Tool Name Validation
// ============================================================================

/**
 * Valid tool name pattern (matches LLM provider requirements).
 *
 * - Must start with a letter or underscore
 * - Can contain: letters, numbers, underscores, dots, colons, dashes
 * - Maximum 64 characters
 *
 * Examples:
 *   - Valid: "add_to_cart", "get_user.profile", "api:v2:search"
 *   - Invalid: "Increment count" (space), "123_start" (starts with number)
 */
export const TOOL_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_.\-:]{0,63}$/;

/**
 * Validate a tool name against LLM provider requirements.
 *
 * @param name - Tool name to validate
 * @returns Object with `valid` boolean and optional `error` message
 */
export function validateToolName(name: string): {
  valid: boolean;
  error?: string;
} {
  if (!name || typeof name !== "string") {
    return { valid: false, error: "Tool name is required" };
  }

  if (name.length > 64) {
    return {
      valid: false,
      error: `Tool name exceeds 64 characters (got ${name.length})`,
    };
  }

  if (!/^[a-zA-Z_]/.test(name)) {
    return {
      valid: false,
      error: `Tool name must start with a letter or underscore, got "${name[0]}"`,
    };
  }

  if (!TOOL_NAME_PATTERN.test(name)) {
    const invalidChars = name.match(/[^a-zA-Z0-9_.\-:]/g);
    return {
      valid: false,
      error: `Tool name contains invalid characters: ${[...new Set(invalidChars)].map((c) => `"${c}"`).join(", ")}. Only letters, numbers, underscores, dots, colons, and dashes are allowed.`,
    };
  }

  return { valid: true };
}

// ============================================================================
// Unified Tool Schema (new API — co-locates metadata + handler)
// ============================================================================

/**
 * Result returned from a tool's execute function.
 *
 * Follows the MCP tool result format. Plain objects are also accepted
 * by the SDK and normalized to this shape automatically.
 */
export interface ToolExecuteResult {
  content: Array<
    | { type: "text"; text: string }
    | { type: "image"; data: string; mimeType: string }
  >;
  isError?: boolean;
}

/**
 * Unified tool definition that co-locates metadata and handler.
 *
 * Use with `pillar.defineTool()` or the `usePillarTool()` React hook.
 * The CLI scanner (`npx pillar-sync --scan ./src`) discovers these
 * definitions automatically — no barrel file needed.
 *
 * @template TInput - Type of the input object passed to `execute`
 *
 * @example
 * ```ts
 * pillar.defineTool({
 *   name: 'get_signing_secret',
 *   description: 'Retrieve the webhook signing secret',
 *   outputSchema: {
 *     type: 'object',
 *     properties: {
 *       signing_secret: { type: 'string', sensitive: true },
 *       algorithm: { type: 'string' },
 *     },
 *   },
 *   execute: async () => {
 *     const secret = await api.getSigningSecret();
 *     return { signing_secret: secret.value, algorithm: 'HMAC-SHA256' };
 *   },
 * });
 * ```
 */
export interface ToolSchema<TInput = Record<string, unknown>> {
  /** Unique tool name (e.g., 'add_to_cart') */
  name: string;

  /** Human-readable description for AI matching */
  description: string;

  /**
   * Agent-facing instructions for when/how to use this tool.
   *
   * Appended to the tool description in the LLM's tool list at
   * selection time. Use for disambiguation and prerequisite hints
   * (e.g., "Call get_datasources first to obtain a datasource_uid").
   *
   * Extracted by `pillar-sync --scan` and stored on the backend
   * Action model so the agent sees it without runtime code.
   */
  guidance?: string;

  /**
   * Type of tool - determines how the SDK handles it and organizes it in the UI.
   */
  type?: ToolType;

  /**
   * JSON Schema describing the input parameters.
   * The AI extracts structured data from the conversation to populate these.
   */
  inputSchema?: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };

  /**
   * JSON Schema describing the tool's output fields.
   *
   * Properties with `"sensitive": true` are stripped from AI context,
   * logs, and telemetry by Pillar's reasoning server and delivered
   * directly to the user via a secure reveal UI.
   */
  outputSchema?: {
    type: "object";
    properties: Record<string, unknown>;
  };

  /**
   * Example user queries that should trigger this tool.
   * Used for semantic matching alongside the description.
   */
  examples?: string[];

  /**
   * Whether to auto-execute without user confirmation.
   * @default false
   */
  autoRun?: boolean;

  /**
   * Whether the tool completes immediately after execution.
   * @default true
   */
  autoComplete?: boolean;

  /**
   * Context required for this tool to be available.
   *
   * When set, the tool is only offered to users whose current context
   * (set via `pillar.setContext()`) matches every key/value pair.
   *
   * @example { userRole: 'admin' }
   * @example { plan: 'enterprise', betaAccess: true }
   */
  requiredContext?: Record<string, unknown>;

  /**
   * Handler function executed when the AI invokes this tool.
   *
   * Return a plain object matching the `outputSchema`. The SDK sends
   * it directly to the backend with no wrapping — what you return is
   * what the agent sees.
   *
   * To signal failure, throw an error. The SDK catches it and sends
   * `{ success: false, error: message }` to the agent automatically.
   *
   * For backward compatibility the SDK also accepts the legacy
   * `{ success, data }` envelope and unwraps it, but new tools should
   * return flat data.
   */
  execute: (
    input: TInput
  ) =>
    | Promise<ToolExecuteResult | Record<string, unknown> | void>
    | ToolExecuteResult
    | Record<string, unknown>
    | void;

  /**
   * Whether to also register this tool with WebMCP (navigator.modelContext).
   *
   * When true, the tool will be exposed to browser-native AI agents and
   * assistive technologies via the W3C WebMCP API. The tool is registered
   * on mount and unregistered on unmount (or when the tool is removed).
   *
   * Only works in browser contexts where `navigator.modelContext` is available
   * (either natively or via polyfill).
   *
   * @default false
   */
  webMCP?: boolean;
}

// ============================================================================
// Backwards Compatibility Aliases (deprecated)
// ============================================================================

/** @deprecated Use ToolType instead */
export type ActionType = ToolType;

/** @deprecated Use ToolDataSchemaProperty instead */
export type ActionDataSchemaProperty = ToolDataSchemaProperty;

/** @deprecated Use ToolDataSchema instead */
export type ActionDataSchema = ToolDataSchema;

/** @deprecated Use ToolDefinition instead */
export type ActionDefinition<TData = Record<string, unknown>> =
  ToolDefinition<TData>;

/** @deprecated Use ToolDefinitions instead */
export type ActionDefinitions = ToolDefinitions;

/** @deprecated Use ToolManifestEntry instead */
export type ActionManifestEntry = ToolManifestEntry;

/** @deprecated Use ToolManifest instead */
export type ActionManifest = ToolManifest;

/** @deprecated Use SyncToolDefinition instead */
export type SyncActionDefinition<TData = Record<string, unknown>> =
  SyncToolDefinition<TData>;

/** @deprecated Use SyncToolDefinitions instead */
export type SyncActionDefinitions = SyncToolDefinitions;

/** @deprecated Use NavigateToolData instead */
export type NavigateActionData = NavigateToolData;

/** @deprecated Use TriggerToolData instead */
export type TriggerActionData = TriggerToolData;

/** @deprecated Use QueryToolData instead */
export type QueryActionData = QueryToolData;

/** @deprecated Use ToolTypeDataMap instead */
export type ActionTypeDataMap = ToolTypeDataMap;

/** @deprecated Use ToolDataType instead */
export type ActionDataType<
  TTools extends SyncToolDefinitions | ToolDefinitions,
  TName extends keyof TTools,
> = ToolDataType<TTools, TName>;

/** @deprecated Use ToolNames instead */
export type ActionNames<T extends SyncToolDefinitions | ToolDefinitions> =
  ToolNames<T>;

/** @deprecated Use ToolExecuteResult instead */
export type ActionResult = ToolExecuteResult;

/** @deprecated Use ToolSchema instead */
export type ActionSchema<TInput = Record<string, unknown>> = ToolSchema<TInput>;
