/**
 * Pillar Tool Sync CLI
 *
 * Scans for usePillarTool/defineTool calls and syncs to the Pillar backend.
 * Run this in your CI/CD pipeline after building your app.
 *
 * Also supports legacy usePillarAction/defineAction calls for backwards compatibility.
 *
 * Usage:
 *   npx pillar-sync --scan ./src
 *
 * Environment (required):
 *   PILLAR_SLUG - Your help center slug (e.g., "acme-corp")
 *   PILLAR_SECRET - Secret token for authentication
 *
 * Environment (optional):
 *   PILLAR_API_URL - Pillar API URL (defaults to https://help-api.trypillar.com)
 *   PILLAR_PLATFORM - Platform identifier (web, ios, android, desktop)
 *   PILLAR_VERSION - App version (semver or git SHA)
 *   GIT_SHA - Git commit SHA (optional, for traceability)
 */
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// ============================================================================
// Types (inline to make CLI self-contained)
// ============================================================================

type ToolType =
  | 'navigate'
  | 'open_modal'
  | 'fill_form'
  | 'trigger_tool'
  | 'trigger_action' // Backwards compat alias
  | 'query'
  | 'copy_text'
  | 'external_link'
  | 'start_tutorial'
  | 'inline_ui';

// Backwards compat alias
type ActionType = ToolType;

type Platform = 'web' | 'ios' | 'android' | 'desktop';

interface ActionDataSchema {
  type: 'object';
  properties: Record<
    string,
    {
      type: 'string' | 'number' | 'boolean' | 'array' | 'object';
      description?: string;
      enum?: string[];
      default?: unknown;
    }
  >;
  required?: string[];
}

interface ToolManifestEntry {
  name: string;
  description: string;
  guidance?: string;
  examples?: string[];
  type: ToolType;
  path?: string;
  external_url?: string;
  auto_run?: boolean;
  auto_complete?: boolean;
  returns_data?: boolean;
  data_schema?: ActionDataSchema;
  default_data?: Record<string, unknown>;
  required_context?: Record<string, unknown>;
  parameter_examples?: Record<string, unknown>[];
}

// Backwards compat alias
type ActionManifestEntry = ToolManifestEntry;

interface ToolManifest {
  platform: Platform;
  version: string;
  gitSha?: string;
  generatedAt: string;
  /** Tool definitions (uses 'actions' key for backend API compat) */
  actions: ToolManifestEntry[];
  agentGuidance?: string;
}

// Backwards compat alias
type ActionManifest = ToolManifest;

interface SyncResponse {
  status: 'created' | 'unchanged' | 'accepted';
  deployment_id?: string;
  version: string;
  actions_count?: number;
  created?: number;
  updated?: number;
  deleted?: number;
  job_id?: string;
  status_url?: string;
}

interface StatusResponse {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  is_complete: boolean;
  progress: {
    total: number;
    processed: number;
    created: number;
    updated: number;
    deleted: number;
  };
  deployment_id?: string;
  error?: string;
}

// ============================================================================
// CLI Implementation
// ============================================================================

// Default API URL for production
const DEFAULT_API_URL = 'https://help-api.trypillar.com';
const LOCAL_API_URL = 'http://localhost:8003';

function parseArgs(args: string[]): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];

      if (nextArg && !nextArg.startsWith('--')) {
        result[key] = nextArg;
        i++;
      } else {
        result[key] = true;
      }
    }
  }

  return result;
}

function printUsage(): void {
  console.log(`
Pillar Tool Sync CLI

Scans for usePillarTool/defineTool calls and syncs to the Pillar backend.
Also supports legacy usePillarAction/defineAction calls.

Usage:
  npx pillar-sync --scan <dir> [--local]

Arguments:
  --scan <dir>       Directory to scan for usePillarTool/defineTool calls
  --local            Use localhost:8003 as the API URL (for local development)
  --help             Show this help message

Environment Variables:
  PILLAR_SLUG        Your help center slug (required)
  PILLAR_SECRET      Secret token for authentication (required)
  PILLAR_API_URL     API URL (default: https://help-api.trypillar.com)
  PILLAR_PLATFORM    Platform: web, ios, android, desktop (default: web)
  PILLAR_VERSION     App version (default: from package.json)
  GIT_SHA            Git commit SHA for traceability

Examples:
  # Scan and sync tools
  PILLAR_SLUG=my-app PILLAR_SECRET=xxx npx pillar-sync --scan ./src

  # Local development
  PILLAR_SLUG=my-app PILLAR_SECRET=xxx npx pillar-sync --scan ./src --local
`);
}

async function pollStatus(
  statusUrl: string,
  secret: string,
  maxWaitSeconds: number = 300
): Promise<void> {
  const startTime = Date.now();
  let lastProgress = { processed: 0, total: 0 };

  while (true) {
    try {
      const response = await fetch(statusUrl, {
        headers: {
          'X-Pillar-Secret': secret,
        },
      });

      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status} ${response.statusText}`);
      }

      const status: StatusResponse = await response.json();

      // Show progress updates
      if (
        status.progress &&
        (status.progress.processed !== lastProgress.processed ||
          status.progress.total !== lastProgress.total)
      ) {
        const { processed, total, created, updated, deleted } = status.progress;
        const percent = total > 0 ? Math.round((processed / total) * 100) : 0;
        console.log(
          `[pillar-sync] Progress: ${processed}/${total} (${percent}%) - ` +
            `Created: ${created}, Updated: ${updated}, Deleted: ${deleted}`
        );
        lastProgress = { processed, total };
      }

      // Check completion
      if (status.status === 'completed' && status.is_complete) {
        console.log(`[pillar-sync] ✓ Sync completed successfully`);
        if (status.deployment_id) {
          console.log(`[pillar-sync]   Deployment: ${status.deployment_id}`);
        }
        return;
      }

      if (status.status === 'failed') {
        throw new Error(status.error || 'Sync job failed');
      }

      // Check timeout
      const elapsed = (Date.now() - startTime) / 1000;
      if (elapsed > maxWaitSeconds) {
        throw new Error(`Timeout after ${maxWaitSeconds} seconds`);
      }

      // Wait before next poll
      await sleep(2000);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Timeout')) {
        throw error;
      }
      console.error(`[pillar-sync] Poll error: ${error}`);
      await sleep(2000);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getPackageVersion(): string {
  try {
    const pkgPath = path.join(process.cwd(), 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function getGitSha(): string | undefined {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim().slice(0, 7);
  } catch {
    return undefined;
  }
}

// ============================================================================
// AST-based Scanner (--scan mode)
// Discovers defineTool / usePillarTool calls without a barrel file.
// Also supports legacy defineAction / usePillarAction for backwards compat.
// Uses TypeScript's compiler API for parse-only AST extraction.
// ============================================================================

interface ScannedTool {
  name: string;
  description: string;
  guidance?: string;
  type?: ToolType;
  inputSchema?: ActionDataSchema;
  examples?: string[];
  autoRun?: boolean;
  autoComplete?: boolean;
  sourceFile: string;
  line: number;
}

// Backwards compat alias
type ScannedAction = ScannedTool;

/**
 * Recursively glob for .ts and .tsx files under a directory,
 * skipping node_modules and hidden directories.
 */
function globFiles(dir: string, extensions: string[]): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    // Skip node_modules, hidden dirs, and dist/build outputs
    if (
      entry.name.startsWith('.') ||
      entry.name === 'node_modules' ||
      entry.name === 'dist' ||
      entry.name === 'build' ||
      entry.name === '.next'
    ) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      results.push(...globFiles(fullPath, extensions));
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }

  return results;
}

/**
 * Evaluate a TypeScript AST node to a JavaScript value.
 * Handles string literals, numeric literals, booleans, arrays, objects,
 * template literals (without expressions), and `as const` assertions.
 * Returns undefined for anything it can't statically resolve.
 */
function evaluateNode(node: unknown, ts: typeof import('typescript')): unknown {
  const n = node as import('typescript').Node;

  // String literal
  if (ts.isStringLiteral(n)) {
    return (n as import('typescript').StringLiteral).text;
  }

  // No-substitution template literal (backtick string with no ${})
  if (ts.isNoSubstitutionTemplateLiteral(n)) {
    return (n as import('typescript').NoSubstitutionTemplateLiteral).text;
  }

  // Numeric literal
  if (ts.isNumericLiteral(n)) {
    return Number((n as import('typescript').NumericLiteral).text);
  }

  // Boolean / null / undefined keywords
  if (n.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (n.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (n.kind === ts.SyntaxKind.NullKeyword) return null;

  // Prefix unary expression (negative numbers like -1)
  if (ts.isPrefixUnaryExpression(n)) {
    const expr = n as import('typescript').PrefixUnaryExpression;
    if (expr.operator === ts.SyntaxKind.MinusToken) {
      const operand = evaluateNode(expr.operand, ts);
      if (typeof operand === 'number') return -operand;
    }
  }

  // Array literal
  if (ts.isArrayLiteralExpression(n)) {
    const arr = n as import('typescript').ArrayLiteralExpression;
    const result: unknown[] = [];
    for (const elem of arr.elements) {
      const val = evaluateNode(elem, ts);
      if (val === undefined) return undefined; // Can't resolve element
      result.push(val);
    }
    return result;
  }

  // Object literal
  if (ts.isObjectLiteralExpression(n)) {
    const obj = n as import('typescript').ObjectLiteralExpression;
    const result: Record<string, unknown> = {};
    for (const prop of obj.properties) {
      if (ts.isPropertyAssignment(prop)) {
        const key = prop.name
          ? ts.isIdentifier(prop.name)
            ? prop.name.text
            : ts.isStringLiteral(prop.name)
              ? prop.name.text
              : undefined
          : undefined;
        if (!key) continue;
        const val = evaluateNode(prop.initializer, ts);
        // Skip properties we can't resolve (like execute functions)
        if (val !== undefined) {
          result[key] = val;
        }
      }
      if (ts.isShorthandPropertyAssignment(prop)) {
        // Can't resolve shorthand (variable reference)
        continue;
      }
    }
    return result;
  }

  // Type assertion (e.g., 'navigate' as const, { ... } as const)
  if (ts.isAsExpression(n)) {
    return evaluateNode((n as import('typescript').AsExpression).expression, ts);
  }

  // Parenthesized expression
  if (ts.isParenthesizedExpression(n)) {
    return evaluateNode((n as import('typescript').ParenthesizedExpression).expression, ts);
  }

  // Binary expression for string concatenation (description: "foo " + "bar")
  if (ts.isBinaryExpression(n)) {
    const bin = n as import('typescript').BinaryExpression;
    if (bin.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const left = evaluateNode(bin.left, ts);
      const right = evaluateNode(bin.right, ts);
      if (typeof left === 'string' && typeof right === 'string') {
        return left + right;
      }
    }
  }

  // Can't resolve this node (function, variable reference, etc.)
  return undefined;
}

/**
 * Scan a directory for defineTool / usePillarTool calls and extract metadata.
 * Also supports legacy defineAction / usePillarAction for backwards compatibility.
 */
async function scanTools(scanDir: string): Promise<ScannedTool[]> {
  const absoluteDir = path.resolve(process.cwd(), scanDir);

  if (!fs.existsSync(absoluteDir)) {
    throw new Error(`Scan directory not found: ${absoluteDir}`);
  }

  // Dynamically import TypeScript (available as devDependency)
  let ts: typeof import('typescript');
  try {
    ts = await import('typescript');
  } catch {
    // Fallback: resolve TypeScript from the current working directory.
    // This handles cases where the CLI is symlinked (e.g. `file:` deps)
    // and Node's ESM resolution can't find typescript from the script's
    // real location.
    try {
      const { createRequire } = await import('module');
      const require = createRequire(path.join(process.cwd(), 'node_modules', '_placeholder.js'));
      ts = require('typescript');
    } catch {
      console.error('[pillar-sync] TypeScript is required for --scan mode.');
      console.error('[pillar-sync] Install it: npm install -D typescript');
      process.exit(1);
    }
  }

  // 1. Find all .ts, .tsx, .js, .jsx, and .mjs files
  const files = globFiles(absoluteDir, ['.ts', '.tsx', '.js', '.jsx', '.mjs']);
  console.log(`[pillar-sync] Scanning ${files.length} files in ${scanDir}`);

  // 2. Quick filter: only parse files that mention tool/action patterns
  // New patterns: defineTool, usePillarTool
  // Legacy patterns: defineAction, usePillarAction (for backwards compat)
  const PATTERNS = ['defineTool', 'usePillarTool', 'defineAction', 'usePillarAction'];
  const candidateFiles = files.filter((file) => {
    const content = fs.readFileSync(file, 'utf-8');
    return PATTERNS.some((p) => content.includes(p));
  });

  console.log(`[pillar-sync] Found ${candidateFiles.length} files with tool definitions`);

  // 3. Parse each candidate and extract tool metadata
  const tools: ScannedTool[] = [];

  for (const filePath of candidateFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true, // setParentNodes
      filePath.endsWith('.tsx') ? ts.ScriptKind.TSX
        : filePath.endsWith('.jsx') ? ts.ScriptKind.JSX
        : /\.m?js$/.test(filePath) ? ts.ScriptKind.JS
        : ts.ScriptKind.TS
    );

    // Walk the AST looking for call expressions
    function visit(node: import('typescript').Node): void {
      if (ts.isCallExpression(node)) {
        const callee = node.expression;
        let isTargetCall = false;

        // Match: defineTool(...), usePillarTool(...), defineAction(...), usePillarAction(...)
        if (ts.isIdentifier(callee)) {
          isTargetCall = PATTERNS.includes(callee.text);
        }
        // Match: pillar.defineTool(...), pillar.defineAction(...), etc.
        else if (ts.isPropertyAccessExpression(callee)) {
          isTargetCall = callee.name.text === 'defineTool' || callee.name.text === 'defineAction';
        }

        if (isTargetCall && node.arguments.length > 0) {
          const arg = node.arguments[0];
          const lineNumber = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
          const relativePath = path.relative(process.cwd(), filePath);

          // Helper to process a single tool object
          const processToolObject = (obj: Record<string, unknown> | undefined, line: number) => {
            if (obj && typeof obj.name === 'string' && typeof obj.description === 'string') {
              // Normalize type: trigger_action -> trigger_tool for backwards compat
              let toolType = obj.type as ToolType | undefined;
              if (toolType === 'trigger_action') {
                toolType = 'trigger_tool';
              }

              tools.push({
                name: obj.name as string,
                description: obj.description as string,
                guidance: typeof obj.guidance === 'string' ? obj.guidance : undefined,
                type: toolType,
                inputSchema: obj.inputSchema as ActionDataSchema | undefined,
                examples: obj.examples as string[] | undefined,
                autoRun: obj.autoRun as boolean | undefined,
                autoComplete: obj.autoComplete as boolean | undefined,
                sourceFile: relativePath,
                line,
              });

              console.log(`[pillar-sync]   ${obj.name} (${relativePath}:${line})`);
            } else if (obj) {
              console.warn(
                `[pillar-sync] ⚠ Skipping tool at ${relativePath}:${line} — missing name or description`
              );
            }
          };

          if (ts.isObjectLiteralExpression(arg)) {
            // Single tool: usePillarTool({ name: '...', ... })
            const obj = evaluateNode(arg, ts) as Record<string, unknown> | undefined;
            processToolObject(obj, lineNumber);
          } else if (ts.isArrayLiteralExpression(arg)) {
            // Multiple tools: usePillarTool([{ name: '...', ... }, { name: '...', ... }])
            for (const element of arg.elements) {
              if (ts.isObjectLiteralExpression(element)) {
                const elementLine = sourceFile.getLineAndCharacterOfPosition(element.getStart()).line + 1;
                const obj = evaluateNode(element, ts) as Record<string, unknown> | undefined;
                processToolObject(obj, elementLine);
              } else {
                const elementLine = sourceFile.getLineAndCharacterOfPosition(element.getStart()).line + 1;
                console.warn(
                  `[pillar-sync] ⚠ Skipping tool at ${relativePath}:${elementLine} — ` +
                  `array element is not an inline object literal`
                );
              }
            }
          } else {
            // Argument is a variable reference — can't resolve statically
            console.warn(
              `[pillar-sync] ⚠ Skipping tool at ${relativePath}:${lineNumber} — ` +
              `argument is not an inline object literal or array (variable reference can't be resolved statically)`
            );
          }
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }

  return tools;
}

// Backwards compat alias
const scanActions = scanTools;

/**
 * Look for AGENT_GUIDANCE.md inside the scan directory.
 * Returns the file content as a string, or undefined if not found.
 */
function findAgentGuidance(scanDir: string): string | undefined {
  const absoluteDir = path.resolve(process.cwd(), scanDir);
  const candidate = path.join(absoluteDir, 'AGENT_GUIDANCE.md');
  if (fs.existsSync(candidate)) {
    const content = fs.readFileSync(candidate, 'utf-8').trim();
    if (content) {
      console.log(
        `[pillar-sync] Found agent guidance: ${path.relative(process.cwd(), candidate)} (${content.length} chars)`
      );
      return content;
    }
  }
  return undefined;
}

/**
 * Normalize tool type for backend API compatibility.
 * The SDK uses 'trigger_tool' but the backend API still expects 'trigger_action'.
 */
function normalizeTypeForBackend(type: string | undefined): ToolType {
  // Map trigger_tool to trigger_action for backend compatibility
  if (type === 'trigger_tool') {
    return 'trigger_action' as ToolType;
  }
  return (type || 'trigger_action') as ToolType;
}

/**
 * Build a manifest from scanned ToolSchema definitions.
 * Similar to buildManifest but works with the scanned tool shape.
 */
function buildManifestFromScan(
  tools: ScannedTool[],
  platform: Platform,
  version: string,
  gitSha?: string,
  agentGuidance?: string,
): ToolManifest {
  const entries: ToolManifestEntry[] = [];

  for (const tool of tools) {
    const entry: ToolManifestEntry = {
      name: tool.name,
      description: tool.description,
      // Normalize trigger_tool → trigger_action for backend API compatibility
      type: normalizeTypeForBackend(tool.type),
    };

    if (tool.guidance) entry.guidance = tool.guidance;
    if (tool.examples?.length) entry.examples = tool.examples;
    if (tool.autoRun) entry.auto_run = tool.autoRun;
    if (tool.autoComplete !== undefined) entry.auto_complete = tool.autoComplete;
    // Unified tools always return data (the handler return value goes to the agent)
    entry.returns_data = true;
    if (tool.inputSchema) entry.data_schema = tool.inputSchema;

    entries.push(entry);
  }

  const manifest: ToolManifest = {
    platform,
    version,
    gitSha,
    generatedAt: new Date().toISOString(),
    actions: entries, // Keep 'actions' key for backend API compatibility
  };

  if (agentGuidance) {
    manifest.agentGuidance = agentGuidance;
  }

  return manifest;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // Show help
  if (args.help) {
    printUsage();
    process.exit(0);
  }

  // Validate arguments — need --scan
  const scanDir = args.scan as string | undefined;

  if (!scanDir) {
    console.error('[pillar-sync] Missing required argument: --scan <dir>');
    console.error('');
    printUsage();
    process.exit(1);
  }

  // Get configuration from environment
  const isLocal = args.local === true;
  const apiUrl = isLocal ? LOCAL_API_URL : (process.env.PILLAR_API_URL || DEFAULT_API_URL);
  const slug = process.env.PILLAR_SLUG;
  const secret = process.env.PILLAR_SECRET;

  if (isLocal) {
    console.log(`[pillar-sync] Using local API: ${LOCAL_API_URL}`);
  }

  if (!slug || !secret) {
    console.error('[pillar-sync] Missing required environment variables:');
    if (!slug) console.error('  - PILLAR_SLUG');
    if (!secret) console.error('  - PILLAR_SECRET');
    console.error('');
    console.error('Get these from the Pillar admin: Actions → Configure Sync');
    process.exit(1);
  }

  // Build configuration
  const platform = (process.env.PILLAR_PLATFORM || 'web') as Platform;
  const version = process.env.PILLAR_VERSION || getPackageVersion();
  const gitSha = process.env.GIT_SHA || getGitSha();

  // Scan for tools
  console.log(`[pillar-sync] Scanning for tools in: ${scanDir}`);
  let scannedTools: ScannedTool[];
  try {
    scannedTools = await scanTools(scanDir);
  } catch (error) {
    console.error(`[pillar-sync] Failed to scan tools:`, error);
    process.exit(1);
  }

  const toolCount = scannedTools.length;
  console.log(`[pillar-sync] Found ${toolCount} tools`);

  // Look for AGENT_GUIDANCE.md inside the scan directory
  const agentGuidance = findAgentGuidance(scanDir);

  if (toolCount === 0) {
    console.warn('[pillar-sync] No tools found. Nothing to sync.');
    process.exit(0);
  }

  const manifest = buildManifestFromScan(scannedTools, platform, version, gitSha, agentGuidance);

  console.log(`[pillar-sync] Platform: ${platform}`);
  console.log(`[pillar-sync] Version: ${version}`);
  console.log(`[pillar-sync] Git SHA: ${gitSha || 'not available'}`);

  // Optionally write manifest to disk for debugging
  if (process.env.PILLAR_DEBUG) {
    const manifestPath = path.join(process.cwd(), 'actions-manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`[pillar-sync] Wrote manifest to ${manifestPath}`);
  }

  // Sync to backend
  console.log(`[pillar-sync] Help Center: ${slug}`);

  const requestBody: Record<string, unknown> = {
    platform: manifest.platform,
    version: manifest.version,
    git_sha: gitSha,
    actions: manifest.actions,
  };

  if (manifest.agentGuidance) {
    requestBody.agent_guidance = manifest.agentGuidance;
  }

  const syncUrl = `${apiUrl}/api/admin/configs/${slug}/actions/sync/?async=true`;
  console.log(`[pillar-sync] POST ${syncUrl}`);

  try {
    const response = await fetch(syncUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Pillar-Secret': secret,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[pillar-sync] Sync failed: ${response.status} ${response.statusText}`);
      console.error(`[pillar-sync] Response: ${errorText}`);
      process.exit(1);
    }

    const result: SyncResponse = await response.json();

    if (result.status === 'unchanged') {
      console.log(`[pillar-sync] ✓ Manifest unchanged (deployment ${result.deployment_id})`);
      return;
    }

    if (result.status === 'accepted' && result.job_id && result.status_url) {
      console.log(`[pillar-sync] ✓ Job accepted (job ${result.job_id})`);
      console.log(`[pillar-sync] Polling for completion...`);

      const statusUrl = result.status_url.startsWith('http')
        ? result.status_url
        : `${apiUrl}${result.status_url}`;

      await pollStatus(statusUrl, secret);
      return;
    }

    if (result.status === 'created') {
      console.log(`[pillar-sync] ✓ Created deployment ${result.deployment_id}`);
      console.log(`[pillar-sync]   Actions: ${result.actions_count}`);
      console.log(
        `[pillar-sync]   Created: ${result.created}, Updated: ${result.updated}, Deleted: ${result.deleted || 0}`
      );
    }
  } catch (error) {
    console.error('[pillar-sync] Sync failed:', error);
    process.exit(1);
  }
}

main();
