/**
 * Tool Registry - Manages code-defined tool handlers.
 *
 * This module provides the registration and lookup mechanism for
 * tools defined in code. Tools are registered at runtime via
 * `pillar.onTask()` and can be looked up by name using `getHandler()`.
 *
 * Tool metadata is synced to the server during CI/CD builds using
 * the `pillar-sync` CLI with a scan pattern:
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
 * // Sync via CI/CD:
 * // npx pillar-sync --scan ./src
 * ```
 */
import type {
  ToolDefinition,
  ToolManifest,
  ToolManifestEntry,
  ClientInfo,
  Platform,
} from './types';

/**
 * Internal registry state.
 */
interface RegistryState {
  tools: Map<string, ToolDefinition>;
  clientInfo: ClientInfo | null;
}

const state: RegistryState = {
  tools: new Map(),
  clientInfo: null,
};

/**
 * Set client platform and version info.
 *
 * Called internally by Pillar.init() to set platform/version
 * for API requests.
 *
 * @param platform - Platform identifier (web, ios, android, desktop)
 * @param version - App version (semver or git SHA)
 */
export function setClientInfo(platform: Platform, version: string): void {
  state.clientInfo = { platform, version };
}

/**
 * Get the current client info.
 *
 * @returns Client info or null if not set
 */
export function getClientInfo(): ClientInfo | null {
  return state.clientInfo;
}

/**
 * Get a registered tool handler by name.
 *
 * @param name - Tool name (e.g., "open_settings")
 * @returns Handler function or undefined if not found
 */
export function getHandler(
  name: string
): ToolDefinition['handler'] | undefined {
  const tool = state.tools.get(name);
  return tool?.handler;
}

/**
 * Get a registered tool definition by name.
 *
 * @param name - Tool name
 * @returns Tool definition or undefined if not found
 */
export function getToolDefinition(
  name: string
): ToolDefinition | undefined {
  return state.tools.get(name);
}

/**
 * Check if a tool is registered.
 *
 * @param name - Tool name
 * @returns True if registered
 */
export function hasTool(name: string): boolean {
  return state.tools.has(name);
}

/**
 * Get all registered tool names.
 *
 * @returns Array of tool names
 */
export function getToolNames(): string[] {
  return Array.from(state.tools.keys());
}

/**
 * Get the tool manifest for syncing to the server.
 *
 * Extracts metadata from all registered tools (without handlers)
 * for sending to the Pillar server during CI/CD.
 *
 * @param platform - Platform to include in manifest
 * @param version - Version to include in manifest
 * @param gitSha - Optional git commit SHA
 * @returns Tool manifest object
 */
export function getManifest(
  platform: Platform,
  version: string,
  gitSha?: string
): ToolManifest {
  const tools: ToolManifestEntry[] = [];

  for (const [name, definition] of state.tools) {
    const entry: ToolManifestEntry = {
      name,
      description: definition.description,
      type: definition.type,
    };

    // Only include optional fields if they have values
    if (definition.examples?.length) entry.examples = definition.examples;
    if (definition.path) entry.path = definition.path;
    if (definition.externalUrl) entry.external_url = definition.externalUrl;
    if (definition.autoRun) entry.auto_run = definition.autoRun;
    if (definition.autoComplete) entry.auto_complete = definition.autoComplete;
    if (definition.returns) entry.returns_data = definition.returns;
    if (definition.dataSchema) entry.data_schema = definition.dataSchema;
    if (definition.defaultData) entry.default_data = definition.defaultData;
    if (definition.requiredContext) entry.required_context = definition.requiredContext;

    tools.push(entry);
  }

  return {
    platform,
    version,
    gitSha,
    generatedAt: new Date().toISOString(),
    tools,
  };
}

/**
 * Clear all registered tools.
 *
 * Primarily for testing purposes.
 */
export function clearRegistry(): void {
  state.tools.clear();
  state.clientInfo = null;
}

/**
 * Get the count of registered tools.
 *
 * @returns Number of registered tools
 */
export function getToolCount(): number {
  return state.tools.size;
}

// ============================================================================
// Backwards Compatibility Aliases (deprecated)
// ============================================================================

/** @deprecated Use getToolDefinition instead */
export const getActionDefinition = getToolDefinition;

/** @deprecated Use hasTool instead */
export const hasAction = hasTool;

/** @deprecated Use getToolNames instead */
export const getActionNames = getToolNames;

/** @deprecated Use getToolCount instead */
export const getActionCount = getToolCount;
