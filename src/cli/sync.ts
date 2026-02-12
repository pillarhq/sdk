/**
 * Pillar Action Sync CLI
 *
 * Scans for usePillarAction/defineAction calls and syncs to the Pillar backend.
 * Run this in your CI/CD pipeline after building your app.
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

type ActionType =
  | 'navigate'
  | 'open_modal'
  | 'fill_form'
  | 'trigger_action'
  | 'query'
  | 'copy_text'
  | 'external_link'
  | 'start_tutorial'
  | 'inline_ui';

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

interface ActionManifestEntry {
  name: string;
  description: string;
  examples?: string[];
  type: ActionType;
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

interface ActionManifest {
  platform: Platform;
  version: string;
  gitSha?: string;
  generatedAt: string;
  actions: ActionManifestEntry[];
  agentGuidance?: string;
}

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
Pillar Action Sync CLI

Scans for usePillarAction/defineAction calls and syncs to the Pillar backend.

Usage:
  npx pillar-sync --scan <dir> [--local]

Arguments:
  --scan <dir>       Directory to scan for usePillarAction/defineAction calls
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
  # Scan and sync actions
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
// Discovers defineAction / usePillarAction calls without a barrel file.
// Uses TypeScript's compiler API for parse-only AST extraction.
// ============================================================================

interface ScannedAction {
  name: string;
  description: string;
  type?: ActionType;
  inputSchema?: ActionDataSchema;
  examples?: string[];
  autoRun?: boolean;
  autoComplete?: boolean;
  sourceFile: string;
  line: number;
}

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
 * Scan a directory for defineAction / usePillarAction calls and extract metadata.
 */
async function scanActions(scanDir: string): Promise<ScannedAction[]> {
  const absoluteDir = path.resolve(process.cwd(), scanDir);

  if (!fs.existsSync(absoluteDir)) {
    throw new Error(`Scan directory not found: ${absoluteDir}`);
  }

  // Dynamically import TypeScript (available as devDependency)
  let ts: typeof import('typescript');
  try {
    ts = await import('typescript');
  } catch {
    console.error('[pillar-sync] TypeScript is required for --scan mode.');
    console.error('[pillar-sync] Install it: npm install -D typescript');
    process.exit(1);
  }

  // 1. Find all .ts and .tsx files
  const files = globFiles(absoluteDir, ['.ts', '.tsx']);
  console.log(`[pillar-sync] Scanning ${files.length} files in ${scanDir}`);

  // 2. Quick filter: only parse files that mention defineAction or usePillarAction
  const PATTERNS = ['defineAction', 'usePillarAction'];
  const candidateFiles = files.filter((file) => {
    const content = fs.readFileSync(file, 'utf-8');
    return PATTERNS.some((p) => content.includes(p));
  });

  console.log(`[pillar-sync] Found ${candidateFiles.length} files with action definitions`);

  // 3. Parse each candidate and extract action metadata
  const actions: ScannedAction[] = [];

  for (const filePath of candidateFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true, // setParentNodes
      filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );

    // Walk the AST looking for call expressions
    function visit(node: import('typescript').Node): void {
      if (ts.isCallExpression(node)) {
        const callee = node.expression;
        let isTargetCall = false;

        // Match: defineAction(...), usePillarAction(...)
        if (ts.isIdentifier(callee)) {
          isTargetCall = PATTERNS.includes(callee.text);
        }
        // Match: pillar.defineAction(...), something.defineAction(...)
        else if (ts.isPropertyAccessExpression(callee)) {
          isTargetCall = callee.name.text === 'defineAction';
        }

        if (isTargetCall && node.arguments.length > 0) {
          const arg = node.arguments[0];
          const lineNumber = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
          const relativePath = path.relative(process.cwd(), filePath);

          // Helper to process a single action object
          const processActionObject = (obj: Record<string, unknown> | undefined, line: number) => {
            if (obj && typeof obj.name === 'string' && typeof obj.description === 'string') {
              actions.push({
                name: obj.name as string,
                description: obj.description as string,
                type: obj.type as ActionType | undefined,
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
                `[pillar-sync] ⚠ Skipping action at ${relativePath}:${line} — missing name or description`
              );
            }
          };

          if (ts.isObjectLiteralExpression(arg)) {
            // Single action: usePillarAction({ name: '...', ... })
            const obj = evaluateNode(arg, ts) as Record<string, unknown> | undefined;
            processActionObject(obj, lineNumber);
          } else if (ts.isArrayLiteralExpression(arg)) {
            // Multiple actions: usePillarAction([{ name: '...', ... }, { name: '...', ... }])
            for (const element of arg.elements) {
              if (ts.isObjectLiteralExpression(element)) {
                const elementLine = sourceFile.getLineAndCharacterOfPosition(element.getStart()).line + 1;
                const obj = evaluateNode(element, ts) as Record<string, unknown> | undefined;
                processActionObject(obj, elementLine);
              } else {
                const elementLine = sourceFile.getLineAndCharacterOfPosition(element.getStart()).line + 1;
                console.warn(
                  `[pillar-sync] ⚠ Skipping action at ${relativePath}:${elementLine} — ` +
                  `array element is not an inline object literal`
                );
              }
            }
          } else {
            // Argument is a variable reference — can't resolve statically
            console.warn(
              `[pillar-sync] ⚠ Skipping action at ${relativePath}:${lineNumber} — ` +
              `argument is not an inline object literal or array (variable reference can't be resolved statically)`
            );
          }
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }

  return actions;
}

/**
 * Build a manifest from scanned ActionSchema definitions.
 * Similar to buildManifest but works with the scanned action shape.
 */
function buildManifestFromScan(
  actions: ScannedAction[],
  platform: Platform,
  version: string,
  gitSha?: string
): ActionManifest {
  const entries: ActionManifestEntry[] = [];

  for (const action of actions) {
    const entry: ActionManifestEntry = {
      name: action.name,
      description: action.description,
      type: action.type || 'trigger_action',
    };

    if (action.examples?.length) entry.examples = action.examples;
    if (action.autoRun) entry.auto_run = action.autoRun;
    if (action.autoComplete !== undefined) entry.auto_complete = action.autoComplete;
    // Unified actions always return data (the handler return value goes to the agent)
    entry.returns_data = true;
    if (action.inputSchema) entry.data_schema = action.inputSchema;

    entries.push(entry);
  }

  return {
    platform,
    version,
    gitSha,
    generatedAt: new Date().toISOString(),
    actions: entries,
  };
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

  // Scan for actions
  console.log(`[pillar-sync] Scanning for actions in: ${scanDir}`);
  let scannedActions: ScannedAction[];
  try {
    scannedActions = await scanActions(scanDir);
  } catch (error) {
    console.error(`[pillar-sync] Failed to scan actions:`, error);
    process.exit(1);
  }

  const actionCount = scannedActions.length;
  console.log(`[pillar-sync] Found ${actionCount} actions`);

  if (actionCount === 0) {
    console.warn('[pillar-sync] No actions found. Nothing to sync.');
    process.exit(0);
  }

  const manifest = buildManifestFromScan(scannedActions, platform, version, gitSha);

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
