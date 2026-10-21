import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'agent-mcp-context.ts'),
  'utf8'
)

describe('agent MCP auto approve', () => {
  it('should auto-approve MCP asks while keeping deny rules when the server opted in', () => {
    expect(src).toContain('mcpAutoApproveTools')
    expect(src).toContain('createAutoApproveAgentGate(agentGate)')
    expect(src).toContain('agentGate: effectiveAgentGate')
  })
})
