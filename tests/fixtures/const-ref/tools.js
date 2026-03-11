/**
 * Fixture: tools that reference top-level const variables for outputSchema.
 * Used to test that pillar-sync resolves const identifiers during scanning.
 */

const messageOutputSchema = {
  type: 'object',
  properties: {
    message: { type: 'string', description: 'Status message' },
  },
};

const pathOutputSchema = {
  type: 'object',
  properties: {
    path: { type: 'string', description: 'URL path navigated to' },
  },
};

const richOutputSchema = {
  type: 'object',
  properties: {
    id: { type: 'number' },
    name: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          value: { type: 'number' },
        },
      },
    },
    count: { type: 'number' },
  },
};

export function registerTools(pillar) {
  return [
    pillar.defineTool({
      name: 'tool_with_const_message_schema',
      description: 'Tool using a const ref for outputSchema',
      type: 'trigger_action',
      outputSchema: messageOutputSchema,
      execute: () => ({ message: 'done' }),
    }),
    pillar.defineTool({
      name: 'tool_with_const_path_schema',
      description: 'Tool using a different const ref',
      type: 'navigate',
      outputSchema: pathOutputSchema,
      execute: () => ({ path: '/home' }),
    }),
    pillar.defineTool({
      name: 'tool_with_const_rich_schema',
      description: 'Tool using a complex const ref',
      type: 'query',
      outputSchema: richOutputSchema,
      execute: () => ({ id: 1, name: 'test', items: [], count: 0 }),
    }),
  ];
}
