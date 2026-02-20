import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import alias from '@rollup/plugin-alias';
import { readFileSync } from 'fs';

const production = !process.env.ROLLUP_WATCH;
const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

/**
 * Injects the SDK version from package.json at build time.
 * Replaces the __SDK_VERSION__ placeholder in source code.
 */
function versionPlugin() {
  return {
    name: 'version-inject',
    transform(code) {
      if (code.includes('__SDK_VERSION__')) {
        return {
          code: code.replaceAll('__SDK_VERSION__', pkg.version),
          map: null,
        };
      }
    },
  };
}

/**
 * Raw CSS plugin - imports .css files as string constants.
 * This allows CSS to live in plain .css files while still being
 * inlined into the JS bundle for Shadow DOM / head injection.
 */
function rawCSSPlugin() {
  return {
    name: 'raw-css',
    transform(code, id) {
      if (id.endsWith('.css')) {
        return {
          code: `export default ${JSON.stringify(code)};`,
          map: null,
        };
      }
    },
  };
}

// Common plugins used across all builds
const getPlugins = (minify = false) => {
  const plugins = [
    versionPlugin(),
    rawCSSPlugin(),
    alias({
      entries: [
        { find: 'react', replacement: 'preact/compat' },
        { find: 'react-dom', replacement: 'preact/compat' },
      ],
    }),
    resolve({
      browser: true,
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
    }),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.json',
      declaration: false,
      declarationDir: undefined,
    }),
  ];

  if (minify) {
    plugins.push(terser());
  }

  return plugins;
};

export default [
  // UMD build (for script tags)
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/pillar.js',
      format: 'umd',
      name: 'Pillar',
      sourcemap: true,
      exports: 'named',
    },
    plugins: getPlugins(false),
  },
  // Minified UMD build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/pillar.min.js',
      format: 'umd',
      name: 'Pillar',
      sourcemap: true,
      exports: 'named',
    },
    plugins: getPlugins(true),
  },
  // ESM build (for bundlers) - minified for npm
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/pillar.esm.js',
      format: 'es',
      sourcemap: true,
    },
    plugins: getPlugins(true),
  },
];
