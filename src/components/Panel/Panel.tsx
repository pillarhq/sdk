/**
 * Panel Container Component
 * Shadow DOM container for the help panel with Preact rendering
 */

import { render } from 'preact';
import type { APIClient } from '../../api/client';
import type { ResolvedConfig } from '../../core/config';
import type { EventEmitter } from '../../core/events';
import { resetChat, triggerInputFocus } from '../../store/chat';
import {
  closePanel,
  destroyViewportListener,
  effectiveMode,
  hoverBackdrop,
  initViewportListener,
  isHoverMode,
  isOpen,
  openPanel,
  position,
  resetPanel,
  setHoverBackdrop,
  setHoverBreakpoint,
  setMode,
  setPosition,
  setWidth,
  width
} from '../../store/panel';
import {
  navigate,
  resetRouter,
  type ViewType,
} from '../../store/router';
import { CONFIRM_CARD_STYLES } from '../Cards/ConfirmActionCard';
import { PillarProvider } from '../context';
import { INLINE_PLAN_STYLES } from '../Plan/InlinePlanView';
import { PLAN_STEP_STYLES } from '../Plan/PlanStepItem';
import { PLAN_STYLES } from '../Plan/PlanView';
import { PanelContent } from './PanelContent';
import { PANEL_STYLES, generateThemeCSS } from './styles';
import { TASK_BUTTON_STYLES } from './TaskButton';
import { WORKFLOW_STYLES } from './WorkflowChecklist';

export class Panel {
  private config: ResolvedConfig;
  private api: APIClient;
  private events: EventEmitter;
  private rootContainer: HTMLElement | null;

  private host: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private backdrop: HTMLElement | null = null;
  private panelElement: HTMLElement | null = null;
  private renderRoot: HTMLElement | null = null;
  private unsubscribe: (() => void) | null = null;
  private isManualMount: boolean = false;
  private themeObserver: MutationObserver | null = null;

  constructor(config: ResolvedConfig, api: APIClient, events: EventEmitter, rootContainer?: HTMLElement | null) {
    this.config = config;
    this.api = api;
    this.events = events;
    this.rootContainer = rootContainer || null;
    this.isManualMount = config.panel.container === 'manual';
  }

  /**
   * Detect the current theme from the document
   * Checks for .dark class (next-themes) or data-theme attribute
   * Returns explicit 'light' or 'dark' to match app theme (not system preference)
   */
  private detectThemeFromDOM(): 'light' | 'dark' {
    const html = document.documentElement;
    
    // Check for .dark class (next-themes pattern - most common)
    if (html.classList.contains('dark')) return 'dark';
    
    // Check for data-theme attribute
    const dataTheme = html.getAttribute('data-theme');
    if (dataTheme === 'dark') return 'dark';
    
    // Check for color-scheme style
    if (html.style.colorScheme === 'dark') return 'dark';
    
    // Default to light (web default, matches next-themes behavior)
    return 'light';
  }

  /**
   * Whether the panel is currently open
   */
  get isOpen(): boolean {
    return isOpen.value;
  }

  /**
   * Initialize the panel
   */
  async init(): Promise<void> {
    // Set initial config values in store
    setPosition(this.config.panel.position);
    setMode(this.config.panel.mode);
    setWidth(this.config.panel.width);
    setHoverBreakpoint(this.config.panel.hoverBreakpoint);
    setHoverBackdrop(this.config.panel.hoverBackdrop);
    
    // Initialize viewport listener for responsive behavior
    initViewportListener();

    this.createHost();
    // Skip backdrop in manual mode - user handles all UI
    if (!this.isManualMount) {
      this.createBackdrop();
    }
    this.createPanel();
    this.renderPreact();
    this.bindEvents();
    this.subscribeToState();
  }

  /**
   * Open the panel
   */
  open(options?: { view?: string; focusInput?: boolean }): void {
    if (isOpen.value) {
      // If already open, just navigate
      if (options?.view) {
        navigate(options.view as ViewType);
      }
      // Still trigger focus if requested when already open
      if (options?.focusInput) {
        triggerInputFocus();
      }
      return;
    }

    // Update state - the subscription will handle DOM updates
    openPanel();

    // Handle initial view
    if (options?.view) {
      navigate(options.view as ViewType);
    }

    // Focus trap or input focus
    if (options?.focusInput) {
      triggerInputFocus();
    } else {
      this.setupFocusTrap();
    }
  }

  /**
   * Close the panel
   */
  close(): void {
    if (!isOpen.value) return;

    // Update state - the subscription will handle DOM updates
    closePanel();
  }

  /**
   * Navigate to a specific view
   */
  navigate(view: string, params?: Record<string, string>): void {
    if (!isOpen.value) {
      this.open({ view });
    } else {
      navigate(view as ViewType, params);
    }
  }

  /**
   * Destroy the panel
   */
  destroy(): void {
    this.close();

    // Clean up push mode styles (only if not manual mount)
    if (!this.isManualMount) {
      this.removePushModeStyles();
    }

    // Unsubscribe from state
    this.unsubscribe?.();
    this.unsubscribe = null;
    
    // Clean up viewport listener
    destroyViewportListener();
    
    // Clean up theme observer
    this.themeObserver?.disconnect();
    this.themeObserver = null;

    // Unmount Preact
    if (this.renderRoot) {
      render(null, this.renderRoot);
    }

    this.backdrop?.remove();
    this.host?.remove();

    // Remove injected styles from document head (non-Shadow DOM mode)
    document.getElementById('pillar-sdk-styles')?.remove();
    document.getElementById('pillar-sdk-theme')?.remove();
    document.getElementById('pillar-sdk-custom')?.remove();

    this.host = null;
    this.shadow = null;
    this.backdrop = null;
    this.panelElement = null;
    this.renderRoot = null;

    document.removeEventListener('keydown', this.handleKeyDown);

    resetPanel();
    resetRouter();
    resetChat();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private subscribeToState(): void {
    // In manual mode, user handles all UI - we just emit events
    if (this.isManualMount) {
      this.unsubscribe = isOpen.subscribe((currentValue) => {
        if (!currentValue) {
          this.events.emit('panel:close');
        }
      });
      return;
    }

    // Track previous values for change detection
    let previousOpen = isOpen.value;
    let previousEffectiveMode = effectiveMode.value;

    // Update UI based on current state
    const updatePanelUI = () => {
      const currentOpen = isOpen.value;
      const currentMode = effectiveMode.value;
      const isPushMode = currentMode === 'push';
      const panelWidth = width.value;
      const panelPosition = position.value;
      const showBackdrop = isHoverMode.value && hoverBackdrop.value;

      if (currentOpen) {
        // Panel is open
        if (isPushMode) {
          // In push mode, shift the page content via padding
          this.applyPushModeStyles(panelWidth, panelPosition);
          // Hide backdrop in push mode
          this.backdrop?.classList.remove('_pillar-backdrop--visible', 'pillar-backdrop--visible');
        } else {
          // In hover/overlay mode, remove push padding
          this.removePushModeStyles();
          // Show backdrop if enabled for hover mode
          if (showBackdrop) {
            this.backdrop?.classList.add('_pillar-backdrop--visible', 'pillar-backdrop--visible');
          } else {
            this.backdrop?.classList.remove('_pillar-backdrop--visible', 'pillar-backdrop--visible');
          }
        }
        this.panelElement?.classList.add('_pillar-panel--open', 'pillar-panel--open');
      } else {
        // Panel is closed
        this.removePushModeStyles();
        this.backdrop?.classList.remove('_pillar-backdrop--visible', 'pillar-backdrop--visible');
        this.panelElement?.classList.remove('_pillar-panel--open', 'pillar-panel--open');
      }
    };

    // Subscribe to isOpen signal changes
    const unsubscribeOpen = isOpen.subscribe((currentValue) => {
      // Only react to actual changes
      if (currentValue === previousOpen) return;
      previousOpen = currentValue;

      updatePanelUI();

      if (!currentValue) {
        // Reset panel state after animation
        setTimeout(() => {
          if (!isOpen.value) {
            resetRouter();
            resetChat();
          }
        }, 300);

        // Emit close event
        this.events.emit('panel:close');
      }
    });

    // Subscribe to effectiveMode changes (viewport resize crossing breakpoint)
    const unsubscribeMode = effectiveMode.subscribe((currentMode) => {
      // Only react to actual changes
      if (currentMode === previousEffectiveMode) return;
      previousEffectiveMode = currentMode;

      // Always update z-index when mode changes
      // Update full UI only if panel is open
      updatePanelUI();
    });

    // Combined cleanup
    this.unsubscribe = () => {
      unsubscribeOpen();
      unsubscribeMode();
    };
  }

  private applyPushModeStyles(panelWidth: number, panelPosition: 'left' | 'right'): void {
    // Use padding to shrink the content area next to the panel
    // The panel is position: fixed so it stays in place while content shrinks
    document.documentElement.style.transition = 'padding 0.3s ease';
    if (panelPosition === 'right') {
      document.documentElement.style.paddingRight = `${panelWidth}px`;
    } else {
      document.documentElement.style.paddingLeft = `${panelWidth}px`;
    }
  }

  private removePushModeStyles(): void {
    document.documentElement.style.paddingLeft = '';
    document.documentElement.style.paddingRight = '';
    // Remove transition after animation completes
    setTimeout(() => {
      if (!isOpen.value) {
        document.documentElement.style.transition = '';
      }
    }, 300);
  }

  /**
   * Get the container for rendering content (shadow root or host element)
   */
  private get renderContainer(): HTMLElement | ShadowRoot {
    return this.shadow || this.host!;
  }

  /**
   * Transform Shadow DOM :host selectors to work in regular DOM.
   * Replaces :host with [data-pillar-panel] attribute selector.
   */
  private transformStylesForRegularDOM(css: string): string {
    // Replace :host selectors with attribute selector for the host element
    // Handle :host, :host(...), :host-context(...), :host:not(...) etc.
    return css
      .replace(/:host\(([^)]+)\)/g, '[data-pillar-panel]$1') // :host(.class) -> [data-pillar-panel].class
      .replace(/:host-context\(([^)]+)\)/g, '$1 [data-pillar-panel]') // :host-context(.dark) -> .dark [data-pillar-panel]
      .replace(/:host:not\(([^)]+)\)/g, '[data-pillar-panel]:not($1)') // :host:not(.x) -> [data-pillar-panel]:not(.x)
      .replace(/:host/g, '[data-pillar-panel]'); // :host -> [data-pillar-panel]
  }

  /**
   * Inject styles into document.head for non-Shadow DOM mode.
   * Uses IDs to prevent duplicate injection.
   */
  private injectStylesIntoHead(): void {
    const styleId = 'pillar-sdk-styles';
    if (document.getElementById(styleId)) return; // Prevent duplicates

    const rawCSS = PANEL_STYLES + TASK_BUTTON_STYLES + WORKFLOW_STYLES + CONFIRM_CARD_STYLES + PLAN_STYLES + PLAN_STEP_STYLES + INLINE_PLAN_STYLES;
    const transformedCSS = this.transformStylesForRegularDOM(rawCSS);

    const styles = document.createElement('style');
    styles.id = styleId;
    styles.textContent = transformedCSS;
    document.head.appendChild(styles);

    // Theme styles (also need transformation)
    const themeCSS = generateThemeCSS(this.config.theme);
    if (themeCSS) {
      const themeStyles = document.createElement('style');
      themeStyles.id = 'pillar-sdk-theme';
      themeStyles.textContent = this.transformStylesForRegularDOM(themeCSS);
      document.head.appendChild(themeStyles);
    }

    // Custom CSS from config
    if (this.config.customCSS) {
      const customStyles = document.createElement('style');
      customStyles.id = 'pillar-sdk-custom';
      customStyles.textContent = this.transformStylesForRegularDOM(this.config.customCSS);
      document.head.appendChild(customStyles);
    }
  }

  /**
   * Inject styles into Shadow DOM for isolated mode.
   */
  private injectStylesIntoShadow(): void {
    if (!this.shadow) return;

    // Inject base styles
    const styles = document.createElement('style');
    styles.textContent = PANEL_STYLES + TASK_BUTTON_STYLES + WORKFLOW_STYLES + CONFIRM_CARD_STYLES + PLAN_STYLES + PLAN_STEP_STYLES + INLINE_PLAN_STYLES;
    this.shadow.appendChild(styles);

    // Inject theme customization CSS (color overrides from config)
    const themeCSS = generateThemeCSS(this.config.theme);
    if (themeCSS) {
      const themeStyles = document.createElement('style');
      themeStyles.textContent = themeCSS;
      themeStyles.setAttribute('data-pillar-theme', '');
      this.shadow.appendChild(themeStyles);
    }

    // Inject custom CSS from config (user overrides)
    if (this.config.customCSS) {
      const customStyles = document.createElement('style');
      customStyles.textContent = this.config.customCSS;
      customStyles.setAttribute('data-pillar-custom', '');
      this.shadow.appendChild(customStyles);
    }
  }

  private createHost(): void {
    // Create host element
    this.host = document.createElement('div');
    this.host.className = 'pillar-panel-host';
    this.host.setAttribute('data-pillar-panel', '');

    if (this.config.panel.useShadowDOM) {
      // Shadow DOM mode (opt-in for style isolation)
      this.shadow = this.host.attachShadow({ mode: 'open' });
      this.injectStylesIntoShadow();
    } else {
      // Regular DOM mode (default - inherits host app CSS)
      this.shadow = null;
      this.injectStylesIntoHead();
    }

    // Set theme mode attribute on host for CSS selectors
    this.applyThemeMode();
    
    // Watch for theme changes on documentElement (for auto mode)
    this.setupThemeObserver();

    // Determine mount point based on container config
    const container = this.config.panel.container;

    if (container === 'manual') {
      // Manual mode: don't mount automatically, wait for mountTo() call
      return;
    }

    // Default mount target is the shared root container (for stacking context isolation)
    // Falls back to document.body if no root container provided
    const defaultTarget = this.rootContainer || document.body;
    let mountTarget: HTMLElement | null = null;

    if (typeof container === 'string') {
      // CSS selector
      mountTarget = document.querySelector<HTMLElement>(container);
      if (!mountTarget) {
        console.warn(`[Pillar] Container element not found: ${container}, falling back to root container`);
        mountTarget = defaultTarget;
      }
    } else if (container instanceof HTMLElement) {
      // Direct element reference
      mountTarget = container;
    } else {
      // Default to root container
      mountTarget = defaultTarget;
    }

    mountTarget.appendChild(this.host);
  }

  /**
   * Mount the panel to a specific container element.
   * Used for manual mounting mode (e.g., from React component).
   */
  mountTo(container: HTMLElement): void {
    if (!this.host) {
      console.warn('[Pillar] Panel host not created yet');
      return;
    }

    // Remove from current parent if exists
    if (this.host.parentElement) {
      this.host.parentElement.removeChild(this.host);
    }

    container.appendChild(this.host);
  }

  /**
   * Get the host element for external mounting
   */
  getHostElement(): HTMLElement | null {
    return this.host;
  }

  private createBackdrop(): void {
    // Backdrop is outside shadow DOM for proper stacking
    this.backdrop = document.createElement('div');
    this.backdrop.className = '_pillar-backdrop pillar-backdrop';
    this.backdrop.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.3);
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.3s ease, visibility 0.3s ease;
      z-index: 99998;
    `;

    // Click backdrop to close - just call closePanel, subscription handles the rest
    this.backdrop.addEventListener('click', () => {
      closePanel();
    });

    document.body.appendChild(this.backdrop);
  }

  private createPanel(): void {
    const container = this.renderContainer;
    if (!container) return;

    // Panel container with both internal and public classes
    this.panelElement = document.createElement('div');
    const manualClass = this.isManualMount ? ' _pillar-panel--manual pillar-panel--manual' : '';
    const positionClass = `_pillar-panel--${position.value} pillar-panel--${position.value}`;
    this.panelElement.className = `_pillar-panel pillar-panel ${positionClass}${manualClass}`;
    this.panelElement.style.setProperty('--pillar-panel-width', `${width.value}px`);
    this.panelElement.setAttribute('role', 'dialog');
    this.panelElement.setAttribute('aria-modal', 'true');
    this.panelElement.setAttribute('aria-label', 'Assistant panel');

    // Create render root for Preact with both internal and public classes
    this.renderRoot = document.createElement('div');
    this.renderRoot.className = '_pillar-panel-root pillar-panel-root';
    this.panelElement.appendChild(this.renderRoot);

    container.appendChild(this.panelElement);
  }

  private renderPreact(): void {
    if (!this.renderRoot) return;

    render(
      <PillarProvider api={this.api} events={this.events}>
        <PanelContent />
      </PillarProvider>,
      this.renderRoot
    );
  }

  private bindEvents(): void {
    // Escape key to close
    document.addEventListener('keydown', this.handleKeyDown);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && isOpen.value) {
      closePanel();
    }
  };

  private setupFocusTrap(): void {
    // Focus first focusable element in panel
    setTimeout(() => {
      const container = this.renderContainer;
      const focusable = container?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      focusable?.focus();
    }, 100);
  }

  /**
   * Apply theme mode attribute to host element for CSS targeting
   */
  private applyThemeMode(): void {
    if (!this.host) return;

    const themeMode = this.config.theme.mode;
    
    if (themeMode === 'light' || themeMode === 'dark') {
      // Manual light/dark mode - set data attribute
      this.host.setAttribute('data-theme', themeMode);
    } else {
      // Auto mode - detect from DOM (matches app theme, not system preference)
      // This ensures the panel matches when user sets theme manually in the app
      const detectedTheme = this.detectThemeFromDOM();
      this.host.setAttribute('data-theme', detectedTheme);
    }
  }

  /**
   * Set up observer to watch for theme changes on documentElement
   */
  private setupThemeObserver(): void {
    // Only needed for auto mode
    if (this.config.theme.mode !== 'auto') return;
    
    this.themeObserver = new MutationObserver(() => {
      // Re-apply theme when DOM theme changes
      this.applyThemeMode();
    });

    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme', 'style'],
    });
  }

  /**
   * Update the theme at runtime
   */
  setTheme(themeConfig: Partial<ResolvedConfig['theme']>): void {
    // Merge new theme config with existing
    this.config = {
      ...this.config,
      theme: {
        ...this.config.theme,
        ...themeConfig,
        colors: { ...this.config.theme.colors, ...themeConfig.colors },
        darkColors: { ...this.config.theme.darkColors, ...themeConfig.darkColors },
      },
    };

    // Update theme mode attribute
    this.applyThemeMode();

    // Regenerate and update theme CSS
    const themeCSS = generateThemeCSS(this.config.theme);
    
    if (this.shadow) {
      // Shadow DOM mode: update styles in shadow root
      const existingThemeStyle = this.shadow.querySelector('style[data-pillar-theme]');
      
      if (existingThemeStyle && themeCSS) {
        existingThemeStyle.textContent = themeCSS;
      } else if (themeCSS && !existingThemeStyle) {
        const themeStyles = document.createElement('style');
        themeStyles.textContent = themeCSS;
        themeStyles.setAttribute('data-pillar-theme', '');
        // Insert after base styles
        const firstStyle = this.shadow.querySelector('style');
        if (firstStyle?.nextSibling) {
          this.shadow.insertBefore(themeStyles, firstStyle.nextSibling);
        } else {
          this.shadow.appendChild(themeStyles);
        }
      }
    } else {
      // Regular DOM mode: update styles in document head
      // Must transform :host selectors to [data-pillar-panel] attribute selectors
      const transformedThemeCSS = this.transformStylesForRegularDOM(themeCSS);
      const existingThemeStyle = document.getElementById('pillar-sdk-theme');
      
      if (existingThemeStyle && transformedThemeCSS) {
        existingThemeStyle.textContent = transformedThemeCSS;
      } else if (transformedThemeCSS && !existingThemeStyle) {
        const themeStyles = document.createElement('style');
        themeStyles.id = 'pillar-sdk-theme';
        themeStyles.textContent = transformedThemeCSS;
        document.head.appendChild(themeStyles);
      }
    }
  }
}
