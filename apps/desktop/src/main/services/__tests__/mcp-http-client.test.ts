// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { MCP_CLIENT_LIST_TOOLS_TIMEOUT_MESSAGE } from '@baishou/shared'
import { listMcpHttpTools, withMcpHttpTimeout } from '../mcp-http-client'

describe('withMcpHttpTimeout', () => {
  it('returns the value when the promise settles first', async () => {
    await expect(
      withMcpHttpTimeout(Promise.resolve('ok'), 50, MCP_CLIENT_LIST_TOOLS_TIMEOUT_MESSAGE)
    ).resolves.toBe('ok')
  })

  it('rejects with the timeout message when the promise never settles', async () => {
    await expect(
      withMcpHttpTimeout(
        new Promise<string>(() => undefined),
        20,
        MCP_CLIENT_LIST_TOOLS_TIMEOUT_MESSAGE
      )
    ).rejects.toThrow(MCP_CLIENT_LIST_TOOLS_TIMEOUT_MESSAGE)
  })
})

describe('listMcpHttpTools', () => {
  it('times out when tools/list never returns', async () => {
    const client = {
      listTools: () => new Promise(() => undefined)
    }
    await expect(listMcpHttpTools(client as never, 20)).rejects.toThrow(
      MCP_CLIENT_LIST_TOOLS_TIMEOUT_MESSAGE
    )
  })
})
