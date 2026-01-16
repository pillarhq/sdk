/**
 * ConfirmActionCard Component
 * 
 * Renders inline_ui type actions as inline cards in the chat.
 * If a custom card renderer is registered for the card_type, it's used.
 * Otherwise, a default confirmation card is rendered.
 */

import Pillar from '../../core/Pillar';
import type { CardCallbacks } from '../../core/events';
import type { TaskButtonData } from '../Panel/TaskButton';

// Icons
const CHECK_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20,6 9,17 4,12"/></svg>`;
const X_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
const LOADER_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>`;

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
 * Create the default confirmation card for inline_ui actions.
 * Used when no custom card renderer is registered.
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
  
  // Initial state
  let state: 'idle' | 'loading' | 'success' | 'error' = 'idle';
  let errorMessage = '';
  
  const render = () => {
    if (state === 'success') {
      container.innerHTML = `
        <div class="pillar-confirm-card__success">
          <span class="pillar-confirm-card__success-icon">${CHECK_ICON}</span>
          <span>Completed</span>
        </div>
      `;
      return;
    }
    
    if (state === 'error') {
      container.innerHTML = `
        <div class="pillar-confirm-card__content">
          <div class="pillar-confirm-card__header">
            <span class="pillar-confirm-card__title">${title}</span>
          </div>
          <div class="pillar-confirm-card__error">
            <span>${errorMessage || 'An error occurred'}</span>
          </div>
          <div class="pillar-confirm-card__actions">
            <button type="button" class="pillar-confirm-card__btn pillar-confirm-card__btn--secondary js-cancel">
              ${X_ICON} Dismiss
            </button>
          </div>
        </div>
      `;
      container.querySelector('.js-cancel')?.addEventListener('click', callbacks.onCancel);
      return;
    }
    
    container.innerHTML = `
      <div class="pillar-confirm-card__content">
        <div class="pillar-confirm-card__header">
          <span class="pillar-confirm-card__title">${title}</span>
        </div>
        ${renderDataPreview(data)}
        <div class="pillar-confirm-card__actions">
          <button type="button" class="pillar-confirm-card__btn pillar-confirm-card__btn--secondary js-cancel" ${state === 'loading' ? 'disabled' : ''}>
            ${X_ICON} Cancel
          </button>
          <button type="button" class="pillar-confirm-card__btn pillar-confirm-card__btn--primary js-confirm" ${state === 'loading' ? 'disabled' : ''}>
            ${state === 'loading' ? `<span class="pillar-confirm-card__spinner">${LOADER_ICON}</span>` : CHECK_ICON} 
            ${state === 'loading' ? 'Processing...' : 'Confirm'}
          </button>
        </div>
      </div>
    `;
    
    // Attach event listeners
    container.querySelector('.js-cancel')?.addEventListener('click', callbacks.onCancel);
    container.querySelector('.js-confirm')?.addEventListener('click', () => {
      callbacks.onConfirm(data);
    });
  };
  
  // Initial render
  render();
  
  // Handle state changes from custom implementations
  if (callbacks.onStateChange) {
    const originalOnStateChange = callbacks.onStateChange;
    callbacks.onStateChange = (newState, message) => {
      if (newState === 'loading') state = 'loading';
      else if (newState === 'success') state = 'success';
      else if (newState === 'error') {
        state = 'error';
        errorMessage = message || '';
      }
      render();
      originalOnStateChange(newState, message);
    };
  }
  
  return container;
}

/**
 * Create a confirmation card for a confirm_action type action.
 * Uses custom renderer if registered, otherwise uses default.
 */
export function createConfirmActionCard(
  action: TaskButtonData,
  onConfirm: (data?: Record<string, unknown>) => void,
  onCancel: () => void
): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'pillar-confirm-card-wrapper';
  
  const cardType = (action.data?.card_type as string) || action.name;
  const pillar = Pillar.getInstance();
  const customRenderer = pillar?.getCardRenderer(cardType);
  
  const callbacks: CardCallbacks = {
    onConfirm: (modifiedData) => {
      onConfirm(modifiedData || action.data);
    },
    onCancel,
    onStateChange: (state, message) => {
      console.log(`[Pillar] Card state changed to ${state}${message ? `: ${message}` : ''}`);
    },
  };
  
  if (customRenderer) {
    // Use custom renderer
    try {
      const cleanup = customRenderer(wrapper, action.data || {}, callbacks);
      // Store cleanup function for later
      (wrapper as unknown as { _cleanup?: () => void })._cleanup = cleanup || undefined;
    } catch (err) {
      console.error('[Pillar] Custom card renderer error:', err);
    }
  } else {
    // Use default card
    const defaultCard = createDefaultConfirmCard(action, callbacks);
    wrapper.appendChild(defaultCard);
  }
  
  return wrapper;
}

/**
 * CSS styles for ConfirmActionCard.
 */
export const CONFIRM_CARD_STYLES = `
/* Confirm Action Card */
.pillar-confirm-card-wrapper {
  margin-top: 12px;
}

.pillar-confirm-card {
  background: var(--pillar-bg-secondary, #f9fafb);
  border: 1px solid var(--pillar-border, #e5e7eb);
  border-radius: 12px;
  overflow: hidden;
}

.pillar-confirm-card__content {
  padding: 16px;
}

.pillar-confirm-card__header {
  margin-bottom: 12px;
}

.pillar-confirm-card__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--pillar-text-primary, #111827);
}

.pillar-confirm-card__data {
  background: var(--pillar-bg-primary, #ffffff);
  border: 1px solid var(--pillar-border, #e5e7eb);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
}

.pillar-confirm-card__data-row {
  display: flex;
  gap: 8px;
  font-size: 13px;
  margin-bottom: 4px;
}

.pillar-confirm-card__data-row:last-child {
  margin-bottom: 0;
}

.pillar-confirm-card__data-key {
  color: var(--pillar-text-secondary, #6b7280);
  flex-shrink: 0;
}

.pillar-confirm-card__data-value {
  color: var(--pillar-text-primary, #111827);
  word-break: break-word;
}

.pillar-confirm-card__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.pillar-confirm-card__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  border: 1px solid transparent;
}

.pillar-confirm-card__btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.pillar-confirm-card__btn svg {
  width: 16px;
  height: 16px;
}

.pillar-confirm-card__btn--primary {
  background: var(--pillar-primary, #2563eb);
  color: #ffffff;
  border-color: var(--pillar-primary, #2563eb);
}

.pillar-confirm-card__btn--primary:hover:not(:disabled) {
  background: var(--pillar-primary-hover, #1d4ed8);
  border-color: var(--pillar-primary-hover, #1d4ed8);
}

.pillar-confirm-card__btn--secondary {
  background: var(--pillar-bg-primary, #ffffff);
  color: var(--pillar-text-secondary, #6b7280);
  border-color: var(--pillar-border, #e5e7eb);
}

.pillar-confirm-card__btn--secondary:hover:not(:disabled) {
  background: var(--pillar-bg-secondary, #f9fafb);
}

.pillar-confirm-card__success {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  color: #059669;
  font-weight: 500;
}

.pillar-confirm-card__success-icon svg {
  width: 20px;
  height: 20px;
}

.pillar-confirm-card__error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
  color: #dc2626;
  font-size: 13px;
}

.pillar-confirm-card__spinner {
  display: inline-flex;
  animation: pillar-spin 1s linear infinite;
}

@keyframes pillar-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
`;
