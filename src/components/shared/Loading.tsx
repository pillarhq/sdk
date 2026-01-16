/**
 * Loading Component
 * Displays a loading spinner
 */

import { h } from 'preact';

export function Loading() {
  return (
    <div class="_pillar-loading pillar-loading">
      <div class="_pillar-loading-spinner pillar-loading-spinner" />
    </div>
  );
}

