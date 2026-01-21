/**
 * Mobile Trigger Component
 * A floating action button (FAB) that appears on small screens when the edge trigger is hidden.
 * Provides a way to open the help panel on mobile devices.
 */

import { render } from "preact";
import { useCallback } from "preact/hooks";
import type {
  ResolvedConfig,
  MobileTriggerIcon,
  MobileTriggerPosition,
  MobileTriggerSize,
} from "../../core/config";
import type { EventEmitter } from "../../core/events";
import {
  isMobileMode,
  isOpen,
} from "../../store/panel";
import { injectStyles } from "../../utils/dom";

// Preset icons for the mobile trigger
const PRESET_ICONS: Record<MobileTriggerIcon, string> = {
  // AI sparkles icon (two 4-pointed stars) - default
  sparkle: `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8.8 8.44L9.497 11l.697-2.56c.175-.643.263-.965.435-1.23a2 2 0 0 1 .583-.583c.263-.172.585-.259 1.23-.435l2.56-.697l-2.56-.697c-.643-.175-.964-.263-1.23-.435a2 2 0 0 1-.583-.583c-.172-.263-.259-.585-.435-1.23L9.497-.01L8.8 2.55c-.175.643-.263.965-.435 1.23a2 2 0 0 1-.583.583c-.263.172-.585.259-1.23.435l-2.56.697l2.56.697c.643.175.965.263 1.23.435a2 2 0 0 1 .583.583c.172.263.259.585.435 1.23M2.68 13.7c.169.244.264.542.456 1.14l.362 1.12l.362-1.12c.191-.595.287-.893.456-1.14c.149-.216.34-.4.561-.543c.249-.161.55-.247 1.15-.418l.971-.277l-.971-.277c-.601-.172-.902-.258-1.15-.418a2 2 0 0 1-.561-.543c-.169-.244-.264-.542-.456-1.14l-.362-1.12l-.362 1.12c-.191.595-.287.893-.456 1.14c-.149.216-.34.4-.561.543c-.249.161-.55.247-1.15.418l-.971.277l.971.277c.601.172.902.258 1.15.418a2 2 0 0 1 .561.543"/></svg>`,
  question: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
  help: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
  chat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>`,
  support: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path></svg>`,
};

// Size presets in pixels
const SIZE_PRESETS: Record<MobileTriggerSize, number> = {
  small: 44,
  medium: 56,
  large: 68,
};

// Base styles for the mobile trigger
const MOBILE_TRIGGER_STYLES = `
/* Mobile trigger floating button */
.pillar-mobile-trigger {
  position: fixed;
  z-index: 100000;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
  outline: none;
  -webkit-tap-highlight-color: transparent;
}

.pillar-mobile-trigger:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2), 0 3px 6px rgba(0, 0, 0, 0.12);
}

.pillar-mobile-trigger:active {
  transform: scale(0.95);
}

.pillar-mobile-trigger:focus-visible {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1), 0 0 0 3px rgba(255, 255, 255, 0.5), 0 0 0 5px var(--pillar-mobile-bg, #c2410c);
}

/* Position variants */
.pillar-mobile-trigger--bottom-right {
  bottom: var(--pillar-mobile-offset, 24px);
  right: var(--pillar-mobile-offset, 24px);
}

.pillar-mobile-trigger--bottom-left {
  bottom: var(--pillar-mobile-offset, 24px);
  left: var(--pillar-mobile-offset, 24px);
}

/* Icon styling */
.pillar-mobile-trigger__icon {
  width: 55%;
  height: 55%;
  flex-shrink: 0;
  transform: translateY(-1px);
}

/* Hidden state (when panel is open) */
.pillar-mobile-trigger--hidden {
  opacity: 0 !important;
  pointer-events: none;
  transform: scale(0.8) !important;
  visibility: hidden;
}

/* Animation on mount */
@keyframes pillar-mobile-trigger-mount {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.pillar-mobile-trigger--mounted {
  animation: pillar-mobile-trigger-mount 0.2s ease forwards;
}
`;

interface MobileTriggerContentProps {
  position: MobileTriggerPosition;
  icon: string;
  backgroundColor: string;
  iconColor: string;
  size: number;
  label: string;
  offset: number;
  panelOpen: boolean;
  onClick: () => void;
}

function MobileTriggerContent({
  position,
  icon,
  backgroundColor,
  iconColor,
  size,
  label,
  offset,
  panelOpen,
  onClick,
}: MobileTriggerContentProps) {
  const handleClick = useCallback(() => {
    onClick();
  }, [onClick]);

  const className = [
    "pillar-mobile-trigger",
    `pillar-mobile-trigger--${position}`,
    "pillar-mobile-trigger--mounted",
    panelOpen && "pillar-mobile-trigger--hidden",
  ]
    .filter(Boolean)
    .join(" ");

  const style = {
    "--pillar-mobile-offset": `${offset}px`,
    "--pillar-mobile-bg": backgroundColor,
    width: `${size}px`,
    height: `${size}px`,
    backgroundColor,
    color: iconColor,
  };

  return (
    <button
      class={className}
      style={style}
      onClick={handleClick}
      aria-label={label}
      title={label}
      type="button"
    >
      <span
        class="pillar-mobile-trigger__icon"
        dangerouslySetInnerHTML={{ __html: icon }}
      />
    </button>
  );
}

/**
 * MobileTrigger class that manages the mobile floating button lifecycle
 * The trigger appears on small screens when the viewport is below mobileBreakpoint
 */
export class MobileTrigger {
  private config: ResolvedConfig;
  private events: EventEmitter;
  private onClick: () => void;
  private rootContainer: HTMLElement | null;
  private container: HTMLElement | null = null;
  private stylesInjected = false;
  private _isEnabled = true;
  private unsubscribeMobileMode: (() => void) | null = null;
  private unsubscribeOpen: (() => void) | null = null;

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
    this._isEnabled = config.mobileTrigger.enabled;
  }

  /**
   * Get the resolved size in pixels
   */
  private getSize(): number {
    const size = this.config.mobileTrigger.size;
    if (typeof size === "number") {
      return size;
    }
    return SIZE_PRESETS[size];
  }

  /**
   * Get the icon SVG string
   */
  private getIcon(): string {
    const { customIcon, icon } = this.config.mobileTrigger;
    if (customIcon) {
      return customIcon;
    }
    return PRESET_ICONS[icon];
  }

  /**
   * Get the background color (use theme primary as default)
   */
  private getBackgroundColor(): string {
    const { backgroundColor } = this.config.mobileTrigger;
    if (backgroundColor) {
      return backgroundColor;
    }
    // Use theme primary color or default orange
    return this.config.theme.colors.primary || "#c2410c";
  }

  /**
   * Initialize the mobile trigger
   */
  init(): void {
    if (!this._isEnabled) return;

    // Inject styles
    if (!this.stylesInjected) {
      injectStyles(document, MOBILE_TRIGGER_STYLES, "pillar-mobile-trigger-styles");
      this.stylesInjected = true;
    }

    // Create container
    this.container = document.createElement("div");
    this.container.id = "pillar-mobile-trigger-container";
    const mountTarget = this.rootContainer || document.body;
    mountTarget.appendChild(this.container);

    // Subscribe to mobile mode changes
    this.unsubscribeMobileMode = isMobileMode.subscribe(() => {
      this.render();
    });

    // Subscribe to panel open state
    this.unsubscribeOpen = isOpen.subscribe(() => {
      this.render();
    });

    // Initial render
    this.render();
  }

  /**
   * Show the trigger (enable it)
   */
  show(): void {
    this._isEnabled = true;
    this.render();
  }

  /**
   * Hide the trigger (disable it)
   */
  hide(): void {
    this._isEnabled = false;
    this.render();
  }

  /**
   * Check if the trigger is currently visible
   */
  get isVisible(): boolean {
    return this._isEnabled && isMobileMode.value && !isOpen.value;
  }

  /**
   * Destroy the trigger
   */
  destroy(): void {
    this.unsubscribeMobileMode?.();
    this.unsubscribeMobileMode = null;
    this.unsubscribeOpen?.();
    this.unsubscribeOpen = null;

    if (this.container) {
      render(null, this.container);
      this.container.remove();
    }
    this.container = null;
    document.getElementById("pillar-mobile-trigger-styles")?.remove();
    this.stylesInjected = false;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private render(): void {
    if (!this.container) return;

    // Only render if enabled and in mobile mode
    if (!this._isEnabled || !isMobileMode.value) {
      render(null, this.container);
      return;
    }

    const { position, iconColor, label, offset } = this.config.mobileTrigger;

    render(
      <MobileTriggerContent
        position={position}
        icon={this.getIcon()}
        backgroundColor={this.getBackgroundColor()}
        iconColor={iconColor}
        size={this.getSize()}
        label={label}
        offset={offset}
        panelOpen={isOpen.value}
        onClick={this.onClick}
      />,
      this.container
    );
  }
}
