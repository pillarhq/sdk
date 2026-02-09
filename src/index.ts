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
export {
  EventEmitter,
  type CardCallbacks,
  type CardRenderer,
  type PillarEvents,
  type TaskExecutePayload,
} from "./core/events";
export { Pillar, type ChatContext, type PillarState } from "./core/Pillar";

// Configuration
export {
  DEFAULT_SIDEBAR_TABS,
  type DOMScanningConfig,
  type EdgeTriggerConfig,
  type InteractionHighlightConfig,
  type MobileTriggerConfig,
  type MobileTriggerIcon,
  type MobileTriggerPosition,
  type MobileTriggerSize,
  type PanelConfig,
  type PanelMode,
  type PanelPosition,
  type PillarConfig,
  type ResolvedConfig,
  type ResolvedDOMScanningConfig,
  type ResolvedInteractionHighlightConfig,
  type ResolvedMobileTriggerConfig,
  type ResolvedPanelConfig,
  type ResolvedThemeConfig,
  type SidebarTabConfig,
  type TextSelectionConfig,
  type ThemeColors,
  type ThemeConfig,
  type ThemeMode,
  type UrlParamsConfig,
} from "./core/config";

// Context types
export {
  type AssistantContext,
  type Context,
  type Suggestion,
  type UserProfile,
} from "./core/context";

// Actions (code-first action definitions)
export {
  clearRegistry,
  getActionCount,
  getActionDefinition,
  getActionNames,
  getClientInfo,
  getHandler,
  getManifest,
  hasAction,
  setClientInfo,
  type ActionDataSchema,
  type ActionDataType,
  type ActionDefinition,
  type ActionDefinitions,
  type ActionManifest,
  type ActionManifestEntry,
  type ActionNames,
  type ActionType,
  // Type utilities for typed onTask
  type ActionTypeDataMap,
  type ClientInfo,
  type CopyTextData,
  type ExternalLinkData,
  type InlineUIData,
  type NavigateActionData,
  type Platform,
  type SyncActionDefinition,
  type SyncActionDefinitions,
  type TriggerActionData,
  type TypedOnTask,
  type TypedPillarMethods,
  type TypedTaskHandler,
} from "./actions";

// API
export {
  APIClient,
  type ArticleSummary,
  type ChatMessage,
  type ChatResponse,
  type ProgressEvent,
} from "./api/client";

// MCP Client types (for image upload, action requests, token usage)
export {
  type ActionRequest,
  type ChatImage,
  type ImageUploadResponse,
  type TokenUsage,
} from "./api/mcp-client";

// DOM Scanner types
export {
  DEFAULT_SCAN_OPTIONS,
  INTERACTABLE_ROLES,
  INTERACTABLE_TAGS,
  SKIP_TAGS,
  type CompactScanResult,
  type InteractionType,
  type ScanOptions,
} from "./types/dom-scanner";

// DOM Scanner utilities
export {
  buildSelectorFromRef,
  clearPillarRefs,
  isDestructiveElement,
  isInteractable,
  isRedacted,
  isValidPillarRef,
  scanPageDirect,
} from "./utils/dom-scanner";

// User context types (including DOM snapshot)
export {
  generateContextId,
  getContextDisplayLabel,
  isDOMSnapshotContext,
  isHighlightedTextContext,
  type DOMSnapshotContext,
  type GenericContext,
  type HighlightedTextContext,
  type ProductContext,
  type UserContextItem,
  type UserProfileContext,
} from "./types/user-context";

// Auto-initialization for script tags
import { Pillar } from "./core/Pillar";
import { debug } from "./utils/debug";

// Check for auto-init configuration in script tag
if (typeof window !== "undefined") {
  // Make Pillar available globally for script tag usage
  (window as unknown as { Pillar: typeof Pillar }).Pillar = Pillar;

  // Support auto-initialization via data-product-key attribute
  const autoInit = () => {
    const script = document.currentScript as HTMLScriptElement | null;
    if (script?.dataset.productKey) {
      Pillar.init({ productKey: script.dataset.productKey }).catch(debug.error);
    }
  };

  // Run auto-init when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInit);
  } else {
    // Script is being executed after DOM is ready (async/defer)
    // Try to find the script tag with our data attribute
    const scripts = document.querySelectorAll("script[data-product-key]");
    if (scripts.length > 0) {
      const script = scripts[scripts.length - 1] as HTMLScriptElement;
      if (script.dataset.productKey) {
        Pillar.init({ productKey: script.dataset.productKey }).catch(
          debug.error
        );
      }
    }
  }
}

// Default export for convenience
export default Pillar;
