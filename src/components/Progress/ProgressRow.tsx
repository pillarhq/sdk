/**
 * ProgressRow Component (History Mode)
 *
 * Renders stored progress events from message history.
 * For live progress during streaming, use AGUIProgress instead.
 *
 * This component handles the markdown-formatted progress events that are
 * stored in message history after a run completes.
 */

import { h, VNode } from 'preact';
import type { ProgressEvent } from '../../store/chat';
import { PreactMarkdown } from '../../utils/preact-markdown';

export interface ProgressRowProps {
  /** The progress event to render */
  progress: ProgressEvent;
  /**
   * @deprecated No longer used. Live streaming is handled by AGUIProgress.
   * Kept for backwards compatibility.
   */
  isActive?: boolean;
}

/**
 * Render a stored progress event as markdown.
 *
 * Progress events in history are already formatted by the store's
 * finalizeRun() function (e.g., wrapped in collapsible sections).
 */
export function ProgressRow({ progress }: ProgressRowProps): VNode | null {
  // Skip empty events
  if (!progress.markdown) {
    return null;
  }

  // Render the markdown content (typically collapsible thinking sections)
  return (
    <div class="_pillar-progress-row pillar-progress-row">
      <PreactMarkdown content={progress.markdown} />
    </div>
  );
}
