/**
 * Pillar SDK Configuration Types
 */
import type { Platform } from '../actions/types';

export type PanelPosition = 'left' | 'right';
export type PanelMode = 'overlay' | 'push';
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
  icon?: 'help' | 'support' | 'settings' | 'feedback' | 'chat' | 'calendar' | 'mail';
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
}

export interface PanelConfig {
  enabled?: boolean;
  position?: PanelPosition;
  /** Panel mode: 'overlay' slides over content, 'push' shifts content aside */
  mode?: PanelMode;
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

export interface DOMScanningConfig {
  /**
   * Whether DOM scanning is enabled.
   * When enabled, page structure is captured and sent with messages.
   * @default false
   */
  enabled?: boolean;
  /**
   * Whether to include text content in the scan.
   * @default true
   */
  includeText?: boolean;
  /**
   * Maximum depth to traverse the DOM tree.
   * @default 20
   */
  maxDepth?: number;
  /**
   * Whether to only include visible elements.
   * @default true
   */
  visibleOnly?: boolean;
  /**
   * CSS selector for elements to exclude from scanning.
   * @example '.sidebar, .footer, [data-no-scan]'
   */
  excludeSelector?: string;
  /**
   * Maximum text length before truncation.
   * @default 500
   */
  maxTextLength?: number;
  /**
   * Configuration for highlighting elements during AI interactions.
   */
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
}

export type MobileTriggerPosition = 'bottom-right' | 'bottom-left';
export type MobileTriggerIcon = 'sparkle' | 'question' | 'help' | 'chat' | 'support';
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

export interface PillarConfig {
  /**
   * Your product key from the Pillar app.
   * Get it at app.trypillar.com
   */
  productKey?: string;
  
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
  
  // Panel settings
  panel?: PanelConfig;
  
  // Edge trigger (sidebar tab that opens the panel)
  edgeTrigger?: EdgeTriggerConfig;
  
  // Mobile trigger (floating button on small screens)
  mobileTrigger?: MobileTriggerConfig;
  
  // URL params for auto-opening the panel
  urlParams?: UrlParamsConfig;
  
  // Text selection "Ask AI" popover
  textSelection?: TextSelectionConfig;
  
  // DOM scanning for page context
  domScanning?: DOMScanningConfig;
  
  // Page-aware suggestions
  suggestions?: SuggestionsConfig;
  
  // Sidebar tabs configuration
  sidebarTabs?: SidebarTabConfig[];
  
  // API base URL (defaults to production)
  apiBaseUrl?: string;
  
  // Theme customization
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
  
  // Callbacks
  onReady?: () => void;
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
  apiBaseUrl: string;
  
  /** Platform for code-first actions (default: 'web') */
  platform: Platform;
  /** App version for code-first actions (optional) */
  version?: string;
  /** Debug mode enabled */
  debug: boolean;
  
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
  
  onReady?: () => void;
  onError?: (error: Error) => void;
}

export const DEFAULT_CONFIG: Omit<ResolvedConfig, 'productKey' | 'publicKey'> = {
  apiBaseUrl: 'https://help-api.trypillar.com',
  platform: 'web',
  debug: false,
  
  panel: {
    enabled: true,
    position: 'right',
    mode: 'push',
    width: 380,
    useShadowDOM: false,
    hoverBreakpoint: 1200,
    hoverBackdrop: true,
    fullWidthBreakpoint: 500,
  },
  
  edgeTrigger: {
    enabled: true,
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
  if (!config.productKey) {
    throw new Error('[Pillar] productKey is required');
  }
  
  return {
    productKey: config.productKey,
    apiBaseUrl: config.apiBaseUrl || DEFAULT_CONFIG.apiBaseUrl,
    platform: config.platform || 'web',
    version: config.version,
    debug: config.debug ?? false,
    
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
    
    domScanning: {
      ...DEFAULT_CONFIG.domScanning,
      ...config.domScanning,
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
    },
    
    customCSS: config.customCSS,
    
    onReady: config.onReady,
    onError: config.onError,
  };
}

/**
 * Server embed config type (matches backend response)
 */
export interface ServerEmbedConfig {
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
  
  return merged;
}

