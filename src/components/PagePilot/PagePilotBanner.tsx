/**
 * Page Pilot Banner Component
 * Shows "Page being piloted by Agent" with stop button during interact_with_page actions
 */

import { h } from 'preact';
import { isPiloting, cancelPiloting } from '../../store/pagePilot';

// Stop/X icon SVG
const STOP_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>`;

export function PagePilotBanner() {
  const isVisible = isPiloting.value;

  if (!isVisible) {
    return null;
  }

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
