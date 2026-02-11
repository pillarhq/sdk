/**
 * Page Pilot Manager
 * Manages the "Page being piloted by Agent" banner, rendering it outside Shadow DOM
 * so it appears above all other content on the page.
 */

import { h, render } from 'preact';
import { effect } from '@preact/signals';
import { isPiloting } from '../../store/pagePilot';
import pagePilotCSS from './page-pilot.css';
import { PagePilotBanner } from './PagePilotBanner';
import { injectStyles } from '../../utils/dom';
import type { ThemeMode } from '../../core/config';

const STYLES_ID = 'pillar-page-pilot-styles';
const CONTAINER_ID = 'pillar-page-pilot-container';

export class PagePilotManager {
  private container: HTMLDivElement | null = null;
  private stylesInjected = false;
  private unsubscribe: (() => void) | null = null;
  private themeObserver: MutationObserver | null = null;
  private primaryColor: string | undefined;
  private themeMode: ThemeMode = 'auto';

  /**
   * Detect the current theme from the document (for auto mode)
   * Checks for .dark class (next-themes) or data-theme attribute
   */
  private detectThemeFromDOM(): 'light' | 'dark' {
    const html = document.documentElement;
    
    // Check for .dark class (next-themes pattern)
    if (html.classList.contains('dark')) return 'dark';
    
    // Check for data-theme attribute
    const dataTheme = html.getAttribute('data-theme');
    if (dataTheme === 'dark') return 'dark';
    if (dataTheme === 'light') return 'light';
    
    // Default to light
    return 'light';
  }

  /**
   * Apply theme mode to container element
   * Respects explicit config, only auto-detects when mode is 'auto'
   */
  private applyThemeMode(): void {
    if (!this.container) return;
    
    if (this.themeMode === 'light' || this.themeMode === 'dark') {
      // Manual light/dark mode - use config value directly
      this.container.setAttribute('data-theme', this.themeMode);
    } else {
      // Auto mode - detect from DOM
      const theme = this.detectThemeFromDOM();
      this.container.setAttribute('data-theme', theme);
    }
  }

  /**
   * Set up observer to watch for theme changes on documentElement
   * Only needed for auto mode
   */
  private setupThemeObserver(): void {
    // Only needed for auto mode
    if (this.themeMode !== 'auto') return;

    this.themeObserver = new MutationObserver(() => {
      this.applyThemeMode();
    });

    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme', 'style'],
    });
  }

  /**
   * Initialize the page pilot manager
   * @param primaryColor - Optional primary color from theme config to override the default
   * @param themeMode - Theme mode from config ('light', 'dark', or 'auto')
   */
  init(primaryColor?: string, themeMode: ThemeMode = 'auto'): void {
    this.primaryColor = primaryColor;
    this.themeMode = themeMode;
    
    // Inject styles into the document (not shadow DOM)
    if (!this.stylesInjected) {
      injectStyles(document, pagePilotCSS, STYLES_ID);
      this.stylesInjected = true;
    }

    // Create container for banner
    this.container = document.createElement('div');
    this.container.id = CONTAINER_ID;
    document.body.appendChild(this.container);

    // Apply theme primary color override if provided
    if (this.primaryColor) {
      this.container.style.setProperty('--pillar-primary', this.primaryColor);
    }

    // Apply initial theme and set up observer (only for auto mode)
    this.applyThemeMode();
    this.setupThemeObserver();

    // Subscribe to isPiloting signal changes and re-render
    this.unsubscribe = effect(() => {
      // Access the signal to create a dependency
      const _ = isPiloting.value;
      this.render();
    });

    // Initial render
    this.render();
  }

  /**
   * Update the primary color used by the banner
   */
  setPrimaryColor(color: string): void {
    this.primaryColor = color;
    if (this.container) {
      this.container.style.setProperty('--pillar-primary', color);
    }
  }

  /**
   * Destroy the page pilot manager
   */
  destroy(): void {
    // Unsubscribe from signal
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    // Disconnect theme observer
    if (this.themeObserver) {
      this.themeObserver.disconnect();
      this.themeObserver = null;
    }

    // Unmount Preact component
    if (this.container) {
      render(null, this.container);
      this.container.remove();
      this.container = null;
    }

    // Remove styles
    document.getElementById(STYLES_ID)?.remove();
    this.stylesInjected = false;
  }

  /**
   * Render the banner component
   */
  private render(): void {
    if (!this.container) return;

    render(
      <PagePilotBanner />,
      this.container
    );
  }
}
