/**
 * History Dropdown Component
 * Shows a list of past conversations grouped by day (like Cursor).
 */

import { h, Fragment } from 'preact';
import { useState, useRef, useEffect, useMemo } from 'preact/hooks';
import { getApiClient } from '../../core/Pillar';
import { historyInvalidationCounter, optimisticConversations } from '../../store/chat';
import { debug } from '../../utils/debug';
import type { ConversationSummary } from '../../api/client';

const CLOCK_ICON = `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg>`;

interface HistoryDropdownProps {
  onSelectConversation: (conversationId: string) => void;
}

interface GroupedConversations {
  label: string;
  conversations: ConversationSummary[];
}

/**
 * Parse a date string, handling malformed ISO strings with both offset and Z suffix.
 */
function parseDate(dateStr: string): Date {
  // Handle malformed dates like "2026-01-29T21:45:26.595390+00:00Z"
  // which have both timezone offset AND Z suffix
  let cleaned = dateStr;
  if (dateStr.endsWith('Z') && dateStr.includes('+')) {
    // Remove the trailing Z if there's already a timezone offset
    cleaned = dateStr.slice(0, -1);
  }
  return new Date(cleaned);
}

/**
 * Get the day group label for a date (Today, Yesterday, 2d ago, etc.)
 */
function getDayGroupLabel(dateStr: string | null): string {
  if (!dateStr) return 'Unknown';
  
  const date = parseDate(dateStr);
  const now = new Date();
  
  // Reset to start of day for accurate comparison
  const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const diffMs = today.getTime() - dateDay.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  } else {
    return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  }
}

/**
 * Group conversations by day
 */
function groupConversationsByDay(conversations: ConversationSummary[]): GroupedConversations[] {
  const groups = new Map<string, ConversationSummary[]>();
  
  for (const conv of conversations) {
    const label = getDayGroupLabel(conv.lastMessageAt);
    const existing = groups.get(label) || [];
    existing.push(conv);
    groups.set(label, existing);
  }
  
  // Convert to array (order is preserved from original sorted list)
  return Array.from(groups.entries()).map(([label, convs]) => ({
    label,
    conversations: convs,
  }));
}

export function HistoryDropdown({ onSelectConversation }: HistoryDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [hasFetched, setHasFetched] = useState(false);
  const [lastInvalidation, setLastInvalidation] = useState(historyInvalidationCounter.value);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Group conversations by day
  const groupedConversations = useMemo(
    () => groupConversationsByDay(conversations),
    [conversations]
  );

  // Subscribe to history invalidation (new conversation created)
  useEffect(() => {
    const unsubscribe = historyInvalidationCounter.subscribe((counter) => {
      if (counter > lastInvalidation) {
        setHasFetched(false);
        setLastInvalidation(counter);
      }
    });
    return unsubscribe;
  }, [lastInvalidation]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  /**
   * Merge optimistic (client-side) conversations with server results.
   * Optimistic entries appear first; duplicates by ID are removed.
   */
  const mergeWithOptimistic = (serverList: ConversationSummary[]): ConversationSummary[] => {
    const optimistic = optimisticConversations.value;
    if (optimistic.length === 0) return serverList;

    const serverIds = new Set(serverList.map((c) => c.id));
    // Prepend optimistic entries that the server doesn't know about yet
    const newOptimistic = optimistic.filter((c) => !serverIds.has(c.id));
    return [...newOptimistic, ...serverList];
  };

  const fetchConversations = async () => {
    if (hasFetched) return;
    
    setIsLoading(true);
    try {
      const apiClient = getApiClient();
      if (apiClient) {
        const result = await apiClient.listConversations(20);
        setConversations(mergeWithOptimistic(result));
      }
    } catch (error) {
      debug.error('[Pillar] Failed to fetch conversations:', error);
      // Even on error, show optimistic conversations if any
      if (optimisticConversations.value.length > 0) {
        setConversations(optimisticConversations.value);
      }
    } finally {
      setIsLoading(false);
      setHasFetched(true);
    }
  };

  const handleToggle = () => {
    const willOpen = !isOpen;
    setIsOpen(willOpen);
    
    // Fetch conversations only when opening and not already fetched
    if (willOpen && !hasFetched) {
      fetchConversations();
    }
  };

  const handleSelectConversation = (conversationId: string) => {
    setIsOpen(false);
    onSelectConversation(conversationId);
  };

  return (
    <div class="_pillar-history-dropdown pillar-history-dropdown" ref={dropdownRef}>
      <button
        class="_pillar-icon-btn pillar-icon-btn pillar-history-btn"
        onClick={handleToggle}
        aria-label="Conversation history"
        aria-expanded={isOpen}
        title="Conversation history"
        type="button"
        dangerouslySetInnerHTML={{ __html: CLOCK_ICON }}
      />
      
      {isOpen && (
        <div class="_pillar-history-menu pillar-history-menu">
          {isLoading ? (
            <div class="_pillar-history-loading pillar-history-loading">
              <div class="_pillar-history-spinner pillar-history-spinner" />
              <span>Loading...</span>
            </div>
          ) : conversations.length === 0 ? (
            <div class="_pillar-history-empty pillar-history-empty">
              No conversations yet
            </div>
          ) : (
            <div class="_pillar-history-list pillar-history-list">
              {groupedConversations.map((group) => (
                <Fragment key={group.label}>
                  <div class="_pillar-history-group-header pillar-history-group-header">
                    {group.label}
                  </div>
                  {group.conversations.map((conv) => (
                    <button
                      key={conv.id}
                      class="_pillar-history-item pillar-history-item"
                      onClick={() => handleSelectConversation(conv.id)}
                      type="button"
                    >
                      <span class="_pillar-history-item-title pillar-history-item-title">
                        {conv.title}
                      </span>
                    </button>
                  ))}
                </Fragment>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
