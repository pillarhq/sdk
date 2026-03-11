/**
 * Integration tests for pillar-sync const identifier resolution.
 *
 * Verifies that the AST scanner correctly resolves top-level `const`
 * declarations when they're referenced as outputSchema values in
 * defineTool / pillar.defineTool calls.
 *
 * Run: node --test packages/sdk/tests/sync-const-resolution.test.mjs
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SDK_ROOT = resolve(__dirname, '..');
const CLI_PATH = resolve(SDK_ROOT, 'dist/cli/sync.js');
const FIXTURES_DIR = resolve(__dirname, 'fixtures');

function runSync(scanDir, { relativeTo = FIXTURES_DIR } = {}) {
  const absDir = resolve(relativeTo, scanDir);
  try {
    const output = execFileSync('node', [CLI_PATH, '--scan', absDir], {
      cwd: SDK_ROOT,
      env: {
        ...process.env,
        PILLAR_SLUG: 'test',
        PILLAR_SECRET: 'test',
        PILLAR_API_URL: 'http://localhost:1', // unreachable — forces failure after scan
      },
      encoding: 'utf-8',
      timeout: 15_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout: output, stderr: '', exitCode: 0 };
  } catch (err) {
    return {
      stdout: err.stdout || '',
      stderr: err.stderr || '',
      exitCode: err.status ?? 1,
    };
  }
}

function parseToolNames(output) {
  const combined = output.stdout + '\n' + output.stderr;
  const matches = [...combined.matchAll(/\[pillar-sync\]\s{3}(\S+)\s/g)];
  return matches.map((m) => m[1]);
}

function countWarnings(output, pattern) {
  const combined = output.stdout + '\n' + output.stderr;
  const regex = new RegExp(pattern, 'g');
  return (combined.match(regex) || []).length;
}

function getFoundToolCount(output) {
  const combined = output.stdout + '\n' + output.stderr;
  const match = combined.match(/Found (\d+) tools/);
  return match ? parseInt(match[1], 10) : -1;
}

function hasNoOutputSchemaWarning(output, toolName) {
  const combined = output.stdout + '\n' + output.stderr;
  return combined.includes(`Tool "${toolName}" has execute but no outputSchema`);
}

// --------------------------------------------------------------------------

describe('pillar-sync const identifier resolution', () => {
  before(() => {
    assert.ok(
      existsSync(CLI_PATH),
      `CLI not built at ${CLI_PATH}. Run "npm run build" in packages/sdk first.`,
    );
  });

  // ========================================================================
  // 1. Const-referenced outputSchema (JS)
  // ========================================================================
  describe('JS const-referenced outputSchema', () => {
    let result;
    before(() => {
      result = runSync('const-ref');
    });

    it('finds all 3 tools', () => {
      assert.equal(getFoundToolCount(result), 3);
    });

    it('resolves const refs without outputSchema warnings', () => {
      assert.equal(
        countWarnings(result, 'has execute but no outputSchema'),
        0,
        'Expected zero outputSchema warnings for const-referenced tools',
      );
    });

    it('discovers each tool by name', () => {
      const names = parseToolNames(result);
      assert.ok(names.includes('tool_with_const_message_schema'));
      assert.ok(names.includes('tool_with_const_path_schema'));
      assert.ok(names.includes('tool_with_const_rich_schema'));
    });
  });

  // ========================================================================
  // 2. Inline outputSchema (baseline)
  // ========================================================================
  describe('inline outputSchema (baseline)', () => {
    let result;
    before(() => {
      result = runSync('inline');
    });

    it('finds 1 tool', () => {
      assert.equal(getFoundToolCount(result), 1);
    });

    it('produces no outputSchema warnings', () => {
      assert.equal(countWarnings(result, 'has execute but no outputSchema'), 0);
    });
  });

  // ========================================================================
  // 3. Missing outputSchema — should produce warnings
  // ========================================================================
  describe('missing outputSchema (expected warnings)', () => {
    let result;
    before(() => {
      result = runSync('no-schema');
    });

    it('finds 1 tool', () => {
      assert.equal(getFoundToolCount(result), 1);
    });

    it('emits a warning for the tool without outputSchema', () => {
      assert.ok(
        hasNoOutputSchemaWarning(result, 'tool_without_output_schema'),
        'Expected a warning for tool_without_output_schema',
      );
    });
  });

  // ========================================================================
  // 4. Mixed file — const ref, inline, and missing in one file
  // ========================================================================
  describe('mixed const/inline/missing in one file', () => {
    let result;
    before(() => {
      result = runSync('mixed');
    });

    it('finds all 3 tools', () => {
      assert.equal(getFoundToolCount(result), 3);
    });

    it('only warns about the tool that is actually missing outputSchema', () => {
      assert.ok(
        hasNoOutputSchemaWarning(result, 'mixed_missing_tool'),
        'Should warn about mixed_missing_tool',
      );
      assert.ok(
        !hasNoOutputSchemaWarning(result, 'mixed_const_tool'),
        'Should NOT warn about mixed_const_tool (has const ref)',
      );
      assert.ok(
        !hasNoOutputSchemaWarning(result, 'mixed_inline_tool'),
        'Should NOT warn about mixed_inline_tool (has inline schema)',
      );
    });

    it('emits exactly 1 warning total', () => {
      assert.equal(countWarnings(result, 'has execute but no outputSchema'), 1);
    });
  });

  // ========================================================================
  // 5. Multiple tools reusing the same const
  // ========================================================================
  describe('multiple tools reusing one const', () => {
    let result;
    before(() => {
      result = runSync('const-reuse');
    });

    it('finds all 3 tools', () => {
      assert.equal(getFoundToolCount(result), 3);
    });

    it('resolves the shared const for all tools — no warnings', () => {
      assert.equal(countWarnings(result, 'has execute but no outputSchema'), 0);
    });

    it('discovers each tool by name', () => {
      const names = parseToolNames(result);
      assert.ok(names.includes('reuse_tool_a'));
      assert.ok(names.includes('reuse_tool_b'));
      assert.ok(names.includes('reuse_tool_c'));
    });
  });

  // ========================================================================
  // 6. TypeScript with `as const` assertions
  // ========================================================================
  describe('TypeScript as-const outputSchema', () => {
    let result;
    before(() => {
      result = runSync('const-ref-ts');
    });

    it('finds both TS tools', () => {
      assert.equal(getFoundToolCount(result), 2);
    });

    it('resolves as-const schema refs without warnings', () => {
      assert.equal(countWarnings(result, 'has execute but no outputSchema'), 0);
    });

    it('discovers each tool by name', () => {
      const names = parseToolNames(result);
      assert.ok(names.includes('ts_tool_with_const_status'));
      assert.ok(names.includes('ts_tool_with_const_list'));
    });
  });

  // ========================================================================
  // 7. Grafana demo (real-world integration)
  // ========================================================================
  describe('Grafana demo (real-world)', () => {
    const grafanaDir = resolve(SDK_ROOT, '../../demos/grafana-copilot/src/tools');
    let result;

    before(function () {
      if (!existsSync(grafanaDir)) {
        this.skip();
        return;
      }
      result = runSync(grafanaDir, { relativeTo: '/' });
    });

    it('finds tools', () => {
      assert.ok(getFoundToolCount(result) > 0, 'Should find at least 1 tool in Grafana demo');
    });

    it('resolves all const outputSchema refs without warnings', () => {
      const warningCount = countWarnings(result, 'has execute but no outputSchema');
      assert.equal(
        warningCount,
        0,
        `Expected 0 outputSchema warnings in Grafana demo, got ${warningCount}`,
      );
    });
  });

  // ========================================================================
  // 8. Superset demo (real-world integration)
  // ========================================================================
  describe('Superset demo (real-world)', () => {
    const supersetDir = resolve(SDK_ROOT, '../../demos/superset-copilot/static/actions');
    let result;

    before(function () {
      if (!existsSync(supersetDir)) {
        this.skip();
        return;
      }
      result = runSync(supersetDir, { relativeTo: '/' });
    });

    it('finds tools', () => {
      assert.ok(getFoundToolCount(result) > 0, 'Should find at least 1 tool in Superset demo');
    });

    it('resolves all const outputSchema refs without warnings', () => {
      const warningCount = countWarnings(result, 'has execute but no outputSchema');
      assert.equal(
        warningCount,
        0,
        `Expected 0 outputSchema warnings in Superset demo, got ${warningCount}`,
      );
    });
  });
});
