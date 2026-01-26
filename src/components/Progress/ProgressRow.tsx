/**
 * ProgressRow Component
 * 
 * Displays progress events during AI response generation.
 * Supports expandable source lists for search_complete events.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import type { ProgressEvent } from '../../store/chat';

export interface ProgressRowProps {
  progress: ProgressEvent;
  isActive?: boolean;
}

export function ProgressRow({
  progress,
  isActive = false,
}: ProgressRowProps) {
  // Start expanded if active, but allow manual toggle
  const [isManuallyToggled, setIsManuallyToggled] = useState(false);
  const [manualExpandState, setManualExpandState] = useState(false);

  // Only expandable for search_complete events with sources that were actually used
  const isSearchComplete = progress.kind === 'search_complete';
  const hasSources = progress.metadata?.sources && progress.metadata.sources.length > 0;
  const noSourcesUsed = progress.metadata?.no_sources_used === true;
  // Not expandable if sources were retrieved but not used (fallback response)
  const isExpandable = isSearchComplete && hasSources && !noSourcesUsed;

  // Check if this is a search that found no results
  const isNoResults = isSearchComplete && progress.metadata?.result_count === 0;

  // Check if this is a failed query
  const isQueryFailed = progress.kind === 'query_failed';

  // Determine actual expanded state: use manual if toggled, otherwise follow isActive
  const isExpanded = isExpandable && (isManuallyToggled ? manualExpandState : isActive);

  // Ref for content container
  const contentRef = useRef<HTMLDivElement>(null);

  // Track if we should show the bottom gradient (only when not scrolled to bottom)
  const [showBottomGradient, setShowBottomGradient] = useState(false);

  // Reset manual toggle when isActive changes
  useEffect(() => {
    setIsManuallyToggled(false);
  }, [isActive]);

  // Update gradient visibility based on scroll position
  const updateGradientVisibility = () => {
    if (contentRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
      // Show bottom gradient only when not at bottom (there's content below)
      const hasOverflow = scrollHeight > clientHeight;
      const isAtBottom = scrollTop >= scrollHeight - clientHeight - 5; // 5px threshold
      setShowBottomGradient(hasOverflow && !isAtBottom);
    }
  };

  // Check gradient visibility when content changes or expands
  useEffect(() => {
    updateGradientVisibility();
  }, [progress.metadata?.sources, isExpanded]);

  // Handle scroll events to update gradient visibility
  const handleScroll = () => {
    updateGradientVisibility();
  };

  const handleToggle = () => {
    if (isExpandable) {
      setIsManuallyToggled(true);
      setManualExpandState(!isExpanded);
    }
  };

  return (
    <div class={`_pillar-progress-row pillar-progress-row${isQueryFailed ? ' _pillar-progress-row--error pillar-progress-row--error' : ''}`}>
      <div
        class="_pillar-progress-row-header pillar-progress-row-header"
        onClick={handleToggle}
        style={{ cursor: isExpandable ? 'pointer' : 'default' }}
        data-expanded={isExpanded}
      >
        {/* Always render expand icon for consistent alignment */}
        {/* Make it invisible (not hidden) when not expandable to preserve spacing */}
        <span
          class="_pillar-progress-expand-icon pillar-progress-expand-icon"
          style={{
            visibility: isExpandable ? 'visible' : 'hidden',
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}
        >
          ▶
        </span>
        <span class="_pillar-progress-message pillar-progress-message">
          {progress.message || getDefaultMessage(progress.kind)}
        </span>
        {/* Show "no results" indicator when search completed with 0 results */}
        {isNoResults && (
          <span class="_pillar-progress-no-results pillar-progress-no-results">
            — no relevant results
          </span>
        )}
      </div>

      {isExpandable && (
        <div
          class={`_pillar-progress-content-wrapper pillar-progress-content-wrapper ${isExpanded ? '_pillar-progress-content-wrapper--expanded pillar-progress-content-wrapper--expanded' : ''}`}
        >
          <div
            ref={contentRef}
            class="_pillar-progress-content-container pillar-progress-content-container"
            onScroll={handleScroll}
          >
            <div class="_pillar-progress-sources pillar-progress-sources">
              {progress.metadata?.sources?.map((source, idx) => (
                <div key={idx} class="_pillar-progress-source-item pillar-progress-source-item">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="_pillar-progress-source-link pillar-progress-source-link"
                  >
                    <span class="_pillar-progress-source-title pillar-progress-source-title">
                      {source.title}
                    </span>
                  </a>
                </div>
              ))}
            </div>
          </div>
          {showBottomGradient && (
            <div class="_pillar-progress-content-gradient pillar-progress-content-gradient" />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Get default message for progress types that don't have a message
 */
function getDefaultMessage(kind: ProgressEvent['kind']): string {
  switch (kind) {
    case 'processing':
      return 'Processing...';
    case 'search':
      return 'Searching...';
    case 'search_complete':
      return 'Search complete';
    case 'query':
      return 'Executing action...';
    case 'query_complete':
      return 'Action complete';
    case 'query_failed':
      return 'Action failed';
    case 'generating':
      return 'Generating answer...';
    default:
      return 'Working...';
  }
}
