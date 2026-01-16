#!/usr/bin/env npx tsx
/**
 * Pillar Action Sync CLI
 *
 * Syncs action definitions to the Pillar backend.
 * Run this in your CI/CD pipeline after building your app.
 *
 * Usage:
 *   npx pillar-sync --actions ./path/to/actions.ts
 *
 * Environment (required):
 *   PILLAR_SLUG - Your help center slug (e.g., "acme-corp")
 *   PILLAR_SECRET - Secret token for authentication
 *
 * Environment (optional):
 *   PILLAR_API_URL - Pillar API URL (defaults to https://api.trypillar.com)
 *   PILLAR_PLATFORM - Platform identifier (web, ios, android, desktop)
 *   PILLAR_VERSION - App version (semver or git SHA)
 *   GIT_SHA - Git commit SHA (optional, for traceability)
 */
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { pathToFileURL } from 'url';

// ============================================================================
// Types (inline to make CLI self-contained)
// ============================================================================

type ActionType =
  | 'navigate'
  | 'open_modal'
  | 'fill_form'
  | 'trigger_action'
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

interface SyncActionDefinition {
  description: string;
  examples?: string[];
  type: ActionType;
  path?: string;
  externalUrl?: string;
  dataSchema?: ActionDataSchema;
  defaultData?: Record<string, unknown>;
  requiredContext?: Record<string, unknown>;
  autoRun?: boolean;
  autoComplete?: boolean;
  returns?: boolean;
}

type SyncActionDefinitions = Record<string, SyncActionDefinition>;

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
}

interface ActionManifest {
  platform: Platform;
  version: string;
  gitSha?: string;
  generatedAt: string;
  actions: ActionManifestEntry[];
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
const DEFAULT_API_URL = 'https://api.trypillar.com';
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

Usage:
  npx pillar-sync --actions <path> [--local]

Arguments:
  --actions <path>   Path to your actions definition file (required)
                     Supports .ts, .js, .mjs files
  --local            Use localhost:8003 as the API URL (for local development)
  --help             Show this help message

Environment Variables:
  PILLAR_SLUG        Your help center slug (required)
  PILLAR_SECRET      Secret token for authentication (required)
  PILLAR_API_URL     API URL (default: https://api.trypillar.com)
  PILLAR_PLATFORM    Platform: web, ios, android, desktop (default: web)
  PILLAR_VERSION     App version (default: from package.json)
  GIT_SHA            Git commit SHA for traceability

Examples:
  # Production
  PILLAR_SLUG=my-app PILLAR_SECRET=xxx npx pillar-sync --actions ./lib/actions.ts

  # Local development
  PILLAR_SLUG=my-app PILLAR_SECRET=xxx npx pillar-sync --actions ./lib/actions.ts --local
`);
}

async function loadActions(actionsPath: string): Promise<SyncActionDefinitions> {
  const absolutePath = path.resolve(process.cwd(), actionsPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Actions file not found: ${absolutePath}`);
  }

  // Convert to file URL for ESM compatibility
  const fileUrl = pathToFileURL(absolutePath).href;

  try {
    const module = await import(fileUrl);

    // Support default export or named 'actions' export
    const actions = module.default || module.actions;

    if (!actions || typeof actions !== 'object') {
      throw new Error(
        'Actions file must export an actions object as default or named export "actions"'
      );
    }

    return actions;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unknown file extension')) {
      console.error('[pillar-sync] TypeScript files require tsx.');
      console.error('[pillar-sync] Make sure tsx is installed: npm install -D tsx');
      console.error('[pillar-sync] Then run: npx pillar-sync --actions ./actions.ts');
    }
    throw error;
  }
}

function buildManifest(
  actions: SyncActionDefinitions,
  platform: Platform,
  version: string,
  gitSha?: string
): ActionManifest {
  const entries: ActionManifestEntry[] = [];

  for (const [name, definition] of Object.entries(actions)) {
    const entry: ActionManifestEntry = {
      name,
      description: definition.description,
      type: definition.type,
    };

    // Only include optional fields if they have values
    if (definition.examples?.length) entry.examples = definition.examples;
    if (definition.path) entry.path = definition.path;
    if (definition.externalUrl) entry.external_url = definition.externalUrl;
    if (definition.autoRun) entry.auto_run = definition.autoRun;
    if (definition.autoComplete) entry.auto_complete = definition.autoComplete;
    if (definition.returns) entry.returns_data = definition.returns;
    if (definition.dataSchema) entry.data_schema = definition.dataSchema;
    if (definition.defaultData) entry.default_data = definition.defaultData;
    if (definition.requiredContext) entry.required_context = definition.requiredContext;

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

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // Show help
  if (args.help) {
    printUsage();
    process.exit(0);
  }

  // Validate --actions argument
  const actionsPath = args.actions as string | undefined;
  if (!actionsPath) {
    console.error('[pillar-sync] Missing required --actions argument');
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

  // Load actions from user's file
  console.log(`[pillar-sync] Loading actions from: ${actionsPath}`);
  let actions: SyncActionDefinitions;
  try {
    actions = await loadActions(actionsPath);
  } catch (error) {
    console.error(`[pillar-sync] Failed to load actions:`, error);
    process.exit(1);
  }

  const actionCount = Object.keys(actions).length;
  console.log(`[pillar-sync] Found ${actionCount} actions`);

  if (actionCount === 0) {
    console.warn('[pillar-sync] No actions found. Nothing to sync.');
    process.exit(0);
  }

  // Build configuration
  const platform = (process.env.PILLAR_PLATFORM || 'web') as Platform;
  const version = process.env.PILLAR_VERSION || getPackageVersion();
  const gitSha = process.env.GIT_SHA || getGitSha();

  console.log(`[pillar-sync] Platform: ${platform}`);
  console.log(`[pillar-sync] Version: ${version}`);
  console.log(`[pillar-sync] Git SHA: ${gitSha || 'not available'}`);

  // Generate manifest
  const manifest = buildManifest(actions, platform, version, gitSha);

  // Optionally write manifest to disk for debugging
  if (process.env.PILLAR_DEBUG) {
    const manifestPath = path.join(process.cwd(), 'actions-manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`[pillar-sync] Wrote manifest to ${manifestPath}`);
  }

  // Sync to backend
  console.log(`[pillar-sync] Help Center: ${slug}`);

  const requestBody = {
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
