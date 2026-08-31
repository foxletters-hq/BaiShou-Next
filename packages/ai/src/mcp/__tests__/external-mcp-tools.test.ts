import { describe, expect, it, vi } from 'vitest'
import { buildExternalMcpVercelTools } from '../external-mcp-tools'
import type { ToolContext } from '../../tools/agent.tool'

describe('buildExternalMcpVercelTools', () => {
  it('wraps remote tools with prefixed ids and forwards calls', async () => {
    const callTool = vi.fn(async () => ({
      content: [{ type: 'text', text: 'pong' }]
    }))
    const tools = buildExternalMcpVercelTools({
      tools: [
        {
          serverId: 'alpha',
          serverName: 'Alpha',
          name: 'ping',
          description: 'Ping the remote server',
          inputSchema: {
            type: 'object',
            properties: { q: { type: 'string' } },
            required: ['q']
          }
        }
      ],
      callTool,
      context: {} as ToolContext
    })

    const id = Object.keys(tools)[0]!
    expect(id).toBe('mcp_alpha_ping')
    const vercelTool = tools[id] as { execute: (args: Record<string, unknown>) => Promise<string> }
    await expect(vercelTool.execute({ q: 'hi' })).resolves.toBe('pong')
    expect(callTool).toHaveBeenCalledWith('alpha', 'ping', { q: 'hi' })
  })
})
