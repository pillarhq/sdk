/**
 * Pillar SDK Configuration Types
 */
import type { Platform } from '../tools/types';

/** Which side of the screen the panel appears on. */
export type PanelPosition = 'left' | 'right';
/** How the panel interacts with page content: 'overlay' floats over it, 'push' shifts it aside. */
export type PanelMode = 'overlay' | 'push';
/** Color mode for the panel theme. 'auto' follows the system preference. */
export type ThemeMode = 'light' | 'dark' | 'auto';

/**
 * Sidebar tab configuration
 */
export interface SidebarTabConfig {
  id: string;
  label: string;
  enabled: boolean;
  order: number;
  /** Preset icon for this tab */
  icon?: 'help' | 'support' | 'settings' | 'feedback' | 'chat' | 'calendar' | 'mail' | 'tools';
}

export const DEFAULT_SIDEBAR_TABS: SidebarTabConfig[] = [
  { id: 'assistant', label: 'Assistant', enabled: true, order: 0 },
];

/**
 * Theme color configuration
 * All colors should be valid CSS color values (hex, rgb, hsl, etc.)
 */
export interface ThemeColors {
  /** Primary brand color (buttons, links, accents) */
  primary?: string;
  /** Primary color on hover state */
  primaryHover?: string;
  /** Main background color */
  background?: string;
  /** Secondary/subtle background (inputs, cards) */
  backgroundSecondary?: string;
  /** Primary text color */
  text?: string;
  /** Muted/secondary text color */
  textMuted?: string;
  /** Border color */
  border?: string;
  /** Border color for subtle/light borders */
  borderLight?: string;
  /** Outline/focus ring color for interactive elements */
  outlineColor?: string;
}

/**
 * Theme configuration for customizing panel appearance
 */
export interface ThemeConfig {
  /** 
   * Color mode: 'light', 'dark', or 'auto' (follows system preference)
   * @default 'auto'
   */
  mode?: ThemeMode;
  /** Custom color overrides for light mode */
  colors?: ThemeColors;
  /** Custom color overrides for dark mode (when mode is 'auto' or 'dark') */
  darkColors?: ThemeColors;
  /**
   * Font family for all panel text.
   * @default "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
   */
  fontFamily?: string;
}

export interface PanelConfig {
  /**
   * Whether the panel is enabled.
   * @default true
   */
  enabled?: boolean;
  /**
   * Which side of the screen the panel appears on.
   * @default 'right'
   */
  position?: PanelPosition;
  /**
   * Panel mode: 'overlay' slides over content, 'push' shifts content aside.
   * @default 'push'
   */
  mode?: PanelMode;
  /**
   * Panel width in pixels.
   * @default 380
   */
  width?: number;
  /** 
   * Custom mount point for the panel.
   * - CSS selector string (e.g., '#pillar-panel')
   * - HTMLElement reference
   * - 'manual' for React component-based mounting
   * - undefined (default) mounts to document.body
   */
  container?: string | HTMLElement | 'manual';
  /**
   * Whether to use Shadow DOM for style isolation.
   * - false (default): Panel renders in regular DOM, inherits host app CSS.
   *   Custom cards can use the host app's design system (Tailwind, etc.)
   * - true: Panel renders in Shadow DOM, fully isolated from host CSS.
   *   Use this if you need style isolation on third-party sites.
   * @default false
   */
  useShadowDOM?: boolean;
  /**
   * Viewport width below which the panel switches from 'push' mode to 'hover' mode.
   * In hover mode, the panel floats over content instead of pushing it aside.
   * - number: The breakpoint in pixels (default: 1200)
   * - false: Disable responsive behavior, always use push mode
   * @default 1200
   */
  hoverBreakpoint?: number | false;
  /**
   * Whether to show a backdrop overlay when the panel is in hover mode.
   * Only applies when viewport is below hoverBreakpoint.
   * @default true
   */
  hoverBackdrop?: boolean;
  /**
   * Viewport width below which the panel takes full screen width.
   * @default 500
   */
  fullWidthBreakpoint?: number;
  /**
   * Whether to open the panel automatically on initialization.
   * Takes priority over localStorage persisted state.
   * @default false
   */
  initialOpen?: boolean;
  /**
   * Whether the panel can be resized by dragging its edge.
   * A drag handle appears on the content-facing edge of the panel when enabled.
   * The resized width is persisted to localStorage.
   * @default true
   */
  resizable?: boolean;
  /**
   * Target element for push mode padding.
   * In push mode, padding is applied to this element to make room for the panel.
   * - CSS selector string (e.g., '#main-content', 'body')
   * - HTMLElement reference
   * - undefined (default) applies padding to document.documentElement (html)
   * @default undefined (document.documentElement)
   */
  pushTarget?: string | HTMLElement;
}

export interface UrlParamsConfig {
  /** Whether to check URL params for auto-opening the panel (default: true) */
  enabled?: boolean;
  /** Prefix for URL params (default: 'pillar-') */
  prefix?: string;
  /** Whether to clear URL params after opening (default: true) */
  clearAfterOpen?: boolean;
}

export interface TextSelectionConfig {
  /** Whether to show "Ask AI" popover on text selection (default: true) */
  enabled?: boolean;
  /** Label for the popover button (default: 'Ask AI') */
  label?: string;
}

export interface InteractionHighlightConfig {
  /**
   * Whether to highlight elements when the AI interacts with them.
   * @default true
   */
  enabled?: boolean;
  /**
   * Outline color for highlighted elements (CSS color value).
   * @default '#3b82f6' (blue-500)
   */
  outlineColor?: string;
  /**
   * Outline width in pixels.
   * @default 2
   */
  outlineWidth?: number;
  /**
   * Outline offset in pixels (space between element and outline).
   * @default 2
   */
  outlineOffset?: number;
  /**
   * Duration in milliseconds to show the highlight.
   * Set to 0 for no auto-removal (highlight stays until next interaction).
   * @default 2000
   */
  duration?: number;
  /**
   * Whether to scroll the element into view if not visible.
   * @default true
   */
  scrollIntoView?: boolean;
  /**
   * Scroll behavior when scrolling element into view.
   * @default 'smooth'
   */
  scrollBehavior?: ScrollBehavior;
}

/**
 * DOM scanning configuration.
 * @internal DOM scanning is currently disabled and not available for configuration.
 */
export interface DOMScanningConfig {
  /** @internal DOM scanning is disabled */
  enabled?: boolean;
  /** @internal */
  includeText?: boolean;
  /** @internal */
  maxDepth?: number;
  /** @internal */
  visibleOnly?: boolean;
  /** @internal */
  excludeSelector?: string;
  /** @internal */
  maxTextLength?: number;
  /** Configuration for highlighting elements during AI interactions. */
  interactionHighlight?: InteractionHighlightConfig;
}

export interface SuggestionsConfig {
  /**
   * Enable page-aware suggestion sorting.
   * When enabled, suggestions are re-sorted based on the current page context
   * whenever the user navigates to a new route.
   * @default true
   */
  enabled?: boolean;
  /**
   * Debounce time for route change detection (ms).
   * Prevents excessive sorting on rapid navigation.
   * @default 100
   */
  debounceMs?: number;
  /**
   * Maximum number of suggestions to display.
   * @default 3
   */
  displayLimit?: number;
}

export interface EdgeTriggerConfig {
  /**
   * Whether to show the edge trigger sidebar tab.
   * When enabled, a slim vertical tab appears on the screen edge that opens the panel.
   * @default true
   */
  enabled?: boolean;
  /**
   * Whether the panel can be resized by dragging the edge of the sidebar trigger.
   * When enabled, a drag handle appears on the inner edge of the sidebar when the panel is open.
   * The resized width is persisted to localStorage.
   * @default true
   */
  resizable?: boolean;
}

/** Position of the mobile floating trigger button. */
export type MobileTriggerPosition = 'bottom-right' | 'bottom-left';
/** Preset icon for the mobile floating trigger button. */
export type MobileTriggerIcon = 'sparkle' | 'question' | 'help' | 'chat' | 'support';
/** Size preset for the mobile floating trigger button. */
export type MobileTriggerSize = 'small' | 'medium' | 'large';

export interface MobileTriggerConfig {
  /**
   * Whether to show the mobile floating button on small screens.
   * When enabled, a floating action button appears when viewport is below mobileBreakpoint.
   * @default true
   */
  enabled?: boolean;
  /**
   * Viewport width below which the edge trigger hides and mobile trigger shows.
   * @default 700
   */
  breakpoint?: number;
  /**
   * Position of the floating button.
   * @default 'bottom-right'
   */
  position?: MobileTriggerPosition;
  /**
   * Preset icon to display in the button.
   * @default 'sparkle'
   */
  icon?: MobileTriggerIcon;
  /**
   * Custom SVG icon string. Overrides the icon preset if provided.
   */
  customIcon?: string;
  /**
   * Background color of the button (CSS value).
   * Defaults to the theme's primary color.
   */
  backgroundColor?: string;
  /**
   * Icon color (CSS value).
   * @default 'white'
   */
  iconColor?: string;
  /**
   * Button size - preset name or pixel value.
   * - 'small': 44px
   * - 'medium': 56px (default)
   * - 'large': 68px
   * @default 'medium'
   */
  size?: MobileTriggerSize | number;
  /**
   * Tooltip text and aria-label for accessibility.
   * @default 'Get help'
   */
  label?: string;
  /**
   * Offset from screen edges in pixels.
   * @default 24
   */
  offset?: number;
}

/**
 * Z-index configuration for the SDK root container.
 * Controls stacking order relative to host app content.
 */
export interface ZIndexConfig {
  /**
   * Z-index when panel is in push mode (shifts content aside).
   * Use a low value so the panel sits alongside content without
   * dominating the stacking order.
   * @default 1
   */
  push?: number;
  /**
   * Z-index when panel is in hover/overlay mode (floats over content).
   * Use a high value so the panel floats above host app content.
   * @default 9999
   */
  hover?: number;
}

export interface PillarConfig {
  /**
   * Your agent slug from the Pillar dashboard.
   * This is the primary identifier for your copilot agent.
   * Get it at app.trypillar.com
   */
  agentSlug?: string;

  /**
   * @deprecated Use `agentSlug` instead. Will be removed in a future version.
   */
  productKey?: string;
  
  /**
   * Display name for the assistant shown in the sidebar tab.
   * @default 'Copilot'
   */
  assistantDisplayName?: string;
  
  /**
   * Placeholder text shown in the chat input field.
   * @default 'Ask anything...'
   */
  inputPlaceholder?: string;
  
  /**
   * Welcome message shown in the home view.
   * @default 'Hi! How can I help you today?'
   */
  welcomeMessage?: string;
  
  /**
   * Platform identifier for code-first actions.
   * Used to filter actions by deployment platform.
   * @default 'web'
   */
  platform?: Platform;
  
  /**
   * App version for code-first actions.
   * Used to match actions to the correct deployment version.
   * @example '1.2.3' or git commit SHA
   */
  version?: string;
  
  /**
   * Enable debug mode for verbose logging and debug panel.
   * When enabled:
   * - All SDK events are logged to console
   * - A debug panel shows real-time execution flow
   * - Network requests/responses are captured
   * @default false
   */
  debug?: boolean;
  
  /** Panel layout and behavior settings. */
  panel?: PanelConfig;
  
  /** Edge trigger (sidebar tab that opens the panel). */
  edgeTrigger?: EdgeTriggerConfig;
  
  /** Mobile trigger (floating button on small screens). */
  mobileTrigger?: MobileTriggerConfig;
  
  /** URL params for auto-opening the panel. */
  urlParams?: UrlParamsConfig;
  
  /** Text selection "Ask AI" popover. */
  textSelection?: TextSelectionConfig;
  
  /**
   * DOM scanning for page context.
   * @internal DOM scanning is currently disabled.
   * @deprecated This feature is not available.
   */
  domScanning?: DOMScanningConfig;
  
  /** Page-aware suggestions. */
  suggestions?: SuggestionsConfig;
  
  /** Sidebar tabs configuration. */
  sidebarTabs?: SidebarTabConfig[];
  
  /** API base URL. Defaults to Pillar's production API. */
  apiBaseUrl?: string;
  
  /**
   * Enable OpenTelemetry tracing. Browser spans are exported to the server's
   * Cloud Trace project via the OTLP proxy endpoint. Also enabled when debug
   * is true.
   * @default false
   */
  tracing?: boolean;
  
  /** Theme customization. */
  theme?: ThemeConfig;
  
  /** 
   * Custom CSS to inject into the panel's Shadow DOM.
   * Use public class names (pillar-*) to override default styles.
   * @example
   * ```css
   * .pillar-header { padding: 24px; }
   * .pillar-message-user { border-radius: 8px; }
   * ```
   */
  customCSS?: string;
  
  /**
   * Z-index configuration for the SDK root container.
   * Controls stacking order relative to host app content.
   */
  zIndex?: ZIndexConfig;
  
  /**
   * Route prefixes where the SDK UI is hidden.
   * When the current pathname matches any entry (exact match or starts with
   * the entry followed by `/`), the panel, edge trigger, mobile trigger,
   * and text selection popover are all hidden. UI is restored when the user
   * navigates to a non-excluded route.
   *
   * Pass an empty array to show the SDK on every route.
   * @default ['/login', '/signup']
   * @example ['/login', '/signup', '/onboarding']
   */
  excludeRoutes?: string[];
  
  /**
   * User's API token for OpenAPI tool passthrough.
   * When set, Pillar forwards this as a Bearer token to API tool sources,
   * bypassing per-user OAuth linking. Useful when the user is already
   * authenticated in your app.
   */
  userApiToken?: string;
  
  /** Called when the SDK is initialized and ready. */
  onReady?: () => void;
  /** Called when the SDK encounters an error. */
  onError?: (error: Error) => void;
}

export interface ResolvedPanelConfig {
  enabled: boolean;
  position: PanelPosition;
  mode: PanelMode;
  width: number;
  /** Custom mount point - undefined means document.body */
  container?: string | HTMLElement | 'manual';
  /** Whether to use Shadow DOM for style isolation */
  useShadowDOM: boolean;
  /** Viewport width below which panel hovers instead of pushes. false = always push. */
  hoverBreakpoint: number | false;
  /** Whether to show backdrop when in hover mode */
  hoverBackdrop: boolean;
  /** Viewport width below which panel takes full screen width */
  fullWidthBreakpoint: number;
  /** Whether to open the panel automatically on initialization */
  initialOpen: boolean;
  /** Whether the panel can be resized by dragging its edge */
  resizable: boolean;
  /** Target element for push mode padding (undefined = document.documentElement) */
  pushTarget?: string | HTMLElement;
}

export interface ResolvedMobileTriggerConfig {
  enabled: boolean;
  breakpoint: number;
  position: MobileTriggerPosition;
  icon: MobileTriggerIcon;
  customIcon?: string;
  backgroundColor?: string;
  iconColor: string;
  size: MobileTriggerSize | number;
  label: string;
  offset: number;
}

export interface ResolvedThemeConfig {
  mode: ThemeMode;
  colors: ThemeColors;
  darkColors: ThemeColors;
  fontFamily?: string;
}

export interface ResolvedInteractionHighlightConfig {
  enabled: boolean;
  outlineColor: string;
  outlineWidth: number;
  outlineOffset: number;
  duration: number;
  scrollIntoView: boolean;
  scrollBehavior: ScrollBehavior;
}

export interface ResolvedDOMScanningConfig {
  enabled: boolean;
  includeText: boolean;
  maxDepth: number;
  visibleOnly: boolean;
  excludeSelector?: string;
  maxTextLength: number;
  interactionHighlight: ResolvedInteractionHighlightConfig;
}

export interface ResolvedSuggestionsConfig {
  enabled: boolean;
  debounceMs: number;
  displayLimit: number;
}

export interface ResolvedConfig {
  productKey: string;
  agentSlug?: string;
  apiBaseUrl: string;
  
  /** Display name for the assistant shown in the sidebar tab */
  assistantDisplayName: string;
  /** Placeholder text shown in the chat input field */
  inputPlaceholder: string;
  /** Welcome message shown in the home view */
  welcomeMessage: string;
  /** Platform for code-first actions (default: 'web') */
  platform: Platform;
  /** App version for code-first actions (optional) */
  version?: string;
  /** Debug mode enabled */
  debug: boolean;
  /** OpenTelemetry tracing enabled */
  tracing: boolean;
  
  panel: ResolvedPanelConfig;
  edgeTrigger: Required<EdgeTriggerConfig>;
  mobileTrigger: ResolvedMobileTriggerConfig;
  urlParams: Required<UrlParamsConfig>;
  textSelection: Required<TextSelectionConfig>;
  domScanning: ResolvedDOMScanningConfig;
  suggestions: ResolvedSuggestionsConfig;
  sidebarTabs: SidebarTabConfig[];
  theme: ResolvedThemeConfig;
  customCSS?: string;
  zIndex: Required<ZIndexConfig>;
  /** Route prefixes where the SDK UI is hidden */
  excludeRoutes: string[];
  
  onReady?: () => void;
  onError?: (error: Error) => void;
}

export const DEFAULT_CONFIG: Omit<ResolvedConfig, 'productKey'> = {
  apiBaseUrl: 'https://help-api.trypillar.com',
  assistantDisplayName: 'Copilot',
  inputPlaceholder: 'Ask anything...',
  welcomeMessage: 'Hi! How can I help you today?',
  platform: 'web',
  debug: false,
  tracing: false,
  
  panel: {
    enabled: true,
    position: 'right',
    mode: 'push',
    width: 380,
    useShadowDOM: false,
    hoverBreakpoint: 1200,
    hoverBackdrop: true,
    fullWidthBreakpoint: 500,
    initialOpen: false,
    resizable: true,
  },
  
  edgeTrigger: {
    enabled: true,
    resizable: true,
  },
  
  mobileTrigger: {
    enabled: true,
    breakpoint: 700,
    position: 'bottom-right',
    icon: 'sparkle',
    iconColor: 'white',
    size: 'medium',
    label: 'Get help',
    offset: 24,
  },
  
  urlParams: {
    enabled: true,
    prefix: 'pillar-',
    clearAfterOpen: true,
  },
  
  textSelection: {
    enabled: true,
    label: 'Ask AI',
  },
  
  domScanning: {
    enabled: false,
    includeText: true,
    maxDepth: 20,
    visibleOnly: true,
    maxTextLength: 500,
    interactionHighlight: {
      enabled: true,
      outlineColor: '#3b82f6',
      outlineWidth: 2,
      outlineOffset: 2,
      duration: 2000,
      scrollIntoView: true,
      scrollBehavior: 'smooth',
    },
  },
  
  suggestions: {
    enabled: true,
    debounceMs: 100,
    displayLimit: 3,
  },
  
  sidebarTabs: DEFAULT_SIDEBAR_TABS,
  
  theme: {
    mode: 'auto',
    colors: {},
    darkColors: {},
  },
  
  zIndex: {
    push: 1,
    hover: 9999,
  },
  
  excludeRoutes: ['/login', '/signup'],
};

/**
 * Merge user-provided sidebar tabs with defaults.
 * User tabs override default tabs by id. Assistant tab is always included.
 */
function mergeSidebarTabs(userTabs?: SidebarTabConfig[]): SidebarTabConfig[] {
  if (!userTabs || userTabs.length === 0) {
    return DEFAULT_SIDEBAR_TABS;
  }
  
  // Create a map of user tabs by id
  const tabMap = new Map<string, SidebarTabConfig>();
  
  // Start with defaults
  for (const tab of DEFAULT_SIDEBAR_TABS) {
    tabMap.set(tab.id, { ...tab });
  }
  
  // Override/add with user tabs
  for (const tab of userTabs) {
    tabMap.set(tab.id, { ...tab });
  }
  
  // Ensure assistant tab is always enabled
  const assistantTab = tabMap.get('assistant');
  if (assistantTab) {
    assistantTab.enabled = true;
  }
  
  // Sort by order and return
  return Array.from(tabMap.values()).sort((a, b) => a.order - b.order);
}

export function resolveConfig(config: PillarConfig): ResolvedConfig {
  const resolvedKey = config.agentSlug ?? config.productKey;
  if (!resolvedKey) {
    throw new Error('[Pillar] agentSlug (or productKey) is required');
  }
  
  return {
    productKey: resolvedKey,
    agentSlug: config.agentSlug,
    apiBaseUrl: config.apiBaseUrl || DEFAULT_CONFIG.apiBaseUrl,
    assistantDisplayName: config.assistantDisplayName || DEFAULT_CONFIG.assistantDisplayName,
    inputPlaceholder: config.inputPlaceholder || DEFAULT_CONFIG.inputPlaceholder,
    welcomeMessage: config.welcomeMessage || DEFAULT_CONFIG.welcomeMessage,
    platform: config.platform || 'web',
    version: config.version,
    debug: config.debug ?? false,
    tracing: config.tracing ?? config.debug ?? false,
    
    panel: {
      ...DEFAULT_CONFIG.panel,
      ...config.panel,
    },
    
    edgeTrigger: {
      ...DEFAULT_CONFIG.edgeTrigger,
      ...config.edgeTrigger,
    },
    
    mobileTrigger: {
      ...DEFAULT_CONFIG.mobileTrigger,
      ...config.mobileTrigger,
    },
    
    urlParams: {
      ...DEFAULT_CONFIG.urlParams,
      ...config.urlParams,
    },
    
    textSelection: {
      ...DEFAULT_CONFIG.textSelection,
      ...config.textSelection,
    },
    
    // DOM scanning is disabled - always force enabled: false
    domScanning: {
      ...DEFAULT_CONFIG.domScanning,
      ...config.domScanning,
      enabled: false, // DOM scanning is disabled
      interactionHighlight: {
        ...DEFAULT_CONFIG.domScanning.interactionHighlight,
        ...config.domScanning?.interactionHighlight,
      },
    },
    
    suggestions: {
      ...DEFAULT_CONFIG.suggestions,
      ...config.suggestions,
    },
    
    // Merge sidebar tabs: user tabs override defaults by id
    sidebarTabs: mergeSidebarTabs(config.sidebarTabs),
    
    theme: {
      mode: config.theme?.mode ?? DEFAULT_CONFIG.theme.mode,
      colors: { ...config.theme?.colors },
      darkColors: { ...config.theme?.darkColors },
      fontFamily: config.theme?.fontFamily,
    },
    
    customCSS: config.customCSS,
    
    zIndex: {
      ...DEFAULT_CONFIG.zIndex,
      ...config.zIndex,
    },
    
    excludeRoutes: config.excludeRoutes ?? DEFAULT_CONFIG.excludeRoutes,
    
    onReady: config.onReady,
    onError: config.onError,
  };
}

/**
 * Server embed config type (matches backend response)
 */
export interface ServerEmbedConfig {
  /** Display name for the assistant (from config.ai.assistantName) */
  assistantDisplayName?: string;
  /** Placeholder text for the chat input (from config.ai.inputPlaceholder) */
  inputPlaceholder?: string;
  /** Welcome message shown in the home view (from config.ai.welcomeMessage) */
  welcomeMessage?: string;
  panel?: {
    enabled?: boolean;
    position?: 'left' | 'right';
    width?: number;
  };
  floatingButton?: {
    enabled?: boolean;
    position?: string;
    label?: string;
  };
  theme?: {
    colors?: {
      primary?: string;
    };
  };
  security?: {
    /** False when the requesting origin is not in the product's allowed domains list. */
    originAllowed?: boolean;
  };
}

/**
 * Merge server config with local config.
 * 
 * Priority: DEFAULT_CONFIG < serverConfig < localConfig
 * 
 * Server values fill in gaps (admin-configured defaults),
 * but local config (passed to Pillar.init()) always wins.
 * 
 * @param localConfig - Config passed to Pillar.init()
 * @param serverConfig - Config fetched from /api/public/products/{subdomain}/embed-config/
 * @returns Merged config with server values filling in gaps
 */
export function mergeServerConfig(
  localConfig: PillarConfig,
  serverConfig: ServerEmbedConfig | null
): PillarConfig {
  if (!serverConfig) {
    return localConfig;
  }
  
  const merged: PillarConfig = { ...localConfig };
  
  // Panel: server provides defaults, local overrides
  if (serverConfig.panel) {
    merged.panel = {
      ...serverConfig.panel,
      ...localConfig.panel,
    };
  }
  
  // Theme: merge colors from server if local doesn't specify
  if (serverConfig.theme?.colors?.primary) {
    merged.theme = {
      ...merged.theme,
      colors: {
        primary: localConfig.theme?.colors?.primary ?? serverConfig.theme.colors.primary,
        ...localConfig.theme?.colors,
      },
    };
  }
  
  // Assistant display name: server provides default, local overrides
  if (serverConfig.assistantDisplayName && !localConfig.assistantDisplayName) {
    merged.assistantDisplayName = serverConfig.assistantDisplayName;
  }
  
  // Input placeholder: server provides default, local overrides
  if (serverConfig.inputPlaceholder && !localConfig.inputPlaceholder) {
    merged.inputPlaceholder = serverConfig.inputPlaceholder;
  }
  
  // Welcome message: server provides default, local overrides
  if (serverConfig.welcomeMessage && !localConfig.welcomeMessage) {
    merged.welcomeMessage = serverConfig.welcomeMessage;
  }
  
  return merged;
}

/**
 * Warn about config mismatches between local and server config.
 * 
 * Helps developers notice when their code-defined settings differ
 * from admin dashboard settings. Local config always takes precedence.
 * 
 * @param localConfig - Config passed to Pillar.init()
 * @param serverConfig - Config fetched from server
 */
export function warnConfigMismatches(
  localConfig: PillarConfig,
  serverConfig: ServerEmbedConfig | null
): void {
  if (!serverConfig) return;
  
  const mismatches: string[] = [];
  
  // assistantDisplayName
  if (
    localConfig.assistantDisplayName &&
    serverConfig.assistantDisplayName &&
    localConfig.assistantDisplayName !== serverConfig.assistantDisplayName
  ) {
    mismatches.push(
      `assistantDisplayName: local="${localConfig.assistantDisplayName}" vs server="${serverConfig.assistantDisplayName}"`
    );
  }
  
  // inputPlaceholder
  if (
    localConfig.inputPlaceholder &&
    serverConfig.inputPlaceholder &&
    localConfig.inputPlaceholder !== serverConfig.inputPlaceholder
  ) {
    mismatches.push(
      `inputPlaceholder: local="${localConfig.inputPlaceholder}" vs server="${serverConfig.inputPlaceholder}"`
    );
  }
  
  // welcomeMessage
  if (
    localConfig.welcomeMessage &&
    serverConfig.welcomeMessage &&
    localConfig.welcomeMessage !== serverConfig.welcomeMessage
  ) {
    mismatches.push(
      `welcomeMessage: local="${localConfig.welcomeMessage}" vs server="${serverConfig.welcomeMessage}"`
    );
  }
  
  // theme.colors.primary
  const localPrimary = localConfig.theme?.colors?.primary;
  const serverPrimary = serverConfig.theme?.colors?.primary;
  if (localPrimary && serverPrimary && localPrimary !== serverPrimary) {
    mismatches.push(
      `theme.colors.primary: local="${localPrimary}" vs server="${serverPrimary}"`
    );
  }
  
  if (mismatches.length > 0) {
    // Use console.warn directly so this always shows (not just in debug mode)
    console.warn(
      `[Pillar] Config mismatch detected (local config will take precedence):\n  - ${mismatches.join('\n  - ')}`
    );
  }
}

