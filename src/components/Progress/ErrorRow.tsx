/**
 * ErrorRow Component
 *
 * A subtle, red-tinted progress-row-style error indicator with a retry button.
 * Shown at the bottom of the chat thread when an MCP request fails.
 * When upgradeUrl is present (plan limit exceeded), shows an upgrade link instead.
 */

import type { ChatError } from '../../store/chat';

export interface ErrorRowProps {
  error: ChatError;
  onRetry: () => void;
}

const RETRY_ICON = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>`;
const UPGRADE_ICON = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>`;

export function ErrorRow({ error, onRetry }: ErrorRowProps) {
  return (
    <div
      class="_pillar-error-row pillar-error-row"
      role="alert"
    >
      <span class="_pillar-error-row-icon pillar-error-row-icon" aria-hidden="true">
        ✗
      </span>
      <span class="_pillar-error-row-message pillar-error-row-message">
        {error.message}
      </span>
      {error.upgradeUrl ? (
        <a
          class="_pillar-error-row-retry pillar-error-row-retry"
          href={error.upgradeUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: 'none' }}
        >
          <span dangerouslySetInnerHTML={{ __html: UPGRADE_ICON }} />
          Upgrade
        </a>
      ) : (
        <button
          class="_pillar-error-row-retry pillar-error-row-retry"
          onClick={onRetry}
          type="button"
          aria-label="Retry"
        >
          <span dangerouslySetInnerHTML={{ __html: RETRY_ICON }} />
          Retry
        </button>
      )}
    </div>
  );
}
