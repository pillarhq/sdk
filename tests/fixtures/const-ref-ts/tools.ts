/**
 * Fixture: TypeScript tools using const + as const for outputSchema.
 * Tests that pillar-sync handles TS-specific patterns like `as const`.
 */

const statusOutputSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', description: 'Whether the operation succeeded' },
    message: { type: 'string', description: 'Status message' },
  },
} as const;

const listOutputSchema = {
  type: 'object',
  properties: {
    count: { type: 'number' },
    items: {
      type: 'array',
      items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } },
    },
  },
} as const;

interface Pillar {
  defineTool(schema: Record<string, unknown>): unknown;
}

export function registerTools(pillar: Pillar) {
  return [
    pillar.defineTool({
      name: 'ts_tool_with_const_status',
      description: 'TS tool using const ref with as-const',
      type: 'trigger_action',
      outputSchema: statusOutputSchema,
      execute: () => ({ success: true, message: 'done' }),
    }),
    pillar.defineTool({
      name: 'ts_tool_with_const_list',
      description: 'TS tool using a list const ref',
      type: 'query',
      outputSchema: listOutputSchema,
      execute: () => ({ count: 0, items: [] }),
    }),
  ];
}
