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

export interface EdgeTriggerConfig {
  /**
   * Whether to show the edge trigger sidebar tab.
   * When enabled, a slim vertical tab appears on the screen edge that opens the panel.
   * @default true
   */
  enabled?: boolean;
}

export interface UserContext {
  id?: string;
  persona?: string;
  [key: string]: unknown;
}

export interface PillarConfig {
  helpCenter: string;
  publicKey: string;
  
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
  
  // Panel settings
  panel?: PanelConfig;
  
  // Edge trigger (sidebar tab that opens the panel)
  edgeTrigger?: EdgeTriggerConfig;
  
  // URL params for auto-opening the panel
  urlParams?: UrlParamsConfig;
  
  // Text selection "Ask AI" popover
  textSelection?: TextSelectionConfig;
  
  // Sidebar tabs configuration
  sidebarTabs?: SidebarTabConfig[];
  
  // User context for personalization
  context?: {
    page?: string;
    user?: UserContext;
  };
  
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
}

export interface ResolvedThemeConfig {
  mode: ThemeMode;
  colors: ThemeColors;
  darkColors: ThemeColors;
}

export interface ResolvedConfig {
  helpCenter: string;
  publicKey: string;
  apiBaseUrl: string;
  
  /** Platform for code-first actions (default: 'web') */
  platform: Platform;
  /** App version for code-first actions (optional) */
  version?: string;
  
  panel: ResolvedPanelConfig;
  edgeTrigger: Required<EdgeTriggerConfig>;
  urlParams: Required<UrlParamsConfig>;
  textSelection: Required<TextSelectionConfig>;
  sidebarTabs: SidebarTabConfig[];
  theme: ResolvedThemeConfig;
  customCSS?: string;
  
  context: {
    page?: string;
    user?: UserContext;
  };
  
  onReady?: () => void;
  onError?: (error: Error) => void;
}

export const DEFAULT_CONFIG: Omit<ResolvedConfig, 'helpCenter' | 'publicKey'> = {
  apiBaseUrl: 'https://api.trypillar.com',
  platform: 'web',
  
  panel: {
    enabled: true,
    position: 'right',
    mode: 'push',
    width: 380,
    useShadowDOM: false,
    hoverBreakpoint: 1200,
    hoverBackdrop: true,
  },
  
  edgeTrigger: {
    enabled: true,
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
  
  sidebarTabs: DEFAULT_SIDEBAR_TABS,
  
  theme: {
    mode: 'auto',
    colors: {},
    darkColors: {},
  },
  
  context: {},
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
  return {
    helpCenter: config.helpCenter,
    publicKey: config.publicKey,
    apiBaseUrl: config.apiBaseUrl || DEFAULT_CONFIG.apiBaseUrl,
    platform: config.platform || 'web',
    version: config.version,
    
    panel: {
      ...DEFAULT_CONFIG.panel,
      ...config.panel,
    },
    
    edgeTrigger: {
      ...DEFAULT_CONFIG.edgeTrigger,
      ...config.edgeTrigger,
    },
    
    urlParams: {
      ...DEFAULT_CONFIG.urlParams,
      ...config.urlParams,
    },
    
    textSelection: {
      ...DEFAULT_CONFIG.textSelection,
      ...config.textSelection,
    },
    
    // Merge sidebar tabs: user tabs override defaults by id
    sidebarTabs: mergeSidebarTabs(config.sidebarTabs),
    
    theme: {
      mode: config.theme?.mode ?? DEFAULT_CONFIG.theme.mode,
      colors: { ...config.theme?.colors },
      darkColors: { ...config.theme?.darkColors },
    },
    
    customCSS: config.customCSS,
    
    context: config.context || {},
    
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
  features?: {
    aiChatEnabled?: boolean;
    searchEnabled?: boolean;
    tooltipsEnabled?: boolean;
  };
  sidebarTabs?: SidebarTabConfig[];
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
  
  // Sidebar tabs: use server tabs if local not specified
  // If local specifies tabs, those take priority
  if (serverConfig.sidebarTabs && !localConfig.sidebarTabs) {
    merged.sidebarTabs = serverConfig.sidebarTabs;
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
  
  // Features could map to tooltips enabled, etc.
  // Currently we don't have a direct mapping, but this is where
  // serverConfig.features would be applied if needed
  
  return merged;
}

