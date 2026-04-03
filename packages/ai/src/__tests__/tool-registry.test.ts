import { describe, it, expect } from 'vitest';
import { ToolRegistry } from '../tools/tool-registry';
import { AgentTool, ToolContext } from '../tools/agent.tool';
import { z } from 'zod';

class ToolA extends AgentTool<z.ZodObject<{ msg: z.ZodString }>> {
  readonly name = 'tool_a';
  readonly description = 'Tool A for testing purpose only';
  readonly parameters = z.object({ msg: z.string() });
  async execute(args: { msg: string }, _context: ToolContext) { return 'A' + args.msg; }
}

describe('ToolRegistry', () => {
  it('should register and retrieve tools correctly', () => {
    const registry = new ToolRegistry();
    const toolA = new ToolA();
    registry.register(toolA);

    expect(registry.get('tool_a')).toBe(toolA);
    // 应该在 getAllRaw 中也能找到
    const allNames = registry.getAllRaw().map(t => t.name);
    expect(allNames).toContain('tool_a');
  });

  it('should generate a Vercel Tools map based on a session context', () => {
    const registry = new ToolRegistry();
    const toolA = new ToolA();
    registry.register(toolA);

    const mockCtx: ToolContext = { sessionId: 'test-session', vaultName: 'default' };
    const toolMap = registry.getEnabledToolsAsVercel(mockCtx);

    expect(toolMap).toHaveProperty('tool_a');
  });

  it('should return undefined for non-existent tool', () => {
    const registry = new ToolRegistry();
    expect(registry.get('nonexistent')).toBeUndefined();
  });
});
