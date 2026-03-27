/**
 * ChartCard — Chart.js-powered inline chart renderer.
 *
 * Implements the CardRenderer interface so it can be registered as a
 * built-in card renderer for the `render_chart` tool.
 *
 * Uses Chart.js with tree-shaking — only the chart types and components
 * needed for the supported types are registered.
 *
 * Supported chart types: bar, line, pie, donut, scatter, area,
 * horizontal_bar, stacked_bar, radar.
 */

import type { CardCallbacks, ToolCardContext } from '../../core/events';

import {
  Chart,
  BarController,
  LineController,
  PieController,
  DoughnutController,
  ScatterController,
  RadarController,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  Filler,
  Legend,
  Tooltip,
  Title,
} from 'chart.js';

Chart.register(
  BarController,
  LineController,
  PieController,
  DoughnutController,
  ScatterController,
  RadarController,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  Filler,
  Legend,
  Tooltip,
  Title,
);

// ── Types ──────────────────────────────────────────────────────────────

interface ChartDataset {
  label?: string;
  values: number[];
}

interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

interface ChartParams {
  chart_type: string;
  title?: string;
  data: ChartData;
}

// ── Palette ────────────────────────────────────────────────────────────
// Curated set — saturated enough to read at small sizes, harmonious when
// multiple series sit side-by-side. Each entry is [solid, faded-for-fill].

const PALETTE: [string, string][] = [
  ['#6366f1', '#6366f120'], // indigo
  ['#06b6d4', '#06b6d420'], // cyan
  ['#f59e0b', '#f59e0b20'], // amber
  ['#ec4899', '#ec489920'], // pink
  ['#10b981', '#10b98120'], // emerald
  ['#f97316', '#f9731620'], // orange
  ['#8b5cf6', '#8b5cf620'], // violet
  ['#14b8a6', '#14b8a620'], // teal
];

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function solidAt(i: number): string {
  return PALETTE[i % PALETTE.length][0];
}

function fadedAt(i: number): string {
  return PALETTE[i % PALETTE.length][1];
}

function solidAlpha(i: number, alpha: number): string {
  return hexToRgba(PALETTE[i % PALETTE.length][0], alpha);
}

// ── Gradient helper ────────────────────────────────────────────────────
// Creates a vertical gradient from solid top → transparent bottom.
// Used for area fills to give that Linear/Vercel look.

function createVerticalGradient(
  ctx: CanvasRenderingContext2D,
  chartArea: { top: number; bottom: number },
  hex: string,
  topAlpha = 0.25,
  bottomAlpha = 0.02,
): CanvasGradient {
  const grad = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  grad.addColorStop(0, hexToRgba(hex, topAlpha));
  grad.addColorStop(1, hexToRgba(hex, bottomAlpha));
  return grad;
}

// ── Helpers ────────────────────────────────────────────────────────────

const FONT_STACK = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

function resolveColor(el: HTMLElement, varName: string, fallback: string): string {
  const val = getComputedStyle(el).getPropertyValue(varName).trim();
  return val || fallback;
}

function buildChartConfig(params: ChartParams, container: HTMLElement): any {
  const textColor = resolveColor(container, '--pillar-text-secondary', '#94a3b8');
  const gridColor = resolveColor(container, '--pillar-border', 'rgba(148,163,184,0.12)');
  const bgColor = resolveColor(container, '--pillar-bg', '#ffffff');
  const cardBg = resolveColor(container, '--pillar-bg-secondary', '#f8fafc');
  const { chart_type, data } = params;

  const isPie = chart_type === 'pie' || chart_type === 'donut';

  const datasets = data.datasets.map((ds, i) => {
    const base: any = {
      label: ds.label || `Series ${i + 1}`,
      data: ds.values,
    };

    if (isPie) {
      base.backgroundColor = data.labels.map((_, j) => solidAt(j));
      base.hoverBackgroundColor = data.labels.map((_, j) => solidAlpha(j, 0.85));
      base.borderWidth = 2.5;
      base.borderColor = cardBg;
      base.hoverBorderColor = bgColor;
      base.hoverOffset = 4;
    } else if (chart_type === 'scatter') {
      base.backgroundColor = solidAlpha(i, 0.55);
      base.borderColor = solidAt(i);
      base.borderWidth = 1.5;
      base.pointRadius = 5;
      base.pointHoverRadius = 7;
      base.pointHoverBorderWidth = 2;
      base.pointHoverBackgroundColor = solidAlpha(i, 0.75);
    } else if (chart_type === 'area') {
      base.borderColor = solidAt(i);
      base.borderWidth = 2;
      base.fill = true;
      base.backgroundColor = fadedAt(i);
      base.tension = 0.4;
      base.pointRadius = 0;
      base.pointHoverRadius = 5;
      base.pointHoverBackgroundColor = bgColor;
      base.pointHoverBorderColor = solidAt(i);
      base.pointHoverBorderWidth = 2;
    } else if (chart_type === 'radar') {
      base.backgroundColor = solidAlpha(i, 0.1);
      base.borderColor = solidAt(i);
      base.borderWidth = 2;
      base.pointBackgroundColor = bgColor;
      base.pointBorderColor = solidAt(i);
      base.pointBorderWidth = 2;
      base.pointRadius = 3;
      base.pointHoverRadius = 5;
      base.pointHoverBackgroundColor = solidAt(i);
    } else if (chart_type === 'line') {
      base.borderColor = solidAt(i);
      base.borderWidth = 2;
      base.tension = 0.35;
      base.pointRadius = 0;
      base.pointHoverRadius = 5;
      base.pointHoverBackgroundColor = bgColor;
      base.pointHoverBorderColor = solidAt(i);
      base.pointHoverBorderWidth = 2;
      base.fill = false;
    } else {
      base.backgroundColor = solidAt(i);
      base.hoverBackgroundColor = solidAlpha(i, 0.8);
      base.borderRadius = 4;
      base.borderSkipped = false;
      base.maxBarThickness = 48;
    }

    return base;
  });

  if (chart_type === 'scatter') {
    for (const ds of datasets) {
      ds.data = (ds.data as number[]).map((v: number, idx: number) => ({
        x: idx,
        y: v,
      }));
    }
  }

  let chartType: string;
  switch (chart_type) {
    case 'donut':
      chartType = 'doughnut';
      break;
    case 'area':
      chartType = 'line';
      break;
    case 'horizontal_bar':
    case 'stacked_bar':
      chartType = 'bar';
      break;
    default:
      chartType = chart_type;
  }

  const config: any = {
    type: chartType,
    data: {
      labels: data.labels,
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: { top: 4, right: 4, bottom: 0, left: 0 },
      },
      animation: {
        duration: 600,
        easing: 'easeOutQuart' as const,
      },
      interaction: {
        mode: isPie ? 'nearest' as const : 'index' as const,
        intersect: isPie,
      },
      plugins: {
        title: { display: false },
        legend: {
          display: isPie || chart_type === 'radar' || data.datasets.length > 1,
          position: 'bottom' as const,
          labels: {
            color: textColor,
            font: { size: 11, family: FONT_STACK, weight: '500' as const },
            boxWidth: 8,
            boxHeight: 8,
            padding: 14,
            usePointStyle: true,
            pointStyle: 'circle',
          },
        },
        tooltip: {
          enabled: true,
          backgroundColor: bgColor,
          titleColor: resolveColor(container, '--pillar-text', '#0f172a'),
          bodyColor: textColor,
          borderColor: gridColor,
          borderWidth: 1,
          cornerRadius: 8,
          padding: { top: 8, right: 12, bottom: 8, left: 12 },
          titleFont: { size: 12, weight: '600' as const, family: FONT_STACK },
          bodyFont: { size: 11, family: FONT_STACK },
          titleMarginBottom: 4,
          bodySpacing: 4,
          displayColors: true,
          boxWidth: 8,
          boxHeight: 8,
          boxPadding: 6,
          usePointStyle: true,
          caretSize: 0,
          callbacks: {
            labelColor: (ctx: any) => ({
              borderColor: 'transparent',
              backgroundColor: ctx.dataset.borderColor || ctx.dataset.backgroundColor,
              borderWidth: 0,
              borderRadius: 4,
            }),
          },
        },
      },
    },
  };

  // ── Scale presets ──────────────────────────────────────────────────

  const axisBase = (opts: any = {}) => ({
    border: { display: false },
    grid: {
      color: gridColor,
      drawTicks: false,
      lineWidth: 1,
      ...opts.grid,
    },
    ticks: {
      color: textColor,
      font: { size: 11, family: FONT_STACK },
      padding: 8,
      ...opts.ticks,
    },
    ...opts.extra,
  });

  if (chart_type === 'horizontal_bar') {
    config.options.indexAxis = 'y';
    config.options.scales = {
      x: axisBase({ extra: { beginAtZero: true } }),
      y: axisBase({ grid: { display: false } }),
    };
  } else if (chart_type === 'stacked_bar') {
    config.options.scales = {
      x: axisBase({
        extra: { stacked: true },
        ticks: { maxRotation: 45 },
      }),
      y: axisBase({
        extra: { stacked: true, beginAtZero: true },
      }),
    };
  } else if (chart_type === 'radar') {
    config.options.scales = {
      r: {
        angleLines: { color: gridColor },
        grid: { color: gridColor },
        pointLabels: {
          color: textColor,
          font: { size: 11, family: FONT_STACK },
        },
        ticks: {
          color: textColor,
          backdropColor: 'transparent',
          font: { size: 9, family: FONT_STACK },
          stepSize: undefined,
        },
        beginAtZero: true,
      },
    };
  } else if (!isPie) {
    config.options.scales = {
      x: axisBase({
        grid: { display: false },
        ticks: { maxRotation: 45 },
      }),
      y: axisBase({ extra: { beginAtZero: true } }),
    };
  }

  if (chart_type === 'donut') {
    config.options.cutout = '65%';
  }

  if (isPie) {
    config.options.plugins.legend.labels.generateLabels = (chart: any) => {
      const ds = chart.data.datasets[0];
      return chart.data.labels.map((label: string, i: number) => ({
        text: label,
        fillStyle: ds.backgroundColor[i],
        strokeStyle: 'transparent',
        lineWidth: 0,
        hidden: false,
        index: i,
        pointStyle: 'circle',
      }));
    };
  }

  // ── Gradient fill plugin (area charts) ─────────────────────────────
  // Replaces the flat fill with a fading vertical gradient once the chart
  // area is known. Applied after the initial layout pass.

  if (chart_type === 'area') {
    config.plugins = [
      {
        id: 'gradientFill',
        beforeDraw(chart: any) {
          const { ctx, chartArea } = chart;
          if (!chartArea) return;
          chart.data.datasets.forEach((ds: any, i: number) => {
            const meta = chart.getDatasetMeta(i);
            if (meta.hidden) return;
            ds.backgroundColor = createVerticalGradient(
              ctx,
              chartArea,
              PALETTE[i % PALETTE.length][0],
            );
          });
        },
      },
    ];
  }

  return config;
}

// ── Main renderer ──────────────────────────────────────────────────────

export function renderChart(
  container: HTMLElement,
  data: Record<string, unknown>,
  _callbacks: CardCallbacks,
  _context?: ToolCardContext,
): (() => void) | void {
  const params = data as unknown as ChartParams;
  if (!params.data?.datasets?.length || !params.data?.labels?.length) {
    container.textContent = 'No chart data provided.';
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'pillar-chart-card';

  if (params.title) {
    const titleEl = document.createElement('div');
    titleEl.className = 'pillar-chart-card__title';
    titleEl.textContent = params.title;
    wrapper.appendChild(titleEl);
  }

  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'pillar-chart-card__canvas-wrap';
  wrapper.appendChild(canvasWrap);

  const canvas = document.createElement('canvas');
  canvasWrap.appendChild(canvas);

  container.appendChild(wrapper);

  const config = buildChartConfig(params, container);
  const chart = new Chart(canvas, config);

  return () => {
    chart.destroy();
    container.innerHTML = '';
  };
}
