/**
 * Tools Module - Code-first tool definitions for Pillar SDK.
 *
 * This module enables developers to define tools in their application code
 * rather than in the admin UI. Tool metadata is synced to the server during
 * CI/CD builds via the `pillar-sync` CLI.
 *
 * @example
 * ```ts
 * // 1. Define tools in your app (e.g., hooks/usePillarTools.ts)
 * import { usePillarTool } from '@pillar-ai/react';
 *
 * usePillarTool({
 *   name: 'open_settings',
 *   description: 'Navigate to settings page',
 *   type: 'navigate',
 *   execute: () => router.push('/settings'),
 * });
 *
 * // 2. Sync tools via CI/CD
 * // npx pillar-sync --scan ./src
 * ```
 *
 * @module tools
 */

// Validation utilities
export { validateToolName, TOOL_NAME_PATTERN } from './types';

// Types
export type {
  ToolType,
  ToolDataSchema,
  ToolDataSchemaProperty,
  ToolDefinition,
  ToolDefinitions,
  ToolManifest,
  ToolManifestEntry,
  ClientInfo,
  Platform,
  SyncToolDefinition,
  SyncToolDefinitions,
  // Type utilities for typed onTask
  ToolTypeDataMap,
  NavigateToolData,
  TriggerToolData,
  InlineUIData,
  ExternalLinkData,
  CopyTextData,
  QueryToolData,
  ToolDataType,
  ToolNames,
  TypedTaskHandler,
  TypedOnTask,
  TypedPillarMethods,
  // Unified tool schema (new API)
  ToolExecuteResult,
  ToolSchema,
  // Backwards compatibility aliases (deprecated)
  ActionType,
  ActionDataSchema,
  ActionDataSchemaProperty,
  ActionDefinition,
  ActionDefinitions,
  ActionManifest,
  ActionManifestEntry,
  SyncActionDefinition,
  SyncActionDefinitions,
  NavigateActionData,
  TriggerActionData,
  QueryActionData,
  ActionTypeDataMap,
  ActionDataType,
  ActionNames,
  ActionResult,
  ActionSchema,
} from './types';

// Registry
export {
  setClientInfo,
  getClientInfo,
  getHandler,
  getToolDefinition,
  hasTool,
  getToolNames,
  getManifest,
  clearRegistry,
  getToolCount,
  // Backwards compatibility aliases (deprecated)
  getActionDefinition,
  hasAction,
  getActionNames,
  getActionCount,
} from './registry';
