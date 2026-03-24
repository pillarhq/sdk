/**
 * Fixture: skill definitions for scanner test.
 */
import { defineSkill } from '@pillar-ai/sdk';

export const setupSkill = defineSkill({
  name: 'billing-setup',
  description: 'How to set up billing integration',
  content: '# Billing Setup\n\nFollow these steps...',
});

export const migrationSkill = defineSkill({
  name: 'migration-guide',
  description: 'Guide for migrating from v1 to v2',
  content: '# Migration Guide\n\n## Step 1...',
});
