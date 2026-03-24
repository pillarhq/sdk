/**
 * Skill definitions for registering instructional content with Pillar.
 *
 * Skills are structured markdown instructions that AI agents can load
 * and follow. They are discovered by the CLI scanner (`npx pillar-sync`)
 * and synced to the backend, where they're exposed as MCP prompts and resources.
 *
 * @example
 * ```ts
 * import { defineSkill } from '@pillar-ai/sdk';
 *
 * export const setupSkill = defineSkill({
 *   name: 'setup-guide',
 *   description: 'How to set up billing in your app',
 *   content: '# Setup Guide\n\n1. Install the SDK...',
 * });
 * ```
 */

export interface SkillDefinition {
  /** Unique skill name (e.g. 'billing-setup') */
  name: string;
  /** When/why to use this skill — used for semantic search matching */
  description: string;
  /** Full skill content (markdown) */
  content: string;
}

/**
 * Define a skill for registration with Pillar.
 *
 * The CLI scanner (`npx pillar-sync --scan ./src`) discovers these calls
 * via AST analysis and syncs the skill definitions to the backend.
 */
export function defineSkill(def: SkillDefinition): SkillDefinition {
  if (!def.name) throw new Error("Skill requires a `name`.");
  if (!def.description) throw new Error("Skill requires a `description`.");
  if (!def.content) throw new Error("Skill requires `content`.");
  return def;
}
