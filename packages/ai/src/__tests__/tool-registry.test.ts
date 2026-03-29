import { describe, it, expect } from 'vitest';
import { AgentToolRegistry } from '../tools/tool-registry';
import { AgentTool, ToolContext } from '../tools/agent.tool';
import { z } from 'zod';

class ToolA extends AgentTool<z.ZodObject<{ msg: z.ZodString }>> {
  readonly name = 'tool_a';
  readonly description = 'Tool A';
  readonly parameters = z.object({ msg: z.string() });
  async execute(args: { msg: string }, _context: ToolContext) { return 'A' + args.msg; }
}

describe('AgentToolRegistry', () => {
  it('should register and retrieve tools correctly', () => {
    const registry = new AgentToolRegistry();
    const toolA = new ToolA();
    registry.register(toolA);

    expect(registry.hasTool('tool_a')).toBe(true);
    expect(registry.getTool('tool_a')).toBe(toolA);
  });

  it('should throw an error on duplicate tool names', () => {
    const registry = new AgentToolRegistry();
    const toolA = new ToolA();
    registry.register(toolA);
    expect(() => registry.register(new ToolA())).toThrowError(/already registered/);
  });

  it('should generate a Vercel Tools map based on a session context', () => {
    const registry = new AgentToolRegistry();
    const toolA = new ToolA();
    registry.register(toolA);

    const mockCtx: ToolContext = { sessionId: 'test-session', vaultName: 'default' };
    const toolMap = registry.toVercelTools(mockCtx);

    expect(toolMap).toHaveProperty('tool_a');
  });
});
