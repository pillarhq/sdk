import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import alias from '@rollup/plugin-alias';

const production = !process.env.ROLLUP_WATCH;

// Common plugins used across all builds
const getPlugins = (minify = false) => {
  const plugins = [
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
