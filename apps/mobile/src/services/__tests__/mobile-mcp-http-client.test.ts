import { describe, expect, it } from 'vitest'
import { MCP_CLIENT_LIST_TOOLS_TIMEOUT_MESSAGE } from '@baishou/shared'
import { listMcpHttpTools, withMcpHttpTimeout } from '../mobile-mcp-http-client'

describe('withMcpHttpTimeout', () => {
  it('should return the value when the promise settles first', async () => {
    await expect(
      withMcpHttpTimeout(Promise.resolve('ok'), 50, MCP_CLIENT_LIST_TOOLS_TIMEOUT_MESSAGE)
    ).resolves.toBe('ok')
  })

  it('should reject with the timeout message when the promise never settles', async () => {
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
  it('should time out when tools/list never returns', async () => {
    const client = {
      listTools: () => new Promise(() => undefined)
    }
    await expect(listMcpHttpTools(client as never, 20)).rejects.toThrow(
      MCP_CLIENT_LIST_TOOLS_TIMEOUT_MESSAGE
    )
  })
})
