/**
 * Debug Panel Component
 * 
 * Shows real-time SDK event timeline for debugging.
 * Only rendered when debug: true is passed to Pillar.init()
 * 
 * Features:
 * - Source filtering (sdk, handler, network, server)
 * - Text search filter
 * - Color-coded log levels
 * - Export to JSON
 * - Drag to resize height
 * - Auto-scroll to bottom on new logs
 */

import { useEffect, useState, useMemo, useRef, useCallback } from 'preact/hooks';
import debugPanelCSS from './debug-panel.css';
import type { DebugEntry, DebugSource } from '../../utils/debug';
import Pillar from '../../core/Pillar';

interface DebugPanelProps {
  /** Whether the panel is expanded */
  expanded?: boolean;
  /** Callback when panel is toggled */
  onToggle?: () => void;
}

/**
 * Format timestamp as HH:MM:SS.mmm
 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  const ms = date.getMilliseconds().toString().padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${ms}`;
}

/**
 * Get color class for log level
 */
function getLevelColor(level: DebugEntry['level']): string {
  switch (level) {
    case 'error':
      return '#ef4444'; // red
    case 'warn':
      return '#f59e0b'; // amber
    default:
      return '#d4d4d4'; // default text
  }
}

/**
 * Get icon for source type
 */
function getSourceIcon(source: DebugEntry['source']): string {
  switch (source) {
    case 'sdk':
      return '⚡';
    case 'handler':
      return '🔧';
    case 'network':
      return '🌐';
    case 'server':
      return '🧠';
    default:
      return '•';
  }
}

/**
 * Get label for source type
 */
function getSourceLabel(source: DebugSource): string {
  switch (source) {
    case 'sdk':
      return 'SDK';
    case 'handler':
      return 'Handler';
    case 'network':
      return 'Network';
    case 'server':
      return 'Server';
    default:
      return source;
  }
}

// Styles are now loaded from debug-panel.css via raw import

const MIN_HEIGHT = 100;
const MAX_HEIGHT = 600;
const DEFAULT_HEIGHT = 200;

const ALL_SOURCES: DebugSource[] = ['sdk', 'handler', 'network', 'server'];

/**
 * Debug Panel Component
 */
export function DebugPanel({ expanded = false, onToggle }: DebugPanelProps) {
  const [entries, setEntries] = useState<DebugEntry[]>([]);
  const [isExpanded, setIsExpanded] = useState(expanded);
  const [filter, setFilter] = useState<string>('');
  const [activeSources, setActiveSources] = useState<Set<DebugSource>>(new Set(ALL_SOURCES));
  const [panelHeight, setPanelHeight] = useState(DEFAULT_HEIGHT);
  const [isResizing, setIsResizing] = useState(false);
  const [expandedEntries, setExpandedEntries] = useState<Set<number>>(new Set());
  const [copyFeedback, setCopyFeedback] = useState<'copy' | 'copyAll' | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Store the original body padding-bottom so we can restore it on unmount
  const originalPaddingRef = useRef<string>('');

  // Inject styles on mount
  useEffect(() => {
    const styleId = 'pillar-debug-panel-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = debugPanelCSS;
      document.head.appendChild(style);
    }

    // Capture original body padding-bottom
    originalPaddingRef.current = document.body.style.paddingBottom || '';

    const pillar = Pillar.getInstance();
    if (!pillar) return;

    // Get initial entries
    setEntries(pillar.getDebugLog());

    // Subscribe to updates
    const unsubscribe = pillar.onDebugLog((newEntries) => {
      setEntries([...newEntries]);
    });

    return () => {
      unsubscribe();
      // Restore original body padding on unmount
      document.body.style.paddingBottom = originalPaddingRef.current;
    };
  }, []);

  // Push page content up by adjusting body padding to match panel height.
  // Uses ResizeObserver so it fires after layout on every size change
  // (expand/collapse, drag-resize, content changes).
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;

    const updatePadding = () => {
      document.body.style.paddingBottom = `${el.offsetHeight}px`;
    };

    const observer = new ResizeObserver(updatePadding);
    observer.observe(el);

    // Also set it immediately for the initial render
    updatePadding();

    return () => {
      observer.disconnect();
    };
  }, []);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (timelineRef.current && entries.length > 0) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        if (timelineRef.current) {
          timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
        }
      });
    }
  }, [entries]);

  // Handle resize drag
  const handleResizeStart = useCallback((e: MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startY = e.clientY;
    const startHeight = panelHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = startY - moveEvent.clientY;
      const newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startHeight + deltaY));
      setPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [panelHeight]);

  // Count entries by source
  const sourceCounts = useMemo(() => {
    const counts: Record<DebugSource, number> = { sdk: 0, handler: 0, network: 0, server: 0 };
    for (const entry of entries) {
      counts[entry.source] = (counts[entry.source] || 0) + 1;
    }
    return counts;
  }, [entries]);

  // Filter entries
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      // Source filter
      if (!activeSources.has(e.source)) return false;
      // Text filter
      if (filter) {
        const searchText = filter.toLowerCase();
        const eventMatch = e.event.toLowerCase().includes(searchText);
        const dataMatch = e.data ? JSON.stringify(e.data).toLowerCase().includes(searchText) : false;
        if (!eventMatch && !dataMatch) return false;
      }
      return true;
    });
  }, [entries, activeSources, filter]);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
    onToggle?.();
  };

  const handleClear = () => {
    const pillar = Pillar.getInstance();
    pillar?.clearDebugLog();
  };

  const handleExport = () => {
    const data = JSON.stringify(entries, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pillar-debug-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /**
   * Format entries as readable text with a header
   */
  const formatEntriesAsText = (entriesToFormat: DebugEntry[], label: string): string => {
    const header = [
      '=== Pillar SDK — Client Logs ===',
      `Output: ${label}`,
      `Exported: ${new Date().toISOString()}`,
      `Entries: ${entriesToFormat.length}`,
      '',
    ].join('\n');

    const lines = entriesToFormat.map(entry => {
      const time = formatTime(entry.timestamp);
      const source = getSourceLabel(entry.source).toUpperCase().padEnd(8);
      const level = entry.level === 'error' ? ' [ERROR]' : entry.level === 'warn' ? ' [WARN]' : '';
      const data = entry.data != null
        ? ` ${typeof entry.data === 'object' ? JSON.stringify(entry.data) : String(entry.data)}`
        : '';
      return `${time} [${source}]${level} ${entry.event}${data}`;
    });

    return header + lines.join('\n');
  };

  const handleCopy = () => {
    const activeSourceLabels = ALL_SOURCES
      .filter(s => activeSources.has(s))
      .map(getSourceLabel)
      .join(', ');
    const label = filter
      ? `${activeSourceLabels} (filtered: "${filter}")`
      : activeSourceLabels;
    const text = formatEntriesAsText(filteredEntries, label);
    navigator.clipboard.writeText(text);
    setCopyFeedback('copy');
    setTimeout(() => setCopyFeedback(null), 1500);
  };

  const handleCopyAll = () => {
    const text = formatEntriesAsText(entries, 'All Sources');
    navigator.clipboard.writeText(text);
    setCopyFeedback('copyAll');
    setTimeout(() => setCopyFeedback(null), 1500);
  };

  const toggleSource = (source: DebugSource) => {
    setActiveSources(prev => {
      const next = new Set(prev);
      if (next.has(source)) {
        next.delete(source);
      } else {
        next.add(source);
      }
      return next;
    });
  };

  const toggleEntryExpand = (index: number) => {
    setExpandedEntries(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const formatData = (data: unknown): string => {
    if (data === null || data === undefined) return '';
    if (typeof data === 'object') {
      return JSON.stringify(data, null, 2);
    }
    return String(data);
  };

  return (
    <div class="pillar-debug-panel" ref={panelRef}>
      {/* Resize Handle */}
      {isExpanded && (
        <div
          class={`pillar-debug-resize-handle ${isResizing ? 'active' : ''}`}
          onMouseDown={handleResizeStart as any}
        />
      )}

      {/* Header */}
      <div class="pillar-debug-header" onClick={handleToggle}>
        <span class="pillar-debug-header-icon">{isExpanded ? '▼' : '▶'}</span>
        <span class="pillar-debug-header-title">Debug</span>
        <span class="pillar-debug-header-count">{entries.length}</span>
        {isExpanded && (
          <div class="pillar-debug-header-actions">
            <button
              class={`pillar-debug-btn ${copyFeedback === 'copy' ? 'copied' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handleCopy();
              }}
            >
              {copyFeedback === 'copy' ? 'Copied!' : 'Copy'}
            </button>
            <button
              class={`pillar-debug-btn ${copyFeedback === 'copyAll' ? 'copied' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handleCopyAll();
              }}
            >
              {copyFeedback === 'copyAll' ? 'Copied!' : 'Copy All'}
            </button>
            <button
              class="pillar-debug-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleExport();
              }}
            >
              Export
            </button>
            <button
              class="pillar-debug-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {isExpanded && (
        <div class="pillar-debug-content" style={{ height: `${panelHeight}px` }}>
          {/* Toolbar */}
          <div class="pillar-debug-toolbar">
            <input
              type="text"
              class="pillar-debug-filter-input"
              placeholder="Filter..."
              value={filter}
              onInput={(e) => setFilter((e.target as HTMLInputElement).value)}
              onClick={(e) => e.stopPropagation()}
            />
            <div class="pillar-debug-source-filters">
              {ALL_SOURCES.map(source => (
                <button
                  key={source}
                  class={`pillar-debug-source-btn ${activeSources.has(source) ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSource(source);
                  }}
                >
                  {getSourceIcon(source)} {getSourceLabel(source)}
                  <span class="pillar-debug-source-count">{sourceCounts[source]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div class="pillar-debug-timeline" ref={timelineRef}>
            {filteredEntries.length === 0 ? (
              <div class="pillar-debug-empty">
                {entries.length === 0 ? 'No events captured yet' : 'No events match filters'}
              </div>
            ) : (
              filteredEntries.map((entry, index) => {
                const isEntryExpanded = expandedEntries.has(index);
                const hasData = entry.data !== null && entry.data !== undefined;
                
                return (
                  <div
                    key={index}
                    class={`pillar-debug-entry ${entry.source} ${isEntryExpanded ? 'expanded' : ''}`}
                    onClick={() => hasData && toggleEntryExpand(index)}
                    style={{ cursor: hasData ? 'pointer' : 'default' }}
                  >
                    <div class="pillar-debug-entry-row">
                      <span class="pillar-debug-entry-time">{formatTime(entry.timestamp)}</span>
                      <span class={`pillar-debug-entry-source ${entry.source}`}>
                        {getSourceIcon(entry.source)}
                      </span>
                      <span class="pillar-debug-entry-event" style={{ color: getLevelColor(entry.level) }}>
                        {entry.event}
                      </span>
                      {hasData && !isEntryExpanded && (
                        <span class="pillar-debug-entry-data">
                          {typeof entry.data === 'object' 
                            ? JSON.stringify(entry.data, null, 0).slice(0, 100)
                            : String(entry.data)
                          }
                        </span>
                      )}
                      {hasData && (
                        <span class="pillar-debug-entry-expand">
                          {isEntryExpanded ? '▼' : '▶'}
                        </span>
                      )}
                    </div>
                    {hasData && isEntryExpanded && (
                      <span class="pillar-debug-entry-data">
                        {formatData(entry.data)}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default DebugPanel;
