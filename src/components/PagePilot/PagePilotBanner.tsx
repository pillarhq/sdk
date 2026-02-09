/**
 * Page Pilot Banner Component
 * Shows "Page being piloted by Agent" with stop button during interact_with_page actions.
 * When a destructive action is detected, shows a confirmation variant with Allow/Deny buttons.
 */

import { h } from 'preact';
import {
  isPiloting,
  cancelPiloting,
  needsConfirmation,
  confirmationLabel,
  resolveConfirmation,
} from '../../store/pagePilot';

// Stop/X icon SVG
const STOP_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>`;

// Warning/shield icon SVG
const WARNING_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;

export function PagePilotBanner() {
  const isVisible = isPiloting.value;
  const showConfirmation = needsConfirmation.value;

  if (!isVisible && !showConfirmation) {
    return null;
  }

  // Confirmation variant: destructive action needs user approval
  if (showConfirmation) {
    const label = confirmationLabel.value || 'Destructive action';

    const handleAllow = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      resolveConfirmation(true);
    };

    const handleDeny = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      resolveConfirmation(false);
    };

    return (
      <div class="_pillar-page-pilot-banner pillar-page-pilot-banner _pillar-page-pilot-banner--confirm pillar-page-pilot-banner--confirm">
        <div class="_pillar-page-pilot-banner__content pillar-page-pilot-banner__content">
          <span
            class="_pillar-page-pilot-banner__warning-icon pillar-page-pilot-banner__warning-icon"
            dangerouslySetInnerHTML={{ __html: WARNING_ICON }}
          />
          <span class="_pillar-page-pilot-banner__text pillar-page-pilot-banner__text">
            {label}
          </span>
          <button
            type="button"
            class="_pillar-page-pilot-banner__deny pillar-page-pilot-banner__deny"
            onClick={handleDeny}
            aria-label="Deny destructive action"
          >
            Deny
          </button>
          <button
            type="button"
            class="_pillar-page-pilot-banner__allow pillar-page-pilot-banner__allow"
            onClick={handleAllow}
            aria-label="Allow destructive action"
          >
            Allow
          </button>
        </div>
      </div>
    );
  }

  // Default variant: page being piloted
  const handleStop = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    cancelPiloting();
  };

  return (
    <div class="_pillar-page-pilot-banner pillar-page-pilot-banner">
      <div class="_pillar-page-pilot-banner__content pillar-page-pilot-banner__content">
        <span class="_pillar-page-pilot-banner__indicator pillar-page-pilot-banner__indicator" />
        <span class="_pillar-page-pilot-banner__text pillar-page-pilot-banner__text">
          Page being piloted by Agent
        </span>
        <button
          type="button"
          class="_pillar-page-pilot-banner__stop pillar-page-pilot-banner__stop"
          onClick={handleStop}
          aria-label="Stop agent action"
        >
          <span
            class="_pillar-page-pilot-banner__stop-icon pillar-page-pilot-banner__stop-icon"
            dangerouslySetInnerHTML={{ __html: STOP_ICON }}
          />
          <span>Stop</span>
        </button>
      </div>
    </div>
  );
}
