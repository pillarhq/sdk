/**
 * Fixture: mix of tools - some with const refs, some inline, some missing.
 * Tests that pillar-sync correctly handles all three patterns in one file.
 */

const sharedSchema = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
  },
};

export function registerTools(pillar) {
  return [
    pillar.defineTool({
      name: 'mixed_const_tool',
      description: 'Uses a const ref',
      type: 'trigger_action',
      outputSchema: sharedSchema,
      execute: () => ({ ok: true }),
    }),
    pillar.defineTool({
      name: 'mixed_inline_tool',
      description: 'Uses inline schema',
      type: 'trigger_action',
      outputSchema: {
        type: 'object',
        properties: {
          value: { type: 'number' },
        },
      },
      execute: () => ({ value: 42 }),
    }),
    pillar.defineTool({
      name: 'mixed_missing_tool',
      description: 'Has no outputSchema',
      type: 'trigger_action',
      execute: () => ({ result: 'done' }),
    }),
  ];
}
