/**
 * Pillar SDK - Embedded Help for Your Application
 *
 * @example
 * // Script tag usage
 * <script src="https://cdn.trypillar.com/sdk/pillar.min.js"></script>
 * <script>
 *   Pillar.init({
 *     helpCenter: 'your-help-center',
 *     publicKey: 'pk_live_xxx',
 *   });
 * </script>
 *
 * @example
 * // ES Module usage
 * import { Pillar } from '@pillar-ai/sdk';
 *
 * await Pillar.init({
 *   helpCenter: 'your-help-center',
 *   publicKey: 'pk_live_xxx',
 * });
 */

// Core
export { Pillar, type PillarState } from './core/Pillar';
export { EventEmitter, type PillarEvents, type TaskExecutePayload, type CardRenderer, type CardCallbacks } from './core/events';

// Configuration
export {
  type PillarConfig,
  type ResolvedConfig,
  type ResolvedPanelConfig,
  type PanelConfig,
  type FloatingButtonConfig,
  type UrlParamsConfig,
  type TextSelectionConfig,
  type UserContext,
  type PanelPosition,
  type PanelMode,
  type FloatingButtonPosition,
  type FloatingButtonStyle,
  type ThemeMode,
  type ThemeColors,
  type ThemeConfig,
  type ResolvedThemeConfig,
  type SidebarTabConfig,
  DEFAULT_SIDEBAR_TABS,
} from './core/config';

// Context types
export {
  type ProductContext,
  type UserProfile,
  type Suggestion,
  type AssistantContext,
} from './core/context';

// Plan types (multi-step execution plans)
export {
  type PlanStatus,
  type StepStatus,
  type ExecutionLocation,
  type ExecutionPlan,
  type ExecutionStep,
  type PlanEvents,
} from './core/plan';

// Actions (code-first action definitions)
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
  type ActionType,
  type ActionDataSchema,
  type ActionDefinition,
  type ActionDefinitions,
  type ActionManifest,
  type ActionManifestEntry,
  type ClientInfo,
  type Platform,
  type SyncActionDefinition,
  type SyncActionDefinitions,
  // Type utilities for typed onTask
  type ActionTypeDataMap,
  type NavigateActionData,
  type TriggerActionData,
  type InlineUIData,
  type ExternalLinkData,
  type CopyTextData,
  type ActionDataType,
  type ActionNames,
  type TypedTaskHandler,
  type TypedOnTask,
  type TypedPillarMethods,
} from './actions';

// API
export {
  APIClient,
  type ArticleSummary,
  type ChatMessage,
  type ChatResponse,
  type ProgressEvent,
} from './api/client';

// MCP Client types (for image upload)
export {
  type ChatImage,
  type ImageUploadResponse,
} from './api/mcp-client';

// Auto-initialization for script tags
import { Pillar } from './core/Pillar';

// Check for auto-init configuration in script tag
if (typeof window !== 'undefined') {
  // Make Pillar available globally for script tag usage
  (window as unknown as { Pillar: typeof Pillar }).Pillar = Pillar;

  // Support auto-initialization via data attributes
  const autoInit = () => {
    const script = document.currentScript as HTMLScriptElement | null;
    if (script) {
      const helpCenter = script.dataset.helpCenter;
      const publicKey = script.dataset.publicKey;

      if (helpCenter && publicKey) {
        Pillar.init({ helpCenter, publicKey }).catch(console.error);
      }
    }
  };

  // Run auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    // Script is being executed after DOM is ready (async/defer)
    // Try to find the script tag by searching for one with our data attributes
    const scripts = document.querySelectorAll('script[data-help-center][data-public-key]');
    if (scripts.length > 0) {
      const script = scripts[scripts.length - 1] as HTMLScriptElement;
      const helpCenter = script.dataset.helpCenter;
      const publicKey = script.dataset.publicKey;

      if (helpCenter && publicKey) {
        Pillar.init({ helpCenter, publicKey }).catch(console.error);
      }
    }
  }
}

// Default export for convenience
export default Pillar;
