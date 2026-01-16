/**
 * Floating Help Button Component
 * A floating action button that opens the help panel
 */

import { h, render } from 'preact';
import { useCallback } from 'preact/hooks';
import type { ResolvedConfig, FloatingButtonPosition } from '../../core/config';
import { isOpen } from '../../store/panel';
import { injectStyles } from '../../utils/dom';

const HELP_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
const CLOSE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

const FLOATING_BUTTON_STYLES = `
.pillar-floating-button {
  position: fixed;
  z-index: 99998;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 20px;
  height: 48px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 15px;
  font-weight: 500;
  color: #ffffff;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  border: none;
  border-radius: 24px;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4), 0 2px 6px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
  outline: none;
}

.pillar-floating-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(37, 99, 235, 0.5), 0 4px 8px rgba(0, 0, 0, 0.15);
}

.pillar-floating-button:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3), 0 1px 4px rgba(0, 0, 0, 0.1);
}

.pillar-floating-button:focus-visible {
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4), 0 0 0 3px rgba(37, 99, 235, 0.3);
}

.pillar-floating-button--icon-only {
  width: 56px;
  height: 56px;
  padding: 0;
  border-radius: 28px;
  justify-content: center;
}

.pillar-floating-button__icon {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
}

.pillar-floating-button__label {
  white-space: nowrap;
}

/* Positions */
.pillar-floating-button--bottom-right {
  bottom: 24px;
  right: 24px;
}

.pillar-floating-button--bottom-left {
  bottom: 24px;
  left: 24px;
}

.pillar-floating-button--top-right {
  top: 24px;
  right: 24px;
}

.pillar-floating-button--top-left {
  top: 24px;
  left: 24px;
}

/* Hidden state when panel is open */
.pillar-floating-button--hidden {
  transform: scale(0.8);
  opacity: 0;
  pointer-events: none;
}

/* Animation on mount */
@keyframes pillar-button-mount {
  from {
    transform: scale(0.8);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.pillar-floating-button--mounted {
  animation: pillar-button-mount 0.3s ease forwards;
}
`;

interface FloatingButtonContentProps {
  position: FloatingButtonPosition;
  label: string;
  onClick: () => void;
  panelOpen: boolean;
}

function FloatingButtonContent({
  position,
  label,
  onClick,
  panelOpen,
}: FloatingButtonContentProps) {
  const handleClick = useCallback(() => {
    onClick();
  }, [onClick]);

  const isIconOnly = !label;
  const icon = panelOpen ? CLOSE_ICON : HELP_ICON;

  const className = [
    'pillar-floating-button',
    `pillar-floating-button--${position}`,
    'pillar-floating-button--mounted',
    isIconOnly && 'pillar-floating-button--icon-only',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      class={className}
      onClick={handleClick}
      aria-label={label || 'Help'}
      type="button"
    >
      <span
        class="pillar-floating-button__icon"
        dangerouslySetInnerHTML={{ __html: icon }}
      />
      {label && <span class="pillar-floating-button__label">{label}</span>}
    </button>
  );
}

/**
 * FloatingButton class that manages the button lifecycle
 * Uses Preact for rendering but maintains imperative control
 */
export class FloatingButton {
  private config: ResolvedConfig;
  private onClick: () => void;
  private container: HTMLElement | null = null;
  private stylesInjected = false;
  private _isHidden = false;

  constructor(config: ResolvedConfig, onClick: () => void) {
    this.config = config;
    this.onClick = onClick;
  }

  /**
   * Initialize the floating button
   */
  init(): void {
    // Inject styles
    if (!this.stylesInjected) {
      injectStyles(document, FLOATING_BUTTON_STYLES, 'pillar-floating-button-styles');
      this.stylesInjected = true;
    }

    // Create container
    this.container = document.createElement('div');
    this.container.id = 'pillar-floating-button-container';
    document.body.appendChild(this.container);

    // Initial render
    this.render();

    // Subscribe to panel state changes
    isOpen.subscribe(() => {
      this.render();
    });
  }

  /**
   * Set the open state (to update icon when panel opens)
   */
  setOpen(_isOpen: boolean): void {
    // The component now reads from the signal directly
    this.render();
  }

  /**
   * Show the button
   */
  show(): void {
    this._isHidden = false;
    if (this.container) {
      this.container.style.display = '';
    }
  }

  /**
   * Hide the button
   */
  hide(): void {
    this._isHidden = true;
    if (this.container) {
      this.container.style.display = 'none';
    }
  }

  /**
   * Update button position
   */
  setPosition(position: FloatingButtonPosition): void {
    this.config.floatingButton.position = position;
    this.render();
  }

  /**
   * Update button label
   */
  setLabel(label: string): void {
    this.config.floatingButton.label = label;
    this.render();
  }

  /**
   * Destroy the button
   */
  destroy(): void {
    if (this.container) {
      render(null, this.container);
      this.container.remove();
    }
    this.container = null;
    document.getElementById('pillar-floating-button-styles')?.remove();
    this.stylesInjected = false;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private render(): void {
    if (!this.container || this._isHidden) return;

    const { position, label } = this.config.floatingButton;

    render(
      <FloatingButtonContent
        position={position}
        label={label}
        onClick={this.onClick}
        panelOpen={isOpen.value}
      />,
      this.container
    );
  }
}

