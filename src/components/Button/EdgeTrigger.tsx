/**
 * Edge Trigger Component
 * A sidebar-style trigger that reserves space in the layout and slides out with the panel.
 * The trigger stays visible when panel opens, positioned at the panel's outer edge.
 */

import { render } from "preact";
import { useCallback } from "preact/hooks";
import type {
  ResolvedConfig,
  SidebarTabConfig,
  ThemeColors,
} from "../../core/config";
import type { EventEmitter } from "../../core/events";
import {
  activeTab,
  isHoverMode,
  isMobileMode,
  isOpen,
  width as panelWidth,
  setActiveTab,
} from "../../store/panel";
import { injectStyles } from "../../utils/dom";

// Preset icons for sidebar tabs (Lucide icon set)
const PRESET_ICONS = {
  help: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
  support: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path></svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
  feedback: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`,
  chat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>`,
  calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
  mail: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>`,
} as const;

// Map of tab ids to their default icons (for backward compatibility)
const TAB_ICONS: Record<string, string> = {
  assistant: PRESET_ICONS.help,
  support: PRESET_ICONS.support,
};

const getTabIcon = (tabId: string, icon?: string): string => {
  // First check if a custom icon preset is specified
  if (icon && icon in PRESET_ICONS) {
    return PRESET_ICONS[icon as keyof typeof PRESET_ICONS];
  }
  // Fall back to tab id mapping, then default to help icon
  return TAB_ICONS[tabId] || PRESET_ICONS.help;
};

// Width of the sidebar trigger
const TRIGGER_WIDTH = 48;

// Base styles use SDK theme variables for consistency with Panel
const EDGE_TRIGGER_STYLES = `
/* Sidebar container - always visible, shifts when panel opens */
.pillar-edge-sidebar {
  position: fixed;
  top: 0;
  bottom: 0;
  width: ${TRIGGER_WIDTH}px;
  z-index: 100000;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--pillar-bg);
  border-left: 1px solid var(--pillar-border);
  transition: right 0.3s ease, left 0.3s ease;
}

.pillar-edge-sidebar--right {
  right: 0;
  border-left: 1px solid var(--pillar-border);
  border-right: none;
}

.pillar-edge-sidebar--left {
  left: 0;
  border-right: 1px solid var(--pillar-border);
  border-left: none;
}

/* When panel is open, shift the trigger to sit at the panel's outer edge */
.pillar-edge-sidebar--right.pillar-edge-sidebar--panel-open {
  right: var(--pillar-panel-width, 380px);
}

.pillar-edge-sidebar--left.pillar-edge-sidebar--panel-open {
  left: var(--pillar-panel-width, 380px);
}

/* The trigger button - vertical sideways text */
.pillar-edge-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 8px;
  margin-top: 8px;
  font-family: var(--pillar-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif);
  font-size: 12px;
  font-weight: 500;
  color: var(--pillar-text-muted);
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
  outline: none;
  gap: 8px;
  writing-mode: vertical-rl;
  text-orientation: mixed;
}

.pillar-edge-trigger:hover {
  background: var(--pillar-bg-secondary);
  color: var(--pillar-primary);
}

.pillar-edge-trigger--active {
  background: var(--pillar-primary-light, rgba(194, 65, 12, 0.1));
  color: var(--pillar-primary);
}

.pillar-edge-trigger--active .pillar-edge-trigger__icon {
  opacity: 1;
  color: var(--pillar-primary);
}

.pillar-edge-trigger:focus-visible {
  background: var(--pillar-bg-secondary);
  box-shadow: 0 0 0 2px var(--pillar-primary);
}

.pillar-edge-trigger__icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  opacity: 0.8;
}

.pillar-edge-trigger:hover .pillar-edge-trigger__icon {
  opacity: 1;
  color: var(--pillar-primary);
}

.pillar-edge-trigger__label {
  white-space: nowrap;
  letter-spacing: 0.5px;
}

/* Animation on mount */
@keyframes pillar-sidebar-mount {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.pillar-edge-sidebar--mounted {
  animation: pillar-sidebar-mount 0.2s ease forwards;
}
`;

/**
 * Generate theme CSS variables for the edge trigger
 * Uses the same variable names as Panel for consistency
 */
function generateEdgeTriggerThemeCSS(
  colors: ThemeColors,
  darkColors: ThemeColors
): string {
  const generateVars = (c: ThemeColors): string => {
    const lines: string[] = [];
    if (c.primary) lines.push(`--pillar-primary: ${c.primary};`);
    if (c.primaryHover)
      lines.push(`--pillar-primary-hover: ${c.primaryHover};`);
    if (c.background) lines.push(`--pillar-bg: ${c.background};`);
    if (c.backgroundSecondary)
      lines.push(`--pillar-bg-secondary: ${c.backgroundSecondary};`);
    if (c.text) lines.push(`--pillar-text: ${c.text};`);
    if (c.textMuted) lines.push(`--pillar-text-muted: ${c.textMuted};`);
    if (c.border) lines.push(`--pillar-border: ${c.border};`);
    if (c.borderLight) lines.push(`--pillar-border-light: ${c.borderLight};`);
    return lines.join("\n    ");
  };

  const lightVars = generateVars(colors);
  const darkVars = generateVars(darkColors);

  let css = "";

  // Light mode (default)
  if (lightVars) {
    css += `
.pillar-edge-sidebar,
.pillar-edge-sidebar--light {
    ${lightVars}
}
`;
  }

  // Dark mode
  if (darkVars) {
    css += `
.pillar-edge-sidebar--dark {
    ${darkVars}
}
`;
  }

  return css;
}

interface EdgeTriggerContentProps {
  position: "left" | "right";
  tabs: SidebarTabConfig[];
  currentActiveTab: string;
  onTabClick: (tabId: string) => void;
  panelOpen: boolean;
  panelWidthPx: number;
  theme: "light" | "dark";
}

function EdgeTriggerContent({
  position,
  tabs,
  currentActiveTab,
  onTabClick,
  panelOpen,
  panelWidthPx,
  theme,
}: EdgeTriggerContentProps) {
  const handleTabClick = useCallback(
    (tabId: string) => {
      onTabClick(tabId);
    },
    [onTabClick]
  );

  const sidebarClassName = [
    "pillar-edge-sidebar",
    `pillar-edge-sidebar--${position}`,
    "pillar-edge-sidebar--mounted",
    panelOpen && "pillar-edge-sidebar--panel-open",
    // Apply explicit theme class
    theme === "light" && "pillar-edge-sidebar--light",
    theme === "dark" && "pillar-edge-sidebar--dark",
  ]
    .filter(Boolean)
    .join(" ");

  // Set the panel width CSS variable for positioning
  const style = {
    "--pillar-panel-width": `${panelWidthPx}px`,
  };

  // Filter to enabled tabs and sort by order
  const enabledTabs = tabs
    .filter((t) => t.enabled)
    .sort((a, b) => a.order - b.order);

  return (
    <div class={sidebarClassName} style={style}>
      {enabledTabs.map((tab) => {
        const isActive = panelOpen && currentActiveTab === tab.id;
        const buttonClassName = [
          "pillar-edge-trigger",
          isActive && "pillar-edge-trigger--active",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <button
            key={tab.id}
            class={buttonClassName}
            onClick={() => handleTabClick(tab.id)}
            aria-label={tab.label || "Help"}
            type="button"
          >
            <span
              class="pillar-edge-trigger__icon"
              dangerouslySetInnerHTML={{ __html: getTabIcon(tab.id, tab.icon) }}
            />
            <span class="pillar-edge-trigger__label">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export type EdgeTriggerPosition = "left" | "right";

/**
 * EdgeTrigger class that manages the edge trigger lifecycle
 * The trigger stays visible when panel opens, sliding out with it
 */
export class EdgeTrigger {
  private config: ResolvedConfig;
  private events: EventEmitter;
  private onClick: () => void;
  private rootContainer: HTMLElement | null;
  private container: HTMLElement | null = null;
  private stylesInjected = false;
  private themeStylesInjected = false;
  private _isHidden = false;
  private unsubscribeOpen: (() => void) | null = null;
  private unsubscribeWidth: (() => void) | null = null;
  private unsubscribeHoverMode: (() => void) | null = null;
  private unsubscribeMobileMode: (() => void) | null = null;
  private unsubscribeActiveTab: (() => void) | null = null;
  private themeObserver: MutationObserver | null = null;
  private currentTheme: "light" | "dark" = "light";

  constructor(
    config: ResolvedConfig,
    events: EventEmitter,
    onClick: () => void,
    rootContainer?: HTMLElement | null
  ) {
    this.config = config;
    this.events = events;
    this.onClick = onClick;
    this.rootContainer = rootContainer || null;
  }

  /**
   * Handle tab click - sets active tab and opens panel
   * For non-assistant tabs, emits event for customer's code to handle (e.g., Intercom, Zendesk)
   */
  private handleTabClick = (tabId: string) => {
    // For any non-assistant tab, emit sidebar:click event for customer code to handle
    if (tabId !== 'assistant') {
      const tab = this.config.sidebarTabs.find(t => t.id === tabId);
      this.events.emit('sidebar:click', { tabId, label: tab?.label || tabId });
      
      // Backward compatibility: also emit support:request for 'support' tab
      if (tabId === 'support') {
        this.events.emit('support:request', { tabId });
      }
      
      // Don't open panel - let customer's code handle UI
      return;
    }

    setActiveTab(tabId);
    // Always open panel when clicking a tab
    if (!isOpen.value) {
      this.onClick();
    }
    this.render();
  };

  /**
   * Get position as 'left' or 'right' from the panel position config
   */
  private getEdgePosition(): "left" | "right" {
    return this.config.panel.position;
  }

  /**
   * Detect the current theme from the document
   * Checks for .dark class (next-themes) or data-theme attribute
   * Returns explicit 'light' or 'dark' to match app theme (not system preference)
   */
  private detectTheme(): "light" | "dark" {
    const html = document.documentElement;

    // Check for .dark class (next-themes pattern - most common)
    if (html.classList.contains("dark")) return "dark";

    // Check for data-theme attribute (SDK pattern)
    const dataTheme = html.getAttribute("data-theme");
    if (dataTheme === "dark") return "dark";

    // Check for color-scheme style
    if (html.style.colorScheme === "dark") return "dark";

    // Default to light (web default, matches next-themes behavior where
    // dark class is added for dark mode, removed for light mode)
    return "light";
  }

  /**
   * Initialize the edge trigger
   */
  init(): void {
    // Inject base styles
    if (!this.stylesInjected) {
      injectStyles(document, EDGE_TRIGGER_STYLES, "pillar-edge-trigger-styles");
      this.stylesInjected = true;
    }

    // Inject theme styles from config
    if (!this.themeStylesInjected) {
      const themeCSS = generateEdgeTriggerThemeCSS(
        this.config.theme.colors,
        this.config.theme.darkColors
      );
      if (themeCSS) {
        injectStyles(document, themeCSS, "pillar-edge-trigger-theme");
      }
      this.themeStylesInjected = true;
    }

    // Create container and append to root container (for stacking context isolation)
    this.container = document.createElement("div");
    this.container.id = "pillar-edge-trigger-container";
    const mountTarget = this.rootContainer || document.body;
    mountTarget.appendChild(this.container);

    // Detect initial theme
    this.currentTheme = this.detectTheme();

    // Reserve space in the layout by adding padding (trigger width only)
    this.applyLayoutPadding();

    // Initial render
    this.render();

    // Subscribe to panel state changes
    this.unsubscribeOpen = isOpen.subscribe(() => {
      this.render();
      // Use microtask to ensure this runs AFTER Panel's push mode padding
      // so EdgeTrigger's padding (which includes trigger width) takes precedence
      queueMicrotask(() => this.applyLayoutPadding());
    });

    // Subscribe to panel width changes
    this.unsubscribeWidth = panelWidth.subscribe(() => {
      this.render();
      queueMicrotask(() => this.applyLayoutPadding());
    });

    // Subscribe to hover mode changes (viewport crossing breakpoint)
    this.unsubscribeHoverMode = isHoverMode.subscribe(() => {
      // Update padding when hover mode changes (affects whether panel takes space)
      queueMicrotask(() => this.applyLayoutPadding());
    });

    // Subscribe to mobile mode changes (edge trigger hides on mobile)
    this.unsubscribeMobileMode = isMobileMode.subscribe((inMobileMode) => {
      if (inMobileMode) {
        this.hide();
      } else {
        this.show();
      }
    });

    // Apply initial mobile mode state
    if (isMobileMode.value) {
      this.hide();
    }

    // Subscribe to active tab changes
    this.unsubscribeActiveTab = activeTab.subscribe(() => {
      this.render();
    });

    // Watch for theme changes on documentElement
    this.themeObserver = new MutationObserver(() => {
      const newTheme = this.detectTheme();
      if (newTheme !== this.currentTheme) {
        this.currentTheme = newTheme;
        this.render();
      }
    });

    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "style"],
    });
  }

  /**
   * Apply padding to reserve space for trigger + panel (when open in push mode)
   * In hover mode, only reserve trigger width even when panel is open
   */
  private applyLayoutPadding(): void {
    if (this._isHidden) return;

    const position = this.getEdgePosition();
    const currentPanelWidth = panelWidth.value;
    const inHoverMode = isHoverMode.value;

    // Calculate total width to reserve:
    // - When panel is closed: just trigger width
    // - When panel is open AND in push mode: trigger + panel width
    // - When panel is open AND in hover mode: just trigger width (panel floats over content)
    let totalWidth = TRIGGER_WIDTH;

    if (isOpen.value && !inHoverMode) {
      // Push mode: reserve space for both trigger and panel
      totalWidth = currentPanelWidth + TRIGGER_WIDTH;
    }

    document.documentElement.style.transition = "padding 0.3s ease";

    if (position === "right") {
      document.documentElement.style.paddingRight = `${totalWidth}px`;
      document.documentElement.style.setProperty("--pillar-inset-right", `${totalWidth}px`);
      document.documentElement.style.setProperty("--pillar-inset-left", "0px");
    } else {
      document.documentElement.style.paddingLeft = `${totalWidth}px`;
      document.documentElement.style.setProperty("--pillar-inset-left", `${totalWidth}px`);
      document.documentElement.style.setProperty("--pillar-inset-right", "0px");
    }
  }

  /**
   * Remove layout padding
   */
  private removeLayoutPadding(): void {
    const position = this.getEdgePosition();
    if (position === "right") {
      document.documentElement.style.paddingRight = "";
    } else {
      document.documentElement.style.paddingLeft = "";
    }
    document.documentElement.style.removeProperty("--pillar-inset-right");
    document.documentElement.style.removeProperty("--pillar-inset-left");
  }

  /**
   * Set the open state (to update visibility when panel opens)
   */
  setOpen(_isOpen: boolean): void {
    this.render();
  }

  /**
   * Show the trigger
   */
  show(): void {
    this._isHidden = false;
    if (this.container) {
      this.container.style.display = "";
    }
    this.applyLayoutPadding();
    this.render();
  }

  /**
   * Hide the trigger
   */
  hide(): void {
    this._isHidden = true;
    if (this.container) {
      this.container.style.display = "none";
    }
    this.removeLayoutPadding();
  }

  /**
   * Update trigger position
   */
  setPosition(position: EdgeTriggerPosition): void {
    this.removeLayoutPadding();
    this.config.panel.position = position;
    this.applyLayoutPadding();
    this.render();
  }

  /**
   * Destroy the trigger
   */
  destroy(): void {
    this.unsubscribeOpen?.();
    this.unsubscribeOpen = null;
    this.unsubscribeWidth?.();
    this.unsubscribeWidth = null;
    this.unsubscribeHoverMode?.();
    this.unsubscribeHoverMode = null;
    this.unsubscribeMobileMode?.();
    this.unsubscribeMobileMode = null;
    this.unsubscribeActiveTab?.();
    this.unsubscribeActiveTab = null;
    this.themeObserver?.disconnect();
    this.themeObserver = null;

    this.removeLayoutPadding();

    if (this.container) {
      render(null, this.container);
      this.container.remove();
    }
    this.container = null;
    document.getElementById("pillar-edge-trigger-styles")?.remove();
    document.getElementById("pillar-edge-trigger-theme")?.remove();
    this.stylesInjected = false;
    this.themeStylesInjected = false;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private render(): void {
    if (!this.container || this._isHidden) return;

    const position = this.getEdgePosition();
    const tabs = this.config.sidebarTabs;

    render(
      <EdgeTriggerContent
        position={position}
        tabs={tabs}
        currentActiveTab={activeTab.value}
        onTabClick={this.handleTabClick}
        panelOpen={isOpen.value}
        panelWidthPx={panelWidth.value}
        theme={this.currentTheme}
      />,
      this.container
    );
  }
}
