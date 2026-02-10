/**
 * Theme CSS Generation
 * Runtime functions for generating CSS variable overrides from theme config.
 */

import type { ResolvedThemeConfig, ThemeColors } from "../core/config";

/**
 * Generate CSS variable overrides from theme colors
 */
export function generateThemeVariables(
  colors: ThemeColors,
  prefix = ""
): string {
  const lines: string[] = [];

  if (colors.primary)
    lines.push(`--pillar-primary${prefix}: ${colors.primary};`);
  if (colors.primaryHover)
    lines.push(`--pillar-primary-hover${prefix}: ${colors.primaryHover};`);
  if (colors.background)
    lines.push(`--pillar-bg${prefix}: ${colors.background};`);
  if (colors.backgroundSecondary)
    lines.push(
      `--pillar-bg-secondary${prefix}: ${colors.backgroundSecondary};`
    );
  if (colors.text) lines.push(`--pillar-text${prefix}: ${colors.text};`);
  if (colors.textMuted)
    lines.push(`--pillar-text-muted${prefix}: ${colors.textMuted};`);
  if (colors.border) lines.push(`--pillar-border${prefix}: ${colors.border};`);
  if (colors.borderLight)
    lines.push(`--pillar-border-light${prefix}: ${colors.borderLight};`);

  return lines.join("\n    ");
}

/**
 * Generate custom theme CSS from config
 */
export function generateThemeCSS(theme: ResolvedThemeConfig): string {
  const lightOverrides = generateThemeVariables(theme.colors);
  const darkOverrides = generateThemeVariables(theme.darkColors);

  let css = "";

  // Light mode overrides
  if (lightOverrides) {
    css += `
:host {
    ${lightOverrides}
}
`;
  }

  // Dark mode overrides - apply when in dark mode (either manual or auto)
  if (darkOverrides) {
    css += `
@media (prefers-color-scheme: dark) {
  :host:not([data-theme="light"]) {
    ${darkOverrides}
  }
}
:host([data-theme="dark"]) {
    ${darkOverrides}
}
`;
  }

  return css;
}
