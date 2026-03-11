/**
 * Fixture: multiple tools reusing the same const schema.
 * Verifies that a single const is resolved correctly for all references.
 */

const standardOutput = {
  type: 'object',
  properties: {
    message: { type: 'string' },
    timestamp: { type: 'string' },
  },
};

export function registerTools(pillar) {
  return [
    pillar.defineTool({
      name: 'reuse_tool_a',
      description: 'First tool reusing the schema',
      type: 'trigger_action',
      outputSchema: standardOutput,
      execute: () => ({ message: 'a', timestamp: new Date().toISOString() }),
    }),
    pillar.defineTool({
      name: 'reuse_tool_b',
      description: 'Second tool reusing the schema',
      type: 'trigger_action',
      outputSchema: standardOutput,
      execute: () => ({ message: 'b', timestamp: new Date().toISOString() }),
    }),
    pillar.defineTool({
      name: 'reuse_tool_c',
      description: 'Third tool reusing the schema',
      type: 'trigger_action',
      outputSchema: standardOutput,
      execute: () => ({ message: 'c', timestamp: new Date().toISOString() }),
    }),
  ];
}
