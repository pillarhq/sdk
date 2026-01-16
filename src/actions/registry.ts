/**
 * Action Registry - Manages code-defined action handlers.
 *
 * This module provides the registration and lookup mechanism for
 * actions defined in code. Actions are registered using `defineActions()`
 * and can be looked up by name using `getHandler()`.
 *
 * The registry also generates the manifest that gets synced to the server
 * during CI/CD builds.
 */
import type {
  ActionDefinition,
  ActionDefinitions,
  ActionManifest,
  ActionManifestEntry,
  ClientInfo,
  Platform,
} from './types';

/**
 * Internal registry state.
 */
interface RegistryState {
  actions: Map<string, ActionDefinition>;
  clientInfo: ClientInfo | null;
}

const state: RegistryState = {
  actions: new Map(),
  clientInfo: null,
};

/**
 * Define and register actions with the SDK.
 *
 * Call this during app initialization to register your action handlers.
 * The metadata will be synced to the server during CI/CD builds.
 *
 * @example
 * ```ts
 * import { defineActions } from '@pillar-ai/sdk/actions';
 * import { router } from './router';
 *
 * export const actions = defineActions({
 *   open_settings: {
 *     description: 'Navigate to the settings page',
 *     type: 'navigate',
 *     path: '/settings',
 *     handler: () => router.push('/settings'),
 *   },
 *   open_billing: {
 *     description: 'Navigate to billing and subscription management',
 *     type: 'navigate',
 *     path: '/settings/billing',
 *     autoRun: true,
 *     handler: (data) => router.push('/settings/billing', data),
 *   },
 * });
 * ```
 *
 * @param actions - Map of action name to definition
 * @returns The same actions object (for re-export convenience)
 */
export function defineActions<T extends ActionDefinitions>(actions: T): T {
  for (const [name, definition] of Object.entries(actions)) {
    if (state.actions.has(name)) {
      console.warn(`[Pillar] Action "${name}" is already registered. Overwriting.`);
    }
    state.actions.set(name, definition);
  }
  return actions;
}

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
 * Get a registered action handler by name.
 *
 * @param name - Action name (e.g., "open_settings")
 * @returns Handler function or undefined if not found
 */
export function getHandler(
  name: string
): ActionDefinition['handler'] | undefined {
  const action = state.actions.get(name);
  return action?.handler;
}

/**
 * Get a registered action definition by name.
 *
 * @param name - Action name
 * @returns Action definition or undefined if not found
 */
export function getActionDefinition(
  name: string
): ActionDefinition | undefined {
  return state.actions.get(name);
}

/**
 * Check if an action is registered.
 *
 * @param name - Action name
 * @returns True if registered
 */
export function hasAction(name: string): boolean {
  return state.actions.has(name);
}

/**
 * Get all registered action names.
 *
 * @returns Array of action names
 */
export function getActionNames(): string[] {
  return Array.from(state.actions.keys());
}

/**
 * Get the action manifest for syncing to the server.
 *
 * Extracts metadata from all registered actions (without handlers)
 * for sending to the Pillar server during CI/CD.
 *
 * @param platform - Platform to include in manifest
 * @param version - Version to include in manifest
 * @param gitSha - Optional git commit SHA
 * @returns Action manifest object
 */
export function getManifest(
  platform: Platform,
  version: string,
  gitSha?: string
): ActionManifest {
  const actions: ActionManifestEntry[] = [];

  for (const [name, definition] of state.actions) {
    const entry: ActionManifestEntry = {
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

    actions.push(entry);
  }

  return {
    platform,
    version,
    gitSha,
    generatedAt: new Date().toISOString(),
    actions,
  };
}

/**
 * Clear all registered actions.
 *
 * Primarily for testing purposes.
 */
export function clearRegistry(): void {
  state.actions.clear();
  state.clientInfo = null;
}

/**
 * Get the count of registered actions.
 *
 * @returns Number of registered actions
 */
export function getActionCount(): number {
  return state.actions.size;
}
