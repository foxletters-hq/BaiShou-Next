import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const actionSrc = readFileSync(join(here, '../AgentChatActionRunner.ts'), 'utf8')
const chatSrc = readFileSync(join(here, '../AgentChatService.ts'), 'utf8')
const hostSrc = readFileSync(join(here, '../companion-stream-host.ts'), 'utf8')

describe('companion stream host', () => {
  it('should build the same host for regenerate, edit and resend as for a normal send', () => {
    expect(actionSrc).toContain('streamHost: await buildCompanionStreamHost({ sessionId, systemModels })')
    expect(actionSrc.match(/await buildActionDeps\(event, sessionId, systemModels\)/g)).toHaveLength(3)
    expect(chatSrc).toContain('await buildCompanionStreamHost({')
    expect(chatSrc).toContain('...streamHost,')
  })

  it('should inject the life graph reader and memory source when building the host', () => {
    expect(hostSrc).toContain('graphReader: createDesktopGraphReader(embedQuery)')
    expect(hostSrc).toContain('rawDataSourceManager: getRawDataSourceManager()')
    expect(hostSrc).toContain('syncGraphPendingIndex,')
    expect(hostSrc).toContain('readSessionMountedNotebookIds(params.sessionId)')
  })

  it('should inject the life graph reader into external MCP calls', () => {
    const mcpSrc = readFileSync(join(here, '../agent-mcp-context.ts'), 'utf8')
    expect(mcpSrc).toContain('createDesktopGraphReader(')
  })
})
