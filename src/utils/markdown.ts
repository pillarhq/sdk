/**
 * Markdown Renderer
 * Uses marked library for parsing markdown to HTML
 */

import { marked } from 'marked';

// Configure marked for safe, minimal output
marked.setOptions({
  gfm: true, // GitHub Flavored Markdown
  breaks: true, // Convert \n to <br>
});

/**
 * Render markdown content to HTML
 * Used for AI chat responses
 */
export function renderMarkdown(content: string): string {
  try {
    return marked.parse(content) as string;
  } catch (error) {
    console.error('[Pillar] Markdown parsing error:', error);
    // Fallback to escaped text
    return content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  }
}

