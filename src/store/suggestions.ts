/**
 * Suggestions Store
 * Signal-based state for page-aware suggested questions
 * 
 * The backend generates a small set of suggested questions.
 * This store sorts them client-side based on page relevance
 * for instant page-aware suggestions without additional LLM calls.
 */

import { computed, signal } from '@preact/signals';
import type { SuggestedQuestion } from '../api/client';

// ============================================================================
// State Signals
// ============================================================================

/** Base suggestion pool from backend */
export const suggestionPool = signal<SuggestedQuestion[]>([]);

/** Currently displayed suggestions (sorted by page relevance) */
export const suggestions = signal<SuggestedQuestion[]>([]);

/** Loading state (only for initial pool fetch) */
export const suggestionsLoading = signal(false);

/** Error state */
export const suggestionsError = signal<string | null>(null);

/** Route when suggestions were last sorted */
export const lastSortedRoute = signal<string | null>(null);

// ============================================================================
// Computed Values
// ============================================================================

/** Whether we have suggestions to display */
export const hasSuggestions = computed(() => suggestions.value.length > 0);

/** Whether we have a pool to sort from */
export const hasPool = computed(() => suggestionPool.value.length > 0);

// ============================================================================
// Path Pattern Matching
// ============================================================================

/**
 * Check if a pathname matches a path pattern.
 * Supports:
 * - Exact match: "/pricing" matches only "/pricing"
 * - Single wildcard: "/blog/*" matches "/blog/post-1" but not "/blog/a/b"
 * - Deep wildcard: "/docs/**" matches "/docs/a/b/c"
 * - No pattern: always matches (shows on all pages)
 * 
 * @param pattern - The path pattern to match against
 * @param pathname - The current page pathname
 * @returns true if pathname matches the pattern
 */
function matchesPathPattern(pattern: string | undefined, pathname: string): boolean {
  if (!pattern) return true;
  
  // Exact match
  if (pattern === pathname) return true;
  
  // Deep wildcard: "/docs/**" matches any depth under /docs
  if (pattern.endsWith('/**')) {
    const prefix = pattern.slice(0, -3);
    return pathname === prefix || pathname.startsWith(prefix + '/');
  }
  
  // Single wildcard: "/blog/*" matches one level under /blog
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -2);
    if (!pathname.startsWith(prefix + '/')) return false;
    const remainder = pathname.slice(prefix.length + 1);
    return !remainder.includes('/');
  }
  
  // Prefix match (pattern without trailing slash)
  return pathname.startsWith(pattern);
}

// ============================================================================
// Sorting Utilities
// ============================================================================

/**
 * Sort suggestions by relevance to the current page.
 * First filters by path pattern, then scores by keyword matching.
 * 
 * @param pool - Full pool of suggestions from backend
 * @param pathname - Current page pathname (e.g., '/dashboards/new')
 * @param title - Current page title
 * @param limit - Maximum number of suggestions to return
 * @returns Sorted suggestions, most relevant first
 */
export function sortByPageRelevance(
  pool: SuggestedQuestion[],
  pathname: string,
  title: string,
  limit: number = 3
): SuggestedQuestion[] {
  if (pool.length === 0) return [];

  // Filter by path pattern first
  const matchingPool = pool.filter(suggestion => 
    matchesPathPattern(suggestion.pathPattern, pathname)
  );
  
  if (matchingPool.length === 0) return [];

  const keywords = extractKeywords(pathname, title);
  
  // Score each suggestion by keyword relevance
  // Manual suggestions (admin-configured) automatically get highest priority
  const scored = matchingPool.map(suggestion => ({
    suggestion,
    score: calculateRelevanceScore(suggestion, keywords)
  }));
  
  // Sort by score descending, then slice to limit
  scored.sort((a, b) => b.score - a.score);
  
  return scored.slice(0, limit).map(s => s.suggestion);
}

/**
 * Extract keywords from pathname and title for relevance scoring.
 * Splits on /, -, _ and spaces, filters short words.
 */
function extractKeywords(pathname: string, title: string): string[] {
  // Split pathname: "/dashboards/new-dashboard" → ["dashboards", "new", "dashboard"]
  const pathWords = pathname
    .split('/')
    .filter(Boolean)
    .flatMap(segment => segment.split(/[-_]/));
  
  // Split title: "Create New Dashboard - Grafana" → ["create", "new", "dashboard", "grafana"]
  const titleWords = title.toLowerCase().split(/\s+/);
  
  // Combine and dedupe, filter out short words (likely noise)
  return [...new Set([...pathWords, ...titleWords])]
    .map(w => w.toLowerCase())
    .filter(w => w.length > 2);
}

/**
 * Calculate how relevant a suggestion is to the given keywords.
 * Longer keyword matches score higher.
 * Manual suggestions (admin-configured) get infinite score to always rank first.
 */
function calculateRelevanceScore(
  suggestion: SuggestedQuestion,
  keywords: string[]
): number {
  // Manual suggestions always rank first (admin-configured priority)
  if (suggestion.manual) {
    return Infinity;
  }
  
  const textLower = suggestion.text.toLowerCase();
  let score = 0;
  
  for (const keyword of keywords) {
    if (textLower.includes(keyword)) {
      // Longer matches are more meaningful
      score += keyword.length;
    }
  }
  
  return score;
}

// ============================================================================
// Actions
// ============================================================================

/**
 * Set the base suggestion pool (called once on init).
 */
export function setSuggestionPool(pool: SuggestedQuestion[]): void {
  suggestionPool.value = pool;
}

/**
 * Update displayed suggestions (sorted for current page).
 */
export function setSuggestions(
  sorted: SuggestedQuestion[],
  route: string
): void {
  suggestions.value = sorted;
  lastSortedRoute.value = route;
}

/**
 * Set loading state.
 */
export function setSuggestionsLoading(loading: boolean): void {
  suggestionsLoading.value = loading;
}

/**
 * Set error state.
 */
export function setSuggestionsError(error: string | null): void {
  suggestionsError.value = error;
  suggestionsLoading.value = false;
}

/**
 * Sort pool for current page and update displayed suggestions.
 */
export function sortForCurrentPage(
  pathname: string,
  title: string,
  limit: number = 3
): SuggestedQuestion[] {
  const sorted = sortByPageRelevance(suggestionPool.value, pathname, title, limit);
  setSuggestions(sorted, pathname);
  return sorted;
}

/**
 * Reset all suggestions state.
 */
export function resetSuggestions(): void {
  suggestionPool.value = [];
  suggestions.value = [];
  suggestionsLoading.value = false;
  suggestionsError.value = null;
  lastSortedRoute.value = null;
}
