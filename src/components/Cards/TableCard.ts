/**
 * TableCard — Sortable data table inline renderer.
 *
 * Implements the CardRenderer interface so it can be registered as a
 * built-in card renderer for the `render_table` tool.
 *
 * Designed for narrow sidebar panels — uses horizontal scroll with
 * fade-mask overflow indicators, compact density, and smart wrapping.
 *
 * Supported column formats: text, number, currency, percent, date,
 * badge, link.
 */

import type { CardCallbacks, ToolCardContext } from '../../core/events';

// ── Types ──────────────────────────────────────────────────────────────

type ColumnFormat = 'text' | 'number' | 'currency' | 'percent' | 'date' | 'badge' | 'link';
type SortDir = 'asc' | 'desc' | null;

interface TableColumn {
  key: string;
  label: string;
  format?: ColumnFormat;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
}

interface TableParams {
  title?: string;
  columns: TableColumn[];
  rows: Record<string, unknown>[];
  caption?: string;
}

// ── Badge palette ──────────────────────────────────────────────────────
// Maps common status keywords to color pairs [bg, text].

const BADGE_COLORS: Record<string, [string, string]> = {
  active:    ['#dcfce7', '#166534'],
  success:   ['#dcfce7', '#166534'],
  completed: ['#dcfce7', '#166534'],
  paid:      ['#dcfce7', '#166534'],
  approved:  ['#dcfce7', '#166534'],
  enabled:   ['#dcfce7', '#166534'],
  yes:       ['#dcfce7', '#166534'],

  pending:   ['#fef9c3', '#854d0e'],
  warning:   ['#fef9c3', '#854d0e'],
  draft:     ['#fef9c3', '#854d0e'],
  review:    ['#fef9c3', '#854d0e'],

  error:     ['#fee2e2', '#991b1b'],
  failed:    ['#fee2e2', '#991b1b'],
  rejected:  ['#fee2e2', '#991b1b'],
  overdue:   ['#fee2e2', '#991b1b'],
  disabled:  ['#fee2e2', '#991b1b'],
  no:        ['#fee2e2', '#991b1b'],

  inactive:  ['#f1f5f9', '#475569'],
  cancelled: ['#f1f5f9', '#475569'],
  archived:  ['#f1f5f9', '#475569'],
};

const DEFAULT_BADGE: [string, string] = ['#e0e7ff', '#3730a3'];

function badgeColor(value: string): [string, string] {
  const key = value.toLowerCase().replace(/[\s_-]/g, '');
  for (const [k, v] of Object.entries(BADGE_COLORS)) {
    if (key === k || key.startsWith(k)) return v;
  }
  return DEFAULT_BADGE;
}

// ── Helpers ────────────────────────────────────────────────────────────

function resolveColor(el: HTMLElement, varName: string, fallback: string): string {
  const val = getComputedStyle(el).getPropertyValue(varName).trim();
  return val || fallback;
}

function formatCellValue(value: unknown, format: ColumnFormat): string | HTMLElement {
  if (value == null || value === '') return '—';

  switch (format) {
    case 'currency': {
      const num = typeof value === 'number' ? value : parseFloat(String(value));
      if (isNaN(num)) return String(value);
      return '$' + num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    case 'percent': {
      const num = typeof value === 'number' ? value : parseFloat(String(value));
      if (isNaN(num)) return String(value);
      return num.toLocaleString(undefined, { maximumFractionDigits: 1 }) + '%';
    }
    case 'number': {
      const num = typeof value === 'number' ? value : parseFloat(String(value));
      if (isNaN(num)) return String(value);
      return num.toLocaleString();
    }
    case 'date': {
      const d = new Date(value as string | number);
      if (isNaN(d.getTime())) return String(value);
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    }
    case 'badge': {
      const text = String(value);
      const [bg, fg] = badgeColor(text);
      const span = document.createElement('span');
      span.className = 'pillar-table-card__badge';
      span.style.backgroundColor = bg;
      span.style.color = fg;
      span.textContent = text;
      return span;
    }
    case 'link': {
      const a = document.createElement('a');
      if (typeof value === 'object' && value !== null && 'href' in value) {
        const linkObj = value as { text?: string; href: string };
        a.href = linkObj.href;
        a.textContent = linkObj.text || linkObj.href;
      } else {
        const url = String(value);
        a.href = url;
        a.textContent = url;
      }
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.className = 'pillar-table-card__link';
      return a;
    }
    default:
      return String(value);
  }
}

function defaultAlign(format: ColumnFormat | undefined): 'left' | 'center' | 'right' {
  switch (format) {
    case 'number':
    case 'currency':
    case 'percent':
      return 'right';
    case 'badge':
      return 'center';
    default:
      return 'left';
  }
}

function rawSortValue(value: unknown, format: ColumnFormat | undefined): string | number {
  if (value == null) return '';
  if (format === 'number' || format === 'currency' || format === 'percent') {
    const n = typeof value === 'number' ? value : parseFloat(String(value));
    return isNaN(n) ? String(value).toLowerCase() : n;
  }
  if (format === 'date') {
    const d = new Date(value as string | number);
    return isNaN(d.getTime()) ? String(value).toLowerCase() : d.getTime();
  }
  return String(value).toLowerCase();
}

// ── Sort arrow SVGs ────────────────────────────────────────────────────

function sortArrow(dir: SortDir, color: string, dimColor: string): HTMLElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '10');
  svg.setAttribute('height', '14');
  svg.setAttribute('viewBox', '0 0 10 14');
  svg.style.marginLeft = '3px';
  svg.style.verticalAlign = 'middle';
  svg.style.flexShrink = '0';

  const up = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  up.setAttribute('d', 'M5 0L9.33 5.25H0.67L5 0Z');
  up.setAttribute('fill', dir === 'asc' ? color : dimColor);

  const down = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  down.setAttribute('d', 'M5 14L0.67 8.75H9.33L5 14Z');
  down.setAttribute('fill', dir === 'desc' ? color : dimColor);

  svg.appendChild(up);
  svg.appendChild(down);
  return svg as unknown as HTMLElement;
}

// ── Overflow fade detection ────────────────────────────────────────────

function updateFadeMask(scrollEl: HTMLElement): void {
  const { scrollLeft, scrollWidth, clientWidth } = scrollEl;
  const atStart = scrollLeft <= 1;
  const atEnd = scrollLeft + clientWidth >= scrollWidth - 1;

  if (atStart && atEnd) {
    scrollEl.style.maskImage = 'none';
    scrollEl.style.webkitMaskImage = 'none';
  } else if (atStart) {
    scrollEl.style.maskImage = 'linear-gradient(to right, black calc(100% - 24px), transparent)';
    scrollEl.style.webkitMaskImage = scrollEl.style.maskImage;
  } else if (atEnd) {
    scrollEl.style.maskImage = 'linear-gradient(to left, black calc(100% - 24px), transparent)';
    scrollEl.style.webkitMaskImage = scrollEl.style.maskImage;
  } else {
    scrollEl.style.maskImage = 'linear-gradient(to right, transparent, black 24px, black calc(100% - 24px), transparent)';
    scrollEl.style.webkitMaskImage = scrollEl.style.maskImage;
  }
}

// ── Build tbody ────────────────────────────────────────────────────────

function buildTbody(
  rows: Record<string, unknown>[],
  columns: TableColumn[],
  borderColor: string,
): HTMLTableSectionElement {
  const tbody = document.createElement('tbody');
  for (const row of rows) {
    const tr = document.createElement('tr');
    tr.className = 'pillar-table-card__row';
    for (const col of columns) {
      const td = document.createElement('td');
      td.className = 'pillar-table-card__cell';
      const format = col.format || 'text';
      td.style.textAlign = col.align || defaultAlign(format);
      td.style.borderBottom = `1px solid ${borderColor}`;

      if (format === 'number' || format === 'currency' || format === 'percent' || format === 'badge') {
        td.style.whiteSpace = 'nowrap';
      }

      const formatted = formatCellValue(row[col.key], format);
      if (typeof formatted === 'string') {
        td.textContent = formatted;
      } else {
        td.appendChild(formatted);
      }
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  return tbody;
}

// ── Main renderer ──────────────────────────────────────────────────────

export function renderTable(
  container: HTMLElement,
  data: Record<string, unknown>,
  _callbacks: CardCallbacks,
  _context?: ToolCardContext,
): (() => void) | void {
  const params = data as unknown as TableParams;
  if (!params.columns?.length || !params.rows?.length) {
    container.textContent = 'No table data provided.';
    return;
  }

  const textColor = resolveColor(container, '--pillar-text', '#0f172a');
  const textSecondary = resolveColor(container, '--pillar-text-secondary', '#94a3b8');
  const borderColor = resolveColor(container, '--pillar-border', 'rgba(148,163,184,0.18)');
  const hoverBg = resolveColor(container, '--pillar-bg-secondary', '#f8fafc');

  const columns = params.columns;
  let rows = [...params.rows];
  let sortKey: string | null = null;
  let sortDir: SortDir = null;

  // ── Wrapper ──────────────────────────────────────────────────────
  const wrapper = document.createElement('div');
  wrapper.className = 'pillar-table-card';

  if (params.title) {
    const titleEl = document.createElement('div');
    titleEl.className = 'pillar-table-card__title';
    titleEl.textContent = params.title;
    wrapper.appendChild(titleEl);
  }

  // ── Scroll container ─────────────────────────────────────────────
  const scrollWrap = document.createElement('div');
  scrollWrap.className = 'pillar-table-card__scroll';
  wrapper.appendChild(scrollWrap);

  // ── Table ────────────────────────────────────────────────────────
  const table = document.createElement('table');
  table.className = 'pillar-table-card__table';
  scrollWrap.appendChild(table);

  // ── Header ───────────────────────────────────────────────────────
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');

  const headerCells: Map<string, HTMLTableCellElement> = new Map();

  for (const col of columns) {
    const th = document.createElement('th');
    th.className = 'pillar-table-card__header';
    const format = col.format || 'text';
    th.style.textAlign = col.align || defaultAlign(format);
    th.style.borderBottom = `2px solid ${borderColor}`;
    th.style.color = textSecondary;

    const isSortable = col.sortable !== false;
    if (isSortable) {
      th.style.cursor = 'pointer';
      th.style.userSelect = 'none';
    }

    const inner = document.createElement('span');
    inner.style.display = 'inline-flex';
    inner.style.alignItems = 'center';
    inner.textContent = col.label;
    th.appendChild(inner);

    if (isSortable) {
      inner.appendChild(sortArrow(null, textColor, borderColor));
    }

    if (isSortable) {
      th.addEventListener('click', () => {
        if (sortKey === col.key) {
          sortDir = sortDir === 'asc' ? 'desc' : sortDir === 'desc' ? null : 'asc';
        } else {
          sortKey = col.key;
          sortDir = 'asc';
        }

        if (sortDir === null) {
          rows = [...params.rows];
          sortKey = null;
        } else {
          const dir = sortDir === 'asc' ? 1 : -1;
          rows.sort((a, b) => {
            const av = rawSortValue(a[col.key], col.format);
            const bv = rawSortValue(b[col.key], col.format);
            if (av < bv) return -1 * dir;
            if (av > bv) return 1 * dir;
            return 0;
          });
        }

        // Update sort arrows on all headers
        for (const [key, cell] of headerCells) {
          const span = cell.querySelector('span');
          if (!span) continue;
          const existingArrow = span.querySelector('svg');
          if (existingArrow) existingArrow.remove();
          const thisCol = columns.find(c => c.key === key);
          if (thisCol?.sortable !== false) {
            const dir = key === sortKey ? sortDir : null;
            span.appendChild(sortArrow(dir, textColor, borderColor));
          }
        }

        // Re-render body
        const oldTbody = table.querySelector('tbody');
        if (oldTbody) oldTbody.remove();
        table.appendChild(buildTbody(rows, columns, borderColor));
      });
    }

    headerCells.set(col.key, th);
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // ── Body ─────────────────────────────────────────────────────────
  table.appendChild(buildTbody(rows, columns, borderColor));

  // ── Row hover ────────────────────────────────────────────────────
  table.addEventListener('mouseover', (e) => {
    const tr = (e.target as HTMLElement).closest?.('tr.pillar-table-card__row');
    if (tr) (tr as HTMLElement).style.backgroundColor = hoverBg;
  });
  table.addEventListener('mouseout', (e) => {
    const tr = (e.target as HTMLElement).closest?.('tr.pillar-table-card__row');
    if (tr) (tr as HTMLElement).style.backgroundColor = '';
  });

  // ── Caption ──────────────────────────────────────────────────────
  if (params.caption) {
    const caption = document.createElement('div');
    caption.className = 'pillar-table-card__caption';
    caption.textContent = params.caption;
    wrapper.appendChild(caption);
  }

  container.appendChild(wrapper);

  // ── Overflow fade masks ──────────────────────────────────────────
  const onScroll = () => updateFadeMask(scrollWrap);
  scrollWrap.addEventListener('scroll', onScroll, { passive: true });
  requestAnimationFrame(() => updateFadeMask(scrollWrap));

  const ro = new ResizeObserver(() => updateFadeMask(scrollWrap));
  ro.observe(scrollWrap);

  return () => {
    ro.disconnect();
    scrollWrap.removeEventListener('scroll', onScroll);
    container.innerHTML = '';
  };
}
