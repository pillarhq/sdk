/**
 * Fixture: tools with inline outputSchema (should always work).
 * Baseline to verify scanning still works for inline literals.
 */

export function registerTools(pillar) {
  return [
    pillar.defineTool({
      name: 'tool_with_inline_schema',
      description: 'Tool with outputSchema defined inline',
      type: 'trigger_action',
      outputSchema: {
        type: 'object',
        properties: {
          result: { type: 'string' },
        },
      },
      execute: () => ({ result: 'ok' }),
    }),
  ];
}
