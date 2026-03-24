/**
 * ConfirmActionCard Component
 *
 * Default confirmation UI for needsConfirmation tools.
 * Shows the action name with Confirm / Cancel buttons.
 */

import { getPillarInstance } from '../../core/instance';
import type { CardCallbacks } from '../../core/events';
import type { TaskButtonData } from '../Panel/TaskButton';
import { isLoading, messages } from '../../store/chat';
import { debug } from '../../utils/debug';

const CHECK_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20,6 9,17 4,12"/></svg>`;
const X_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
const LOADER_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="pillar-confirm-card__spinner"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;

function deriveTitle(name: string): string {
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Create the default confirmation card.
 * Shows the action name and Confirm / Cancel buttons.
 * Buttons are disabled while the chat is streaming (isLoading)
 * and hidden entirely when the card is no longer in the latest message.
 *
 * @param messageIndex - The message index this card belongs to. When the
 *   message list grows past this index the buttons are removed.
 * @returns The card element. Attach `_cleanup` to unsubscribe from signals.
 */
export function createDefaultConfirmCard(
  action: TaskButtonData,
  callbacks: CardCallbacks,
  messageIndex?: number
): HTMLDivElement {
  const container = document.createElement('div');
  container.className = 'pillar-confirm-card';

  const cardType = (action.data?.card_type as string) || action.name;
  const title = deriveTitle(cardType);
  const data = action.data || {};
  const hasConfirmation = typeof callbacks.onConfirm === 'function';

  container.innerHTML = `
    <div class="pillar-confirm-card__row">
      <span class="pillar-confirm-card__label">${title}</span>
      ${hasConfirmation ? `
        <div class="pillar-confirm-card__actions">
          <button class="pillar-confirm-card__btn pillar-confirm-card__btn--cancel" type="button">Cancel</button>
          <button class="pillar-confirm-card__btn pillar-confirm-card__btn--confirm" type="button">${CHECK_ICON} Run</button>
        </div>
      ` : ''}
    </div>
  `;

  if (hasConfirmation) {
    const confirmBtn = container.querySelector('.pillar-confirm-card__btn--confirm') as HTMLButtonElement | null;
    const cancelBtn = container.querySelector('.pillar-confirm-card__btn--cancel') as HTMLButtonElement | null;
    const actionsEl = container.querySelector('.pillar-confirm-card__actions') as HTMLElement | null;
    let settled = false;
    const unsubs: Array<() => void> = [];

    const syncDisabled = (loading: boolean) => {
      if (settled) return;
      if (confirmBtn) confirmBtn.disabled = loading;
      if (cancelBtn) cancelBtn.disabled = loading;
    };

    // Disable buttons while the chat is still streaming
    syncDisabled(isLoading.value);
    unsubs.push(isLoading.subscribe(syncDisabled));

    // Hide buttons when this card is no longer in the latest message
    if (messageIndex !== undefined) {
      const syncStale = () => {
        if (settled) return;
        const isLatest = messageIndex === messages.value.length - 1;
        if (!isLatest && actionsEl) {
          actionsEl.style.display = 'none';
        } else if (isLatest && actionsEl) {
          actionsEl.style.display = '';
        }
      };
      syncStale();
      unsubs.push(messages.subscribe(syncStale));
    }

    const cleanup = () => unsubs.forEach(u => u());
    (container as unknown as { _cleanup?: () => void })._cleanup = cleanup;

    confirmBtn?.addEventListener('click', async () => {
      if (!confirmBtn || confirmBtn.disabled) return;
      settled = true;
      cleanup();

      confirmBtn.disabled = true;
      cancelBtn?.setAttribute('disabled', '');
      confirmBtn.innerHTML = `${LOADER_ICON} Running…`;
      container.classList.add('pillar-confirm-card--loading');

      try {
        callbacks.onConfirm!(data);
        container.classList.remove('pillar-confirm-card--loading');
        container.classList.add('pillar-confirm-card--done');
        container.innerHTML = `
          <div class="pillar-confirm-card__row pillar-confirm-card__row--done">
            <span class="pillar-confirm-card__done-icon">${CHECK_ICON}</span>
            <span class="pillar-confirm-card__label">${title}</span>
          </div>
        `;
      } catch {
        container.classList.remove('pillar-confirm-card--loading');
        container.classList.add('pillar-confirm-card--error');
        container.innerHTML = `
          <div class="pillar-confirm-card__row pillar-confirm-card__row--error">
            <span class="pillar-confirm-card__done-icon">${X_ICON}</span>
            <span class="pillar-confirm-card__label">${title} failed</span>
          </div>
        `;
      }
    });

    cancelBtn?.addEventListener('click', () => {
      settled = true;
      cleanup();
      container.classList.add('pillar-confirm-card--done');
      container.innerHTML = `
        <div class="pillar-confirm-card__row pillar-confirm-card__row--cancelled">
          <span class="pillar-confirm-card__label pillar-confirm-card__label--muted">Cancelled</span>
        </div>
      `;
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
