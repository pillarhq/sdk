/**
 * Edge Trigger Component
 * A sidebar-style trigger that reserves space in the layout and slides out with the panel.
 * The trigger stays visible when panel opens, positioned at the panel's outer edge.
 */

import { render } from "preact";
import { useCallback } from "preact/hooks";
import type {
  FloatingButtonPosition,
  ResolvedConfig,
  SidebarTabConfig,
  ThemeColors,
} from "../../core/config";
import {
  activeTab,
  isHoverMode,
  isOpen,
  width as panelWidth,
  setActiveTab,
} from "../../store/panel";
import { injectStyles } from "../../utils/dom";

const HELP_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;

const SUPPORT_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path></svg>`;

// Map of tab ids to their icons
const TAB_ICONS: Record<string, string> = {
  assistant: HELP_ICON,
  support: SUPPORT_ICON,
};

const getTabIcon = (tabId: string): string => TAB_ICONS[tabId] || HELP_ICON;

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
              dangerouslySetInnerHTML={{ __html: getTabIcon(tab.id) }}
            />
            <span class="pillar-edge-trigger__label">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * EdgeTrigger class that manages the edge trigger lifecycle
 * The trigger stays visible when panel opens, sliding out with it
 */
export class EdgeTrigger {
  private config: ResolvedConfig;
  private onClick: () => void;
  private rootContainer: HTMLElement | null;
  private container: HTMLElement | null = null;
  private stylesInjected = false;
  private themeStylesInjected = false;
  private _isHidden = false;
  private unsubscribeOpen: (() => void) | null = null;
  private unsubscribeWidth: (() => void) | null = null;
  private unsubscribeHoverMode: (() => void) | null = null;
  private unsubscribeActiveTab: (() => void) | null = null;
  private themeObserver: MutationObserver | null = null;
  private currentTheme: "light" | "dark" = "light";

  constructor(
    config: ResolvedConfig,
    onClick: () => void,
    rootContainer?: HTMLElement | null
  ) {
    this.config = config;
    this.onClick = onClick;
    this.rootContainer = rootContainer || null;
  }

  /**
   * Handle tab click - sets active tab and opens panel
   */
  private handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    // Always open panel when clicking a tab
    if (!isOpen.value) {
      this.onClick();
    }
    this.render();
  };

  /**
   * Get position as 'left' or 'right' from the floating button position config
   */
  private getEdgePosition(): "left" | "right" {
    const pos = this.config.floatingButton.position;
    return pos.includes("left") ? "left" : "right";
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
    } else {
      document.documentElement.style.paddingLeft = `${totalWidth}px`;
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
  setPosition(position: FloatingButtonPosition): void {
    this.removeLayoutPadding();
    this.config.floatingButton.position = position;
    this.applyLayoutPadding();
    this.render();
  }

  /**
   * Update trigger label
   */
  setLabel(label: string): void {
    this.config.floatingButton.label = label;
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
