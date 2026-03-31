/**
 * Syntax Highlighting Utility
 *
 * Thin wrapper around highlight.js core with a curated set of languages
 * that LLMs commonly produce. Only the registered languages ship to the
 * client (~15-20KB gzipped total).
 */

import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';

hljs.registerLanguage('bash', bash);
hljs.registerLanguage('css', css);
hljs.registerLanguage('go', go);
hljs.registerLanguage('java', java);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('json', json);
hljs.registerLanguage('python', python);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('yaml', yaml);

// Common aliases LLMs use that map to registered languages
const ALIASES: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  jsx: 'javascript',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  html: 'xml',
  htm: 'xml',
  svg: 'xml',
  yml: 'yaml',
  jsonc: 'json',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  golang: 'go',
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Highlight code and return HTML with `<span class="hljs-*">` tokens.
 *
 * @param code - Raw source code text
 * @param language - Optional language hint (e.g., "python", "js")
 * @returns HTML string safe for innerHTML (highlight.js escapes the input)
 */
export function highlightCode(code: string, language?: string): string {
  try {
    const lang = language ? (ALIASES[language] || language) : undefined;

    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }

    const result = hljs.highlightAuto(code);
    return result.value;
  } catch {
    return escapeHtml(code);
  }
}
