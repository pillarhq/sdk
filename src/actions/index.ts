/**
 * Actions Module - Code-first action definitions for Pillar SDK.
 *
 * This module enables developers to define actions in their application code
 * rather than in the admin UI. Action metadata is synced to the server during
 * CI/CD builds via the `pillar-sync` CLI.
 *
 * @example
 * ```ts
 * // 1. Define actions in your app (e.g., lib/pillar/actions.ts)
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
 *
 * // 2. Sync actions via CI/CD
 * // npx pillar-sync --actions ./lib/pillar/actions.ts
 *
 * // 3. Register handlers at runtime
 * pillar.onTask('open_settings', () => router.push('/settings'));
 * pillar.onTask('navigate', ({ path }) => router.push(path));
 * ```
 *
 * @module actions
 */

// Types
export type {
  ActionType,
  ActionDataSchema,
  ActionDefinition,
  ActionDefinitions,
  ActionManifest,
  ActionManifestEntry,
  ClientInfo,
  Platform,
  SyncActionDefinition,
  SyncActionDefinitions,
  // Type utilities for typed onTask
  ActionTypeDataMap,
  NavigateActionData,
  TriggerActionData,
  InlineUIData,
  ExternalLinkData,
  CopyTextData,
  ActionDataType,
  ActionNames,
  TypedTaskHandler,
  TypedOnTask,
  TypedPillarMethods,
} from './types';

// Registry
export {
  defineActions,
  setClientInfo,
  getClientInfo,
  getHandler,
  getActionDefinition,
  hasAction,
  getActionNames,
  getManifest,
  clearRegistry,
  getActionCount,
} from './registry';
