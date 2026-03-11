/**
 * Fixture: tools that intentionally have no outputSchema.
 * Should produce warnings from pillar-sync.
 */

export function registerTools(pillar) {
  return [
    pillar.defineTool({
      name: 'tool_without_output_schema',
      description: 'Tool missing outputSchema',
      type: 'trigger_action',
      execute: () => ({ message: 'done' }),
    }),
  ];
}
