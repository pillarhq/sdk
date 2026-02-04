/**
 * Preact Markdown Renderer
 *
 * Converts markdown content to Preact vnodes using the marked lexer.
 * Supports custom component substitution for special patterns.
 */

import { h, VNode, Fragment, ComponentChildren } from 'preact';
import { marked, Token, Tokens } from 'marked';
import { debug } from './debug';
import {
  CollapsibleSection,
  CodeBlock,
  SourceList,
  Source,
  ProgressIndicator,
} from './markdown-components';

// ============================================================================
// Types
// ============================================================================

export interface PreactMarkdownProps {
  content: string;
  class?: string;
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Render markdown content as Preact vnodes.
 * Supports custom component markers in code blocks and HTML-like syntax.
 */
export function PreactMarkdown({ content, class: className }: PreactMarkdownProps): VNode {
  if (!content || !content.trim()) {
    return <span />;
  }

  try {
    // Parse markdown to tokens
    const tokens = marked.lexer(content);

    // Convert tokens to Preact vnodes
    return (
      <div class={`_pillar-markdown pillar-markdown ${className || ''}`}>
        {tokensToVNodes(tokens)}
      </div>
    );
  } catch (error) {
    debug.error('[Pillar] Markdown parsing error:', error);
    // Fallback to plain text
    return (
      <div class={`_pillar-markdown pillar-markdown ${className || ''}`}>
        {content}
      </div>
    );
  }
}

// ============================================================================
// Token to VNode Conversion
// ============================================================================

function tokensToVNodes(tokens: Token[]): VNode[] {
  return tokens.map((token, i) => tokenToVNode(token, i)).filter(Boolean) as VNode[];
}

function tokenToVNode(token: Token, key: number): VNode | null {
  switch (token.type) {
    case 'heading':
      return renderHeading(token as Tokens.Heading, key);

    case 'paragraph':
      return renderParagraph(token as Tokens.Paragraph, key);

    case 'text':
      return renderText(token as Tokens.Text, key);

    case 'code':
      return renderCode(token as Tokens.Code, key);

    case 'blockquote':
      return renderBlockquote(token as Tokens.Blockquote, key);

    case 'list':
      return renderList(token as Tokens.List, key);

    case 'list_item':
      return renderListItem(token as Tokens.ListItem, key);

    case 'table':
      return renderTable(token as Tokens.Table, key);

    case 'hr':
      return <hr key={key} class="_pillar-md-hr pillar-md-hr" />;

    case 'space':
      return null; // Skip whitespace tokens

    case 'html':
      return renderHtml(token as Tokens.HTML, key);

    case 'strong':
      return <strong key={key}>{renderInlineTokens((token as Tokens.Strong).tokens)}</strong>;

    case 'em':
      return <em key={key}>{renderInlineTokens((token as Tokens.Em).tokens)}</em>;

    case 'codespan':
      return <code key={key} class="_pillar-md-code-inline pillar-md-code-inline">{(token as Tokens.Codespan).text}</code>;

    case 'link':
      const linkToken = token as Tokens.Link;
      return (
        <a
          key={key}
          href={linkToken.href}
          title={linkToken.title || undefined}
          target="_blank"
          rel="noopener noreferrer"
          class="_pillar-md-link pillar-md-link"
        >
          {renderInlineTokens(linkToken.tokens)}
        </a>
      );

    case 'image':
      const imgToken = token as Tokens.Image;
      return (
        <img
          key={key}
          src={imgToken.href}
          alt={imgToken.text}
          title={imgToken.title || undefined}
          class="_pillar-md-image pillar-md-image"
        />
      );

    case 'br':
      return <br key={key} />;

    case 'del':
      return <del key={key}>{renderInlineTokens((token as Tokens.Del).tokens)}</del>;

    default:
      // Fallback: render raw content if available
      if ('raw' in token && typeof token.raw === 'string') {
        return <span key={key}>{token.raw}</span>;
      }
      return null;
  }
}

// ============================================================================
// Block Element Renderers
// ============================================================================

function renderHeading(token: Tokens.Heading, key: number): VNode {
  const Tag = `h${token.depth}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  return (
    <Tag key={key} class={`_pillar-md-heading _pillar-md-h${token.depth} pillar-md-heading pillar-md-h${token.depth}`}>
      {renderInlineTokens(token.tokens)}
    </Tag>
  );
}

function renderParagraph(token: Tokens.Paragraph, key: number): VNode {
  return (
    <p key={key} class="_pillar-md-paragraph pillar-md-paragraph">
      {renderInlineTokens(token.tokens)}
    </p>
  );
}

function renderText(token: Tokens.Text, key: number): VNode {
  // Text tokens may have nested tokens
  if (token.tokens && token.tokens.length > 0) {
    return <Fragment key={key}>{renderInlineTokens(token.tokens)}</Fragment>;
  }
  return <Fragment key={key}>{token.text}</Fragment>;
}

function renderCode(token: Tokens.Code, key: number): VNode {
  const lang = token.lang || '';
  const text = token.text;

  // Check for custom component markers
  // Format: ```collapsible:Title
  if (lang.startsWith('collapsible:')) {
    const title = lang.substring('collapsible:'.length);
    return (
      <CollapsibleSection key={key} title={title}>
        <PreactMarkdown content={text} />
      </CollapsibleSection>
    );
  }

  // Format: ```collapsible-open:Title (starts expanded)
  if (lang.startsWith('collapsible-open:')) {
    const title = lang.substring('collapsible-open:'.length);
    return (
      <CollapsibleSection key={key} title={title} defaultOpen>
        <PreactMarkdown content={text} />
      </CollapsibleSection>
    );
  }

  // Format: ```sources (JSON array of sources)
  if (lang === 'sources') {
    try {
      const sources: Source[] = JSON.parse(text);
      return <SourceList key={key} sources={sources} />;
    } catch {
      debug.warn('[Pillar] Failed to parse sources JSON');
    }
  }

  // Format: ```progress:message (active progress indicator)
  if (lang.startsWith('progress:')) {
    const message = lang.substring('progress:'.length);
    return <ProgressIndicator key={key} message={message} isActive />;
  }

  // Format: ```progress-done:message (completed progress)
  if (lang.startsWith('progress-done:')) {
    const message = lang.substring('progress-done:'.length);
    return <ProgressIndicator key={key} message={message} isActive={false} />;
  }

  // Regular code block
  return <CodeBlock key={key} language={lang || undefined}>{text}</CodeBlock>;
}

function renderBlockquote(token: Tokens.Blockquote, key: number): VNode {
  return (
    <blockquote key={key} class="_pillar-md-blockquote pillar-md-blockquote">
      {tokensToVNodes(token.tokens)}
    </blockquote>
  );
}

function renderList(token: Tokens.List, key: number): VNode {
  const items = token.items.map((item, i) => renderListItem(item, i));

  if (token.ordered) {
    return (
      <ol key={key} start={token.start || 1} class="_pillar-md-list _pillar-md-list--ordered pillar-md-list pillar-md-list--ordered">
        {items}
      </ol>
    );
  }

  return (
    <ul key={key} class="_pillar-md-list _pillar-md-list--unordered pillar-md-list pillar-md-list--unordered">
      {items}
    </ul>
  );
}

function renderListItem(token: Tokens.ListItem, key: number): VNode {
  // Check if this is a task list item
  if (token.task) {
    return (
      <li key={key} class="_pillar-md-list-item _pillar-md-task-item pillar-md-list-item pillar-md-task-item">
        <input
          type="checkbox"
          checked={token.checked}
          disabled
          class="_pillar-md-task-checkbox pillar-md-task-checkbox"
        />
        <span class={token.checked ? '_pillar-md-task-text--checked pillar-md-task-text--checked' : ''}>
          {tokensToVNodes(token.tokens)}
        </span>
      </li>
    );
  }

  return (
    <li key={key} class="_pillar-md-list-item pillar-md-list-item">
      {tokensToVNodes(token.tokens)}
    </li>
  );
}

function renderTable(token: Tokens.Table, key: number): VNode {
  return (
    <div key={key} class="_pillar-md-table-wrapper pillar-md-table-wrapper">
      <table class="_pillar-md-table pillar-md-table">
        <thead>
          <tr>
            {token.header.map((cell, i) => (
              <th
                key={i}
                style={token.align[i] ? { textAlign: token.align[i] as string } : undefined}
                class="_pillar-md-th pillar-md-th"
              >
                {renderInlineTokens(cell.tokens)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {token.rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  style={token.align[j] ? { textAlign: token.align[j] as string } : undefined}
                  class="_pillar-md-td pillar-md-td"
                >
                  {renderInlineTokens(cell.tokens)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderHtml(token: Tokens.HTML, key: number): VNode {
  // Parse simple component-like HTML tags
  // Format: <ComponentName prop="value" />
  const componentMatch = token.raw.match(/<(\w+)\s*([^>]*)\/?\s*>/);

  if (componentMatch) {
    const [, tagName, propsStr] = componentMatch;

    // Parse props from the string
    const props = parseHtmlProps(propsStr);

    // Check for known components
    switch (tagName) {
      case 'SourceList':
        if (props.sources) {
          try {
            const sources: Source[] = JSON.parse(props.sources);
            return <SourceList key={key} sources={sources} />;
          } catch {
            debug.warn('[Pillar] Failed to parse SourceList sources');
          }
        }
        break;

      case 'Progress':
        return (
          <ProgressIndicator
            key={key}
            message={props.message || 'Processing...'}
            isActive={props.active !== 'false'}
          />
        );

      case 'Collapsible':
        return (
          <CollapsibleSection
            key={key}
            title={props.title || 'Details'}
            defaultOpen={props.open === 'true'}
          >
            {props.content ? <PreactMarkdown content={props.content} /> : null}
          </CollapsibleSection>
        );
    }
  }

  // Fallback: render as raw HTML (use sparingly)
  return <span key={key} dangerouslySetInnerHTML={{ __html: token.raw }} />;
}

// ============================================================================
// Inline Token Rendering
// ============================================================================

function renderInlineTokens(tokens: Token[] | undefined): ComponentChildren {
  if (!tokens || tokens.length === 0) return null;

  return tokens.map((token, i) => {
    switch (token.type) {
      case 'text':
        return (token as Tokens.Text).text;

      case 'strong':
        return <strong key={i}>{renderInlineTokens((token as Tokens.Strong).tokens)}</strong>;

      case 'em':
        return <em key={i}>{renderInlineTokens((token as Tokens.Em).tokens)}</em>;

      case 'codespan':
        return <code key={i} class="_pillar-md-code-inline pillar-md-code-inline">{(token as Tokens.Codespan).text}</code>;

      case 'link':
        const linkToken = token as Tokens.Link;
        return (
          <a
            key={i}
            href={linkToken.href}
            title={linkToken.title || undefined}
            target="_blank"
            rel="noopener noreferrer"
            class="_pillar-md-link pillar-md-link"
          >
            {renderInlineTokens(linkToken.tokens)}
          </a>
        );

      case 'image':
        const imgToken = token as Tokens.Image;
        return (
          <img
            key={i}
            src={imgToken.href}
            alt={imgToken.text}
            title={imgToken.title || undefined}
            class="_pillar-md-image pillar-md-image"
          />
        );

      case 'br':
        return <br key={i} />;

      case 'del':
        return <del key={i}>{renderInlineTokens((token as Tokens.Del).tokens)}</del>;

      case 'escape':
        return (token as Tokens.Escape).text;

      default:
        if ('raw' in token && typeof token.raw === 'string') {
          return token.raw;
        }
        return null;
    }
  });
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Parse HTML-style props from a string like: prop1="value1" prop2='value2'
 */
function parseHtmlProps(propsStr: string): Record<string, string> {
  const props: Record<string, string> = {};
  const regex = /(\w+)=["']([^"']*)["']/g;
  let match;

  while ((match = regex.exec(propsStr)) !== null) {
    props[match[1]] = match[2];
  }

  return props;
}

// ============================================================================
// Markdown Styles
// ============================================================================

export const PREACT_MARKDOWN_STYLES = `
/* Base markdown container */
._pillar-markdown {
  font-size: 14px;
  line-height: 1.6;
  color: var(--pillar-text, #1a1a1a);
}

/* Headings */
._pillar-md-heading {
  margin: 16px 0 8px 0;
  font-weight: 600;
  line-height: 1.3;
}

._pillar-md-h1 { font-size: 1.5em; }
._pillar-md-h2 { font-size: 1.3em; }
._pillar-md-h3 { font-size: 1.15em; }
._pillar-md-h4 { font-size: 1em; }
._pillar-md-h5 { font-size: 0.95em; }
._pillar-md-h6 { font-size: 0.9em; }

/* Paragraphs */
._pillar-md-paragraph {
  margin: 8px 0;
}

/* Links */
._pillar-md-link {
  color: var(--pillar-primary, #2563eb);
  text-decoration: none;
}

._pillar-md-link:hover {
  text-decoration: underline;
}

/* Inline code */
._pillar-md-code-inline {
  padding: 2px 6px;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace;
  font-size: 0.9em;
  background: var(--pillar-bg-code-inline, #f3f4f6);
  border-radius: 4px;
}

/* Lists */
._pillar-md-list {
  margin: 8px 0;
  padding-left: 24px;
}

._pillar-md-list-item {
  margin: 4px 0;
}

/* Task list items */
._pillar-md-task-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  list-style: none;
  margin-left: -24px;
}

._pillar-md-task-checkbox {
  margin-top: 4px;
}

._pillar-md-task-text--checked {
  text-decoration: line-through;
  color: var(--pillar-text-placeholder, #9ca3af);
}

/* Blockquote */
._pillar-md-blockquote {
  margin: 8px 0;
  padding: 8px 16px;
  border-left: 3px solid var(--pillar-border, #e5e7eb);
  color: var(--pillar-text-muted, #6b7280);
  background: var(--pillar-bg-secondary, #f9fafb);
}

/* Horizontal rule */
._pillar-md-hr {
  margin: 16px 0;
  border: none;
  border-top: 1px solid var(--pillar-border, #e5e7eb);
}

/* Tables */
._pillar-md-table-wrapper {
  overflow-x: auto;
  margin: 8px 0;
}

._pillar-md-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

._pillar-md-th,
._pillar-md-td {
  padding: 8px 12px;
  border: 1px solid var(--pillar-border, #e5e7eb);
  text-align: left;
}

._pillar-md-th {
  background: var(--pillar-bg-secondary, #f9fafb);
  font-weight: 600;
}

/* Images */
._pillar-md-image {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  margin: 8px 0;
}
`;
