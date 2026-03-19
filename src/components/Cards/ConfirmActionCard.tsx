/**
 * ConfirmActionCard Component
 * 
 * Renders inline_ui type actions as inline cards in the chat.
 * If a custom card renderer is registered for the card_type, it's used.
 * Otherwise, a default preview card is rendered.
 *
 * When `needsConfirmation` is set, the default card includes Confirm / Cancel
 * buttons that gate execution of the tool's `execute` handler.
 */

import { getPillarInstance } from '../../core/instance';
import type { CardCallbacks } from '../../core/events';
import type { TaskButtonData } from '../Panel/TaskButton';
import { debug } from '../../utils/debug';

const CHECK_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20,6 9,17 4,12"/></svg>`;
const X_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
const LOADER_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="pillar-confirm-card__spinner"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;

/**
 * Derive a human-readable title from a card_type or action name.
 */
function deriveTitle(name: string): string {
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Render data as a simple key-value list.
 */
function renderDataPreview(data: Record<string, unknown>): string {
  const entries = Object.entries(data)
    .filter(([key]) => key !== 'card_type') // Don't show card_type
    .slice(0, 5); // Limit to 5 entries
  
  if (entries.length === 0) return '';
  
  return `
    <div class="pillar-confirm-card__data">
      ${entries.map(([key, value]) => {
        const displayValue = Array.isArray(value) 
          ? value.join(', ') 
          : String(value);
        return `
          <div class="pillar-confirm-card__data-row">
            <span class="pillar-confirm-card__data-key">${deriveTitle(key)}:</span>
            <span class="pillar-confirm-card__data-value">${displayValue}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/**
 * Create the default card for inline_ui actions.
 * When callbacks include onConfirm/onCancel, confirm/cancel buttons are shown.
 */
export function createDefaultConfirmCard(
  action: TaskButtonData,
  callbacks: CardCallbacks
): HTMLDivElement {
  const container = document.createElement('div');
  container.className = 'pillar-confirm-card';
  
  const cardType = (action.data?.card_type as string) || action.name;
  const title = deriveTitle(cardType);
  const data = action.data || {};
  const hasConfirmation = typeof callbacks.onConfirm === 'function';

  container.innerHTML = `
    <div class="pillar-confirm-card__content">
      <div class="pillar-confirm-card__header">
        <span class="pillar-confirm-card__title">${title}</span>
      </div>
      ${renderDataPreview(data)}
      ${hasConfirmation ? `
        <div class="pillar-confirm-card__actions">
          <button class="pillar-confirm-card__btn pillar-confirm-card__btn--cancel" type="button">
            ${X_ICON}
            <span>Cancel</span>
          </button>
          <button class="pillar-confirm-card__btn pillar-confirm-card__btn--confirm" type="button">
            ${CHECK_ICON}
            <span>Confirm</span>
          </button>
        </div>
      ` : ''}
    </div>
  `;

  if (hasConfirmation) {
    const confirmBtn = container.querySelector('.pillar-confirm-card__btn--confirm') as HTMLButtonElement | null;
    const cancelBtn = container.querySelector('.pillar-confirm-card__btn--cancel') as HTMLButtonElement | null;

    confirmBtn?.addEventListener('click', async () => {
      if (!confirmBtn || confirmBtn.disabled) return;

      // Switch to loading state
      confirmBtn.disabled = true;
      cancelBtn?.setAttribute('disabled', '');
      confirmBtn.innerHTML = `${LOADER_ICON}<span>Confirming…</span>`;
      container.classList.add('pillar-confirm-card--loading');

      try {
        callbacks.onConfirm!(data);
        container.classList.remove('pillar-confirm-card--loading');
        container.classList.add('pillar-confirm-card--success');

        const actionsEl = container.querySelector('.pillar-confirm-card__actions');
        if (actionsEl) {
          actionsEl.innerHTML = `<span class="pillar-confirm-card__status pillar-confirm-card__status--success">${CHECK_ICON} Confirmed</span>`;
        }
      } catch {
        container.classList.remove('pillar-confirm-card--loading');
        container.classList.add('pillar-confirm-card--error');

        const actionsEl = container.querySelector('.pillar-confirm-card__actions');
        if (actionsEl) {
          actionsEl.innerHTML = `<span class="pillar-confirm-card__status pillar-confirm-card__status--error">${X_ICON} Failed</span>`;
        }
      }
    });

    cancelBtn?.addEventListener('click', () => {
      callbacks.onCancel?.();
    });
  }

  return container;
}

export interface ConfirmActionCardOptions {
  needsConfirmation?: boolean;
  onConfirm?: (data?: Record<string, unknown>) => void;
  onCancel?: () => void;
}

/**
 * Create a card for an inline_ui type action.
 * Uses custom renderer if registered, otherwise uses default.
 *
 * When `options.needsConfirmation` is true, the card includes Confirm/Cancel
 * buttons that call the provided `onConfirm`/`onCancel` callbacks.
 */
export function createConfirmActionCard(
  action: TaskButtonData,
  options?: ConfirmActionCardOptions,
): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'pillar-confirm-card-wrapper';
  
  const cardType = (action.data?.card_type as string) || action.name;
  const pillar = getPillarInstance();
  const customRenderer = pillar?.getCardRenderer(cardType);
  
  const callbacks: CardCallbacks = {
    onConfirm: options?.needsConfirmation ? options.onConfirm : undefined,
    onCancel: options?.needsConfirmation ? options.onCancel : undefined,
    sendResult: pillar
      ? (result: Record<string, unknown>) => {
          pillar.sendToolResultAsMessage(cardType, result);
          return Promise.resolve();
        }
      : undefined,
    onStateChange: (state, message) => {
      debug.log(`[Pillar] Card state changed to ${state}${message ? `: ${message}` : ''}`);
    },
  };
  
  if (customRenderer) {
    try {
      const cleanup = customRenderer(wrapper, action.data || {}, callbacks);
      (wrapper as unknown as { _cleanup?: () => void })._cleanup = cleanup || undefined;
    } catch (err) {
      debug.error('[Pillar] Custom card renderer error:', err);
    }
  } else {
    const defaultCard = createDefaultConfirmCard(action, callbacks);
    wrapper.appendChild(defaultCard);
  }
  
  return wrapper;
}

// Styles have been moved to confirm-action-card.css
