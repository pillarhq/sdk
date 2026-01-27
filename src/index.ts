/**
 * Pillar SDK - Cursor for your product
 *
 * @example
 * // Script tag usage
 * <script src="https://cdn.trypillar.com/sdk/pillar.min.js"></script>
 * <script>
 *   Pillar.init({
 *     productKey: 'your-product-key',
 *   });
 * </script>
 *
 * @example
 * // ES Module usage
 * import { Pillar } from '@pillar-ai/sdk';
 *
 * await Pillar.init({
 *   productKey: 'your-product-key',
 * });
 */

// Core
export { Pillar, type PillarState, type ChatContext } from './core/Pillar';
export { EventEmitter, type PillarEvents, type TaskExecutePayload, type CardRenderer, type CardCallbacks } from './core/events';

// Configuration
export {
  type PillarConfig,
  type ResolvedConfig,
  type ResolvedPanelConfig,
  type ResolvedMobileTriggerConfig,
  type PanelConfig,
  type EdgeTriggerConfig,
  type MobileTriggerConfig,
  type MobileTriggerPosition,
  type MobileTriggerIcon,
  type MobileTriggerSize,
  type UrlParamsConfig,
  type TextSelectionConfig,
  type PanelPosition,
  type PanelMode,
  type ThemeMode,
  type ThemeColors,
  type ThemeConfig,
  type ResolvedThemeConfig,
  type SidebarTabConfig,
  DEFAULT_SIDEBAR_TABS,
} from './core/config';

// Context types
export {
  type Context,
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
  // Supports both data-product-key (new) and data-help-center (deprecated)
  const autoInit = () => {
    const script = document.currentScript as HTMLScriptElement | null;
    if (script) {
      const productKey = script.dataset.productKey ?? script.dataset.helpCenter;

      if (script.dataset.helpCenter && !script.dataset.productKey) {
        console.warn('[Pillar] data-help-center is deprecated. Use data-product-key instead.');
      }

      if (productKey) {
        Pillar.init({ productKey }).catch(console.error);
      }
    }
  };

  // Run auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    // Script is being executed after DOM is ready (async/defer)
    // Try to find the script tag by searching for one with our data attributes
    const scripts = document.querySelectorAll('script[data-product-key], script[data-help-center]');
    if (scripts.length > 0) {
      const script = scripts[scripts.length - 1] as HTMLScriptElement;
      const productKey = script.dataset.productKey ?? script.dataset.helpCenter;

      if (script.dataset.helpCenter && !script.dataset.productKey) {
        console.warn('[Pillar] data-help-center is deprecated. Use data-product-key instead.');
      }

      if (productKey) {
        Pillar.init({ productKey }).catch(console.error);
      }
    }
  }
}

// Default export for convenience
export default Pillar;
