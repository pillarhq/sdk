/**
 * MetricCard — KPI / key-metric inline renderer.
 *
 * Implements the CardRenderer interface so it can be registered as a
 * built-in card renderer for the `render_metric` tool.
 *
 * Renders 1-4 prominent metric tiles with optional trend indicators.
 * Designed for sidebar panels — compact, scannable, visually weighted.
 */

import type { CardCallbacks, ToolCardContext } from '../../core/events';

// ── Types ──────────────────────────────────────────────────────────────

interface MetricItem {
  label: string;
  value: number;
  format?: 'number' | 'currency' | 'percent';
  change?: number;
  change_label?: string;
  trend?: 'up' | 'down' | 'flat';
}

interface MetricParams {
  title?: string;
  metrics: MetricItem[];
}

// ── Helpers ────────────────────────────────────────────────────────────

function resolveColor(el: HTMLElement, varName: string, fallback: string): string {
  const val = getComputedStyle(el).getPropertyValue(varName).trim();
  return val || fallback;
}

function formatValue(value: number, format?: string): string {
  switch (format) {
    case 'currency':
      return '$' + value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    case 'percent':
      return value.toLocaleString(undefined, { maximumFractionDigits: 1 }) + '%';
    case 'number':
    default:
      return value.toLocaleString();
  }
}

function formatChange(change: number): string {
  const abs = Math.abs(change);
  const formatted = abs.toLocaleString(undefined, { maximumFractionDigits: 1 });
  if (change > 0) return '+' + formatted + '%';
  if (change < 0) return '−' + formatted + '%';
  return formatted + '%';
}

// ── Trend colors ───────────────────────────────────────────────────────

const TREND_COLORS: Record<string, [string, string]> = {
  up:   ['#16a34a', '#dcfce7'], // green-600, green-100
  down: ['#dc2626', '#fee2e2'], // red-600, red-100
  flat: ['#6b7280', '#f3f4f6'], // gray-500, gray-100
};

function trendColor(trend?: string): [string, string] {
  return TREND_COLORS[trend || 'flat'] || TREND_COLORS.flat;
}

// ── Main renderer ──────────────────────────────────────────────────────

export function renderMetric(
  container: HTMLElement,
  data: Record<string, unknown>,
  _callbacks: CardCallbacks,
  _context?: ToolCardContext,
): (() => void) | void {
  const params = data as unknown as MetricParams;
  if (!params.metrics?.length) {
    container.textContent = 'No metric data provided.';
    return;
  }

  const metrics = params.metrics.slice(0, 4);

  const wrapper = document.createElement('div');
  wrapper.className = 'pillar-metric-card';

  if (params.title) {
    const titleEl = document.createElement('div');
    titleEl.className = 'pillar-metric-card__title';
    titleEl.textContent = params.title;
    wrapper.appendChild(titleEl);
  }

  const grid = document.createElement('div');
  grid.className = 'pillar-metric-card__grid';
  if (metrics.length === 1) {
    grid.setAttribute('data-count', '1');
  } else {
    grid.setAttribute('data-count', String(metrics.length));
  }
  wrapper.appendChild(grid);

  const textColor = resolveColor(container, '--pillar-text', '#0f172a');

  for (const metric of metrics) {
    const item = document.createElement('div');
    item.className = 'pillar-metric-card__item';

    // Value
    const valueEl = document.createElement('div');
    valueEl.className = 'pillar-metric-card__value';
    valueEl.style.color = textColor;
    valueEl.textContent = formatValue(metric.value, metric.format);
    item.appendChild(valueEl);

    // Label
    const labelEl = document.createElement('div');
    labelEl.className = 'pillar-metric-card__label';
    labelEl.textContent = metric.label;
    item.appendChild(labelEl);

    // Trend + change
    if (metric.trend || metric.change != null) {
      const trendWrap = document.createElement('div');
      trendWrap.className = 'pillar-metric-card__trend';

      const trend = metric.trend || (metric.change != null ? (metric.change > 0 ? 'up' : metric.change < 0 ? 'down' : 'flat') : 'flat');
      const [fg, bg] = trendColor(trend);

      const pill = document.createElement('span');
      pill.className = 'pillar-metric-card__change';
      pill.style.color = fg;
      pill.style.backgroundColor = bg;

      if (metric.change != null) {
        pill.textContent = formatChange(metric.change);
      }

      trendWrap.appendChild(pill);

      if (metric.change_label) {
        const changeLabelEl = document.createElement('span');
        changeLabelEl.className = 'pillar-metric-card__change-label';
        changeLabelEl.textContent = metric.change_label;
        trendWrap.appendChild(changeLabelEl);
      }

      item.appendChild(trendWrap);
    }

    grid.appendChild(item);
  }

  container.appendChild(wrapper);

  return () => {
    container.innerHTML = '';
  };
}
