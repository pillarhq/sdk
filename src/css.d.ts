/**
 * Type declaration for raw CSS imports.
 * The Rollup rawCSSPlugin transforms .css files into string exports.
 */
declare module '*.css' {
  const css: string;
  export default css;
}
