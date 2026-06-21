// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { z } from 'zod'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { ToolSchema } from '@modelcontextprotocol/sdk/types.js'
import { ToolRegistry, buildBaishouMcpToolSchemas, executeBaishouMcpTool } from '@baishou/ai'
import { McpService } from '../mcp.service'

describe.sequential('McpService', () => {
  let mockSettingsRepo: any
  let service: McpService
  let testPort: number

  beforeEach(() => {
    testPort = 35700 + Math.floor(Math.random() * 1000)
    mockSettingsRepo = {
      getMcpServerConfig: vi.fn().mockResolvedValue({
        mcpPort: testPort,
        mcpEnabled: true
      })
    }
    const emptyRegistry = {
      getEnabledToolsRaw: () => [],
      get: () => undefined,
      isToolEnabled: () => false
    } as unknown as ToolRegistry
    service = new McpService(mockSettingsRepo, emptyRegistry, async () => ({
      sessionId: 'mcp-external',
      vaultName: 'Personal',
      userConfig: {}
    }))
  })

  afterEach(async () => {
    // 强制清理产生的 HTTP 监听以保证后面测试不报 Port In Use
    await service.stop()
  })

  it('should initialize with isRunning = false', () => {
    expect((service as any).isRunning).toBe(false)
    expect((service as any).httpServer).toBeNull()
  })

  it('should start HTTP server successfully', async () => {
    await service.start()
    expect((service as any).isRunning).toBe(true)
    expect((service as any).httpServer).toBeDefined()

    // 多次启动不应抛异常
    await service.start()
    expect((service as any).isRunning).toBe(true)
  })

  it('should stop HTTP server strictly', async () => {
    await service.start()
    await service.stop()
    expect((service as any).isRunning).toBe(false)
    expect((service as any).httpServer).toBeNull()
  })

  it('should restart seamlessly', async () => {
    await service.start()
    await service.restart()
    expect((service as any).isRunning).toBe(true)
    expect((service as any).httpServer).toBeDefined()
  })

  it('handles Streamable HTTP initialize and tools/list on /mcp', async () => {
    await service.start()
    const server = (service as any).httpServer as import('http').Server | null
    expect(server).toBeTruthy()

    await vi.waitFor(
      () => {
        expect(server!.listening).toBe(true)
        expect(server!.address()).toBeTruthy()
      },
      { timeout: 10_000, interval: 50 }
    )

    const bound = server!.address()
    const port = typeof bound === 'object' && bound ? bound.port : testPort
    const base = `http://127.0.0.1:${port}/mcp`
    const mcpHeaders = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream'
    }

    const initBody = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0.0' }
      }
    }

    const fetchWithRetry = async (
      url: string,
      init: RequestInit,
      attempts = 50
    ): Promise<Response> => {
      let lastError: unknown
      for (let i = 0; i < attempts; i++) {
        try {
          return await fetch(url, init)
        } catch (error) {
          lastError = error
          await new Promise((resolve) => setTimeout(resolve, 100 + i * 20))
        }
      }
      throw lastError
    }

    const initRes = await fetchWithRetry(base, {
      method: 'POST',
      headers: mcpHeaders,
      body: JSON.stringify(initBody)
    })
    expect(initRes.status).toBe(200)
    await initRes.text()

    const sessionId = initRes.headers.get('mcp-session-id')
    expect(sessionId).toBeTruthy()

    const listBody = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    }

    const listRes = await fetchWithRetry(base, {
      method: 'POST',
      headers: { ...mcpHeaders, 'mcp-session-id': sessionId! },
      body: JSON.stringify(listBody)
    })
    expect(listRes.status).toBe(200)
    const listText = await listRes.text()
    const dataLine = listText.split('\n').find((line) => line.startsWith('data: '))
    expect(dataLine).toBeDefined()
    const listJson = JSON.parse(dataLine!.slice('data: '.length)) as {
      result?: { tools?: unknown[] }
    }
    expect(Array.isArray(listJson.result?.tools)).toBe(true)
    for (const tool of listJson.result!.tools as Array<{ inputSchema?: { type?: string } }>) {
      expect(tool.inputSchema?.type).toBe('object')
    }
  }, 15000)

  it.skip('connects via MCP SDK client (stdio transport pattern)', async () => {
    const dummyRegistry = {
      getAllRaw: () => [
        {
          name: 'test_tool',
          description: 'A test tool',
          parameters: z.object({ query: z.string() }),
          execute: async () => 'ok'
        }
      ],
      get: () => undefined
    } as any

    const server = new McpService(mockSettingsRepo, dummyRegistry)
    await server.start()

    const client = new Client({ name: 'BaiShou', version: '1.0.0' }, { capabilities: {} })
    const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${testPort}/mcp`))

    await client.connect(transport, { timeout: 60_000 })
    const { tools } = await client.listTools()
    expect(tools.length).toBeGreaterThan(0)
    for (const tool of tools) {
      expect(() => ToolSchema.parse(tool)).not.toThrow()
      expect(tool.inputSchema.type).toBe('object')
      expect(tool.inputSchema.properties).toBeDefined()
      expect(tool.inputSchema.required).toBeDefined()
    }
    await client.close()
    await server.stop()
  }, 30_000)

  it.skip('maps SSE POST /message to transport.sessionId from SDK', async () => {
    await service.start()
    const port = testPort

    const sseRes = await fetch(`http://127.0.0.1:${port}/sse`, {
      headers: { Accept: 'text/event-stream' }
    })
    expect(sseRes.ok).toBe(true)

    const reader = sseRes.body?.getReader()
    expect(reader).toBeDefined()

    const decoder = new TextDecoder()
    let buffer = ''
    let endpointPath = ''
    const deadline = Date.now() + 5000

    while (Date.now() < deadline && !endpointPath) {
      const { value, done } = await reader!.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const match = buffer.match(/data: (\/message\?sessionId=[^\s]+)/)
      if (match?.[1]) {
        endpointPath = match[1]
        break
      }
    }

    expect(endpointPath).toMatch(/^\/message\?sessionId=/)

    const initBody = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0.0' }
      }
    }

    const postRes = await fetch(`http://127.0.0.1:${port}${endpointPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(initBody)
    })
    expect(postRes.status).not.toBe(404)

    await reader?.cancel()
  }, 15000)

  it('should expose agent tools via real tool registry if provided', async () => {
    // Inject a dummy tool registry
    const dummyRegistry = {
      getAllRaw: () => [
        {
          name: 'test_tool',
          description: 'A test tool',
          parameters: z.object({}),
          execute: async () => 'Test execution result'
        }
      ],
      getEnabledToolsRaw: () => [
        {
          name: 'test_tool',
          description: 'A test tool',
          parameters: z.object({}),
          execute: async () => 'Test execution result'
        }
      ],
      isToolEnabled: () => true,
      get: (name: string) => {
        if (name === 'test_tool') {
          return {
            name: 'test_tool',
            description: 'A test tool',
            parameters: z.object({}),
            execute: async () => 'Test execution result'
          }
        }
        return undefined
      }
    } as any

    const context = {
      sessionId: 'mcp-external',
      vaultName: 'Personal',
      userConfig: {}
    }
    const mcpTools = buildBaishouMcpToolSchemas(dummyRegistry as ToolRegistry, context)

    expect(mcpTools).toHaveLength(1)
    expect(mcpTools[0].name).toBe('baishou_test_tool')
    expect(mcpTools[0].inputSchema.type).toBe('object')

    const executeResult = await executeBaishouMcpTool(
      dummyRegistry as ToolRegistry,
      async () => context,
      { name: 'baishou_test_tool' }
    )
    expect(executeResult.isError).toBe(false)
    expect(executeResult.content[0].text).toContain('Test execution result')
  })
})
