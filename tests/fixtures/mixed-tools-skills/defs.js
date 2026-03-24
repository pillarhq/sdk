/**
 * Fixture: mixed tool and skill definitions.
 */
import { defineTool, defineSkill } from '@pillar-ai/sdk';

export const myTool = defineTool({
  name: 'open_settings',
  description: 'Navigate to settings',
  type: 'navigate',
  execute: () => {},
});

export const mySkill = defineSkill({
  name: 'onboarding-guide',
  description: 'New user onboarding steps',
  content: '# Onboarding\n\n1. Create account...',
});
