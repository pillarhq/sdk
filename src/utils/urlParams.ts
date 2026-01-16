/**
 * URL Parameters Utility
 * Handles parsing and managing URL search params for auto-opening the panel
 */

export interface PillarUrlParams {
  /** Open the panel to home view */
  open?: boolean;
  /** Article slug to open */
  article?: string;
  /** Category slug to open */
  category?: string;
  /** Search query to perform */
  search?: string;
}

const DEFAULT_PREFIX = 'pillar-';

/**
 * Parse URL search params for Pillar-specific parameters
 */
export function parsePillarUrlParams(prefix: string = DEFAULT_PREFIX): PillarUrlParams {
  if (typeof window === 'undefined' || !window.location) {
    return {};
  }

  const searchParams = new URLSearchParams(window.location.search);
  const result: PillarUrlParams = {};

  // Check for pillar-open (can be just present or have a value)
  if (searchParams.has(`${prefix}open`)) {
    result.open = true;
  }

  // Check for pillar-article
  const article = searchParams.get(`${prefix}article`);
  if (article) {
    result.article = article;
  }

  // Also support pillar-article-id as an alias
  const articleId = searchParams.get(`${prefix}article-id`);
  if (articleId && !result.article) {
    result.article = articleId;
  }

  // Check for pillar-category
  const category = searchParams.get(`${prefix}category`);
  if (category) {
    result.category = category;
  }

  // Check for pillar-search
  const search = searchParams.get(`${prefix}search`);
  if (search) {
    result.search = search;
  }

  return result;
}

/**
 * Check if any Pillar URL params are present
 */
export function hasPillarUrlParams(prefix: string = DEFAULT_PREFIX): boolean {
  const params = parsePillarUrlParams(prefix);
  return params.open || !!params.article || !!params.category || !!params.search;
}

/**
 * Remove Pillar URL params from the current URL
 * Useful for cleaning up after the panel has opened
 */
export function clearPillarUrlParams(prefix: string = DEFAULT_PREFIX): void {
  if (typeof window === 'undefined' || !window.location || !window.history) {
    return;
  }

  const url = new URL(window.location.href);
  const paramsToRemove = [
    `${prefix}open`,
    `${prefix}article`,
    `${prefix}article-id`,
    `${prefix}category`,
    `${prefix}search`,
  ];

  let hasChanges = false;
  for (const param of paramsToRemove) {
    if (url.searchParams.has(param)) {
      url.searchParams.delete(param);
      hasChanges = true;
    }
  }

  if (hasChanges) {
    window.history.replaceState({}, '', url.toString());
  }
}

