/**
 * ProgressRow Component
 * 
 * Displays progress events during AI response generation.
 * Cursor-inspired design:
 * - Thinking rows show "Thought for Xs" with live elapsed timer
 * - Chevron on right side, visible only on hover
 * - Content expands inline (no indentation)
 * - All rows are flush-left aligned
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import type { ProgressEvent, ProgressChild } from '../../store/chat';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { PreactMarkdown } from '../../utils/preact-markdown';

export interface ProgressRowProps {
  progress: ProgressEvent;
  isActive?: boolean;        // Fallback for legacy events without status
  isLast?: boolean;          // Whether this is the last row in the stack
  responseStarted?: boolean; // Whether the response has started streaming
  nested?: boolean;          // Whether this row is nested inside a ProgressGroup
}

export function ProgressRow({
  progress,
  isActive = false,
  isLast = false,
  responseStarted = false,
  nested = false,
}: ProgressRowProps) {
  // Determine effective active state from status or isActive prop
  const effectiveIsActive = progress.status === 'active' || (progress.status === undefined && isActive);
  const isError = progress.status === 'error' || progress.kind === 'query_failed';
  
  // Check if this is a thinking event
  const isThinking = progress.kind === 'thinking' || progress.kind === 'step_start';
  
  // Debounce text display to prevent layout thrashing during rapid updates (50ms)
  // This smooths out the rendering while keeping auto-scroll responsive
  const debouncedText = useDebouncedValue(progress.text, 50);
  
  // ── Elapsed time tracking for thinking events ──
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isThinking || !effectiveIsActive) return;

    const startTime =
      ((progress.metadata as Record<string, unknown>)?._startTime as number) ||
      Date.now();

    // Set initial value immediately
    setElapsedSeconds(Math.max(1, Math.round((Date.now() - startTime) / 1000)));

    const interval = setInterval(() => {
      setElapsedSeconds(Math.round((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isThinking, effectiveIsActive, progress.metadata]);
  
  // Check for expandable content:
  // - Has streaming/accumulated text
  // - Has children array (new schema)
  // - Has legacy sources
  // - Has arguments (tool call inputs)
  const hasText = Boolean(progress.text);
  const hasChildren = progress.children && progress.children.length > 0;
  const legacySources = (progress.metadata as Record<string, unknown>)?.sources as Array<{title: string; url: string}> | undefined;
  const hasLegacySources = progress.kind === 'search_complete' && legacySources && legacySources.length > 0;
  const noSourcesUsed = (progress.metadata as Record<string, unknown>)?.no_sources_used === true;
  const toolArguments = (progress.metadata as Record<string, unknown>)?.arguments as Record<string, unknown> | undefined;
  const hasArguments = toolArguments && Object.keys(toolArguments).length > 0;
  
  // Row is expandable if it has text content, children, sources, or arguments
  const isExpandable = hasText || hasChildren || (hasLegacySources && !noSourcesUsed) || hasArguments;

  // Check if this is a search that found no results
  const resultCount = (progress.metadata as Record<string, unknown>)?.result_count as number | undefined;
  const isNoResults = progress.kind === 'search' && resultCount === 0;

  // Expansion state:
  // - Active rows are expanded by default
  // - Done rows are collapsed by default
  // - User can manually toggle
  const [isManuallyToggled, setIsManuallyToggled] = useState(false);
  const [manualExpandState, setManualExpandState] = useState(false);
  
  // Determine actual expanded state.
  // Nested rows (inside a ProgressGroup): stay expanded while last in the group,
  // collapse when the next tool call arrives (loses isLast). The parent group
  // handles collapsing when narration text arrives.
  // Top-level rows: stay expanded until the response starts streaming.
  const shouldAutoExpand = nested
    ? (effectiveIsActive || isLast)
    : (effectiveIsActive || (isLast && !responseStarted));
  const isExpanded = isExpandable && (isManuallyToggled ? manualExpandState : shouldAutoExpand);

  // Ref for text preview container (auto-scroll)
  const textPreviewRef = useRef<HTMLDivElement>(null);

  // Track if we should show the top gradient (when there's content above)
  const [showTopGradient, setShowTopGradient] = useState(false);
  
  // Track if user has manually scrolled up in the text preview
  // When true, we don't auto-scroll to respect their position
  const [userScrolled, setUserScrolled] = useState(false);

  // Reset manual toggle when active state changes
  useEffect(() => {
    setIsManuallyToggled(false);
  }, [effectiveIsActive]);

  // Reset user scroll state when the event ID changes (new event)
  useEffect(() => {
    setUserScrolled(false);
  }, [progress.id, progress.progress_id]);

  // Auto-scroll text preview to bottom as text streams in
  // Only if user hasn't manually scrolled up
  useEffect(() => {
    if (textPreviewRef.current && effectiveIsActive && progress.text && !userScrolled) {
      textPreviewRef.current.scrollTop = textPreviewRef.current.scrollHeight;
    }
  }, [progress.text, effectiveIsActive, userScrolled]);
  
  // Detect user scroll in text preview to respect their position
  const handleTextPreviewScroll = () => {
    if (textPreviewRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = textPreviewRef.current;
      const isAtBottom = scrollTop >= scrollHeight - clientHeight - 5; // 5px threshold
      // If user scrolled away from bottom, stop auto-scrolling
      // If user scrolled back to bottom, resume auto-scrolling
      setUserScrolled(!isAtBottom);
      // Show top gradient only when there's content above (scrolled down)
      setShowTopGradient(scrollTop > 0);
    }
  };


  const handleToggle = () => {
    if (isExpandable) {
      setIsManuallyToggled(true);
      setManualExpandState(!isExpanded);
    }
  };
  
  // Chevron rotation: down when expanded, right when collapsed
  const chevronRotation = isExpanded ? 'rotate(90deg)' : 'rotate(0deg)';

  // Render children (new schema) or legacy sources
  const renderChildren = () => {
    if (hasChildren) {
      return (
        <div class="_pillar-progress-children pillar-progress-children">
          {progress.children!.map((child: ProgressChild, idx: number) => (
            <div key={child.id || idx} class="_pillar-progress-child-item pillar-progress-child-item">
              {child.url ? (
                <a
                  href={child.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="_pillar-progress-child-link pillar-progress-child-link"
                >
                  {child.label}
                </a>
              ) : (
                <span class="_pillar-progress-child-label pillar-progress-child-label">
                  {child.label}
                </span>
              )}
            </div>
          ))}
        </div>
      );
    }
    
    // Legacy sources rendering
    if (hasLegacySources) {
      return (
        <div class="_pillar-progress-sources pillar-progress-sources">
          {legacySources!.map((source, idx) => (
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
      );
    }
    
    return null;
  };

  // Skip rendering completely empty events (no label, message, or text)
  if (!progress.label && !progress.message && !progress.text && !hasChildren && !hasLegacySources && !isThinking) {
    return null;
  }

  // ── Display label ──
  const displayLabel = (() => {
    if (isThinking) {
      if (effectiveIsActive) {
        return elapsedSeconds > 0 ? `Thought for ${elapsedSeconds}s` : 'Thinking...';
      }
      // Done — use stored duration from metadata, fall back to timer state
      const duration = (progress.metadata as Record<string, unknown>)?._durationSeconds as number | undefined;
      const seconds = duration || elapsedSeconds;
      return seconds > 0 ? `Thought for ${seconds}s` : 'Thought';
    }
    return progress.label || progress.message || getDefaultMessage(progress.kind);
  })();
  
  const statusLabel = effectiveIsActive ? 'in progress' : isError ? 'error' : 'complete';

  return (
    <div 
      class={`_pillar-progress-row pillar-progress-row${isError ? ' _pillar-progress-row--error pillar-progress-row--error' : ''}${effectiveIsActive ? ' _pillar-progress-row--active pillar-progress-row--active' : ''}${isLast ? ' _pillar-progress-row--last pillar-progress-row--last' : ''}${nested ? ' _pillar-progress-row--nested pillar-progress-row--nested' : ''}`}
      role="status"
      aria-live={effectiveIsActive ? 'polite' : 'off'}
      aria-label={`${displayLabel}: ${statusLabel}`}
    >
      <div
        class="_pillar-progress-row-header pillar-progress-row-header"
        onClick={handleToggle}
        style={{ cursor: isExpandable ? 'pointer' : 'default' }}
        data-expanded={isExpanded}
        role={isExpandable ? 'button' : undefined}
        aria-expanded={isExpandable ? isExpanded : undefined}
        tabIndex={isExpandable ? 0 : undefined}
        onKeyDown={isExpandable ? (e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggle();
          }
        } : undefined}
      >
        {/* Error icon on left */}
        {isError && (
          <span class="_pillar-progress-error-icon pillar-progress-error-icon" aria-label="Error">
            ✗
          </span>
        )}

        {/* Label */}
        <span class="_pillar-progress-message pillar-progress-message">
          {displayLabel}
        </span>

        {/* No results indicator */}
        {isNoResults && (
          <span class="_pillar-progress-no-results pillar-progress-no-results">
            — no relevant results
          </span>
        )}

        {/* Chevron on right side — hidden by default, shown on hover via CSS */}
        {isExpandable && !isError && (
          <span
            class="_pillar-progress-chevron pillar-progress-chevron"
            style={{
              transform: chevronRotation,
              transition: 'transform 0.2s ease, opacity 0.15s ease',
            }}
            aria-hidden="true"
          >
            ▶
          </span>
        )}
      </div>

      {/* Expandable content area - text preview and/or children */}
      {isExpandable && (
        <div
          class={`_pillar-progress-content-wrapper pillar-progress-content-wrapper ${isExpanded ? '_pillar-progress-content-wrapper--expanded pillar-progress-content-wrapper--expanded' : ''}`}
        >
          <div class="_pillar-progress-content-container pillar-progress-content-container">
            {/* Tool call arguments (inputs) */}
            {hasArguments && (
              <div class="_pillar-progress-arguments pillar-progress-arguments">
                {Object.entries(toolArguments!).map(([key, value]) => (
                  <span key={key} class="_pillar-progress-argument pillar-progress-argument">
                    <span class="_pillar-progress-argument-key pillar-progress-argument-key">{key}:</span>{' '}
                    <span class="_pillar-progress-argument-value pillar-progress-argument-value">
                      {typeof value === 'string' ? value : JSON.stringify(value)}
                    </span>
                  </span>
                ))}
              </div>
            )}

            {/* Text content with top gradient when scrolled */}
            {hasText && (
              <div class="_pillar-progress-text-preview-wrapper pillar-progress-text-preview-wrapper">
                {showTopGradient && (
                  <div class="_pillar-progress-text-gradient pillar-progress-text-gradient" />
                )}
                <div 
                  ref={textPreviewRef}
                  class="_pillar-progress-text-preview pillar-progress-text-preview"
                  onScroll={handleTextPreviewScroll}
                >
                  <PreactMarkdown content={debouncedText || ''} />
                </div>
              </div>
            )}
            
            {/* Children/sources */}
            {renderChildren()}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Get default message for progress types that don't have a label or message.
 * This is a fallback for backwards compatibility - new events should include a `label`.
 */
function getDefaultMessage(kind: string): string {
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
    case 'thinking':
    case 'step_start':
      return 'Thinking...';
    case 'step_complete':
      return 'Done';
    case 'tool_call':
      return 'Running tool...';
    case 'plan':
      return 'Planning...';
    default:
      return 'Working...';
  }
}
