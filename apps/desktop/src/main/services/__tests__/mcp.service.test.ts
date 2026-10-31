// @vitest-environment node
import { createServer as createNetServer } from 'node:net'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { z } from 'zod'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { ToolSchema } from '@modelcontextprotocol/sdk/types.js'
import {
  ToolRegistry,
  buildBaishouMcpToolSchemas,
  executeBaishouMcpTool,
  MCP_EXTERNAL_SESSION_ID
} from '@baishou/ai'
import { McpService } from '../mcp.service'
import { bindDesktopWindowMcpKeepAlive } from '../desktop-post-window-init'
import {
  bootstrapMcpServer,
  ensureMcpServerAlive,
  getMcpService,
  shutdownMcpServer
} from '../mcp-runtime'

const getDesktopMcpServerConfigMock = vi.hoisted(() => vi.fn())

vi.mock('../desktop-mcp-config.store', () => ({
  getDesktopMcpServerConfig: getDesktopMcpServerConfigMock
}))

vi.mock('../../ipc/agent-helpers', () => ({
  toolRegistry: {
    getEnabledToolsRaw: () => [],
    get: () => undefined,
    isToolEnabled: () => false
  },
  buildMcpToolContext: vi.fn(async () => ({
    sessionId: 'mcp_external_session',
    vaultId: 'vlt_test',
    vaultName: 'Personal',
    userConfig: {}
  }))
}))

describe.sequential('McpService', () => {
  let service: McpService
  let testPort: number

  beforeEach(() => {
    testPort = 35700 + Math.floor(Math.random() * 1000)
    getDesktopMcpServerConfigMock.mockResolvedValue({
      mcpPort: testPort,
      mcpEnabled: true
    })
    const emptyRegistry = {
      getEnabledToolsRaw: () => [],
      get: () => undefined,
      isToolEnabled: () => false
    } as unknown as ToolRegistry
    service = new McpService(emptyRegistry, async () => ({
      sessionId: MCP_EXTERNAL_SESSION_ID,
      vaultId: 'vlt_test',
      vaultName: 'Personal',
      userConfig: {}
    }))
  })

  afterEach(async () => {
    // 强制清理产生的 HTTP 监听以保证后面测试不报 Port In Use
    await service.stop()
    await shutdownMcpServer()
  })

  it('should initialize with isRunning = false', () => {
    expect((service as any).isRunning).toBe(false)
    expect((service as any).httpServer).toBeNull()
    expect(service.running).toBe(false)
  })

  it('should start HTTP server successfully', async () => {
    await service.start()
    expect((service as any).isRunning).toBe(true)
    expect((service as any).httpServer).toBeDefined()
    expect(service.running).toBe(true)

    // 多次启动不应抛异常
    await service.start()
    expect((service as any).isRunning).toBe(true)
    expect(service.running).toBe(true)
  })

  it('should stop HTTP server strictly', async () => {
    await service.start()
    await service.stop()
    expect((service as any).isRunning).toBe(false)
    expect((service as any).httpServer).toBeNull()
    expect(service.running).toBe(false)
  })

  it('should restart seamlessly', async () => {
    await service.start()
    await service.restart()
    expect((service as any).isRunning).toBe(true)
    expect((service as any).httpServer).toBeDefined()
    expect(service.running).toBe(true)
  })

  it('should retry with backoff when port is transiently EADDRINUSE and succeed once released', async () => {
    const blocker = createNetServer()
    await new Promise<void>((resolve, reject) => {
      blocker.once('error', reject)
      blocker.listen(testPort, '0.0.0.0', () => resolve())
    })

    // 120ms 后释放端口，让 McpService.start() 在退避重试中成功监听
    setTimeout(() => {
      blocker.close()
    }, 120)

    try {
      await service.start({ retryDelaysMs: [80, 160, 320] })
      expect(service.running).toBe(true)
      expect((service as any).httpServer?.listening).toBe(true)
    } finally {
      await new Promise<void>((resolve) => blocker.close(() => resolve()))
    }
  })

  it('should clean up httpServer = null and running = false when all EADDRINUSE retries fail', async () => {
    const blocker = createNetServer()
    await new Promise<void>((resolve, reject) => {
      blocker.once('error', reject)
      blocker.listen(testPort, '0.0.0.0', () => resolve())
    })

    try {
      await expect(service.start({ retryDelaysMs: [30, 60] })).rejects.toThrow()
      expect(service.running).toBe(false)
      expect((service as any).isRunning).toBe(false)
      expect((service as any).httpServer).toBeNull()
    } finally {
      await new Promise<void>((resolve) => blocker.close(() => resolve()))
    }
  })

  it('should reflect underlying httpServer close or error in service.running and self-heal on window activation', async () => {
    await bootstrapMcpServer()
    const runtimeService = getMcpService()
    expect(runtimeService).toBeTruthy()
    expect(runtimeService!.running).toBe(true)

    // 模拟底层 httpServer 意外关闭
    const underlyingServer = (runtimeService as any).httpServer as import('http').Server
    await new Promise<void>((resolve) => underlyingServer.close(() => resolve()))

    expect(runtimeService!.running).toBe(false)
    expect((runtimeService as any).isRunning).toBe(false)

    // 模拟窗口 focus 激活触发自愈
    const listeners = new Map<'focus' | 'show', () => void>()
    const fakeWindow = {
      on(event: 'focus' | 'show', listener: () => void) {
        listeners.set(event, listener)
      }
    }
    bindDesktopWindowMcpKeepAlive(fakeWindow)
    listeners.get('focus')?.()

    await vi.waitFor(
      () => {
        expect(runtimeService!.running).toBe(true)
      },
      { timeout: 5000, interval: 30 }
    )

    // 模拟底层 httpServer 意外报错后调用 ensureMcpServerAlive 自愈
    const nextServer = (runtimeService as any).httpServer as import('http').Server
    nextServer.emit('error', new Error('unexpected socket error'))
    expect((runtimeService as any).isRunning).toBe(false)
    expect(runtimeService!.running).toBe(false)
    await new Promise<void>((resolve) => nextServer.close(() => resolve()))

    await ensureMcpServerAlive()
    expect(runtimeService!.running).toBe(true)
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
    const rawJson = dataLine ? dataLine.slice('data: '.length) : listText.trim()
    expect(rawJson).toBeTruthy()
    const listJson = JSON.parse(rawJson) as {
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

    const server = new McpService(dummyRegistry)
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

  it('maps SSE POST /message to transport.sessionId from SDK', async () => {
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

  it('allows Legacy SSE clients to connect via GET /mcp without mcp-session-id', async () => {
    await service.start()
    const port = testPort

    const sseRes = await fetch(`http://127.0.0.1:${port}/mcp`, {
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
    expect(postRes.status).toBe(202)

    await reader?.cancel()
  }, 15000)

  it('rejects unauthorized Streamable HTTP when auth is enabled', async () => {
    getDesktopMcpServerConfigMock.mockResolvedValue({
      mcpPort: testPort,
      mcpEnabled: true,
      mcpAuthEnabled: true,
      mcpAuthToken: 'secret-token'
    })
    await service.start()

    const res = await fetch(`http://127.0.0.1:${testPort}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0.0' }
        }
      })
    })
    expect(res.status).toBe(401)
  }, 15000)

  it('allows Streamable HTTP without token when auth is disabled', async () => {
    getDesktopMcpServerConfigMock.mockResolvedValue({
      mcpPort: testPort,
      mcpEnabled: true,
      mcpAuthEnabled: false,
      mcpAuthToken: 'ignored-token'
    })
    await service.start()

    const res = await fetch(`http://127.0.0.1:${testPort}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0.0' }
        }
      })
    })
    expect(res.status).toBe(200)
  }, 15000)

  it('should expose agent tools via real tool registry if provided', async () => {
    const currentTimeTool = {
      name: 'current_time',
      description: 'Current time',
      parameters: z.object({}),
      execute: async () => 'Test execution result'
    }
    // Inject a dummy tool registry
    const dummyRegistry = {
      getAllRaw: () => [currentTimeTool],
      getEnabledToolsRaw: () => [currentTimeTool],
      isToolEnabled: () => true,
      get: (name: string) => (name === 'current_time' ? currentTimeTool : undefined)
    } as any

    const context = {
      sessionId: MCP_EXTERNAL_SESSION_ID,
      vaultId: 'vlt_test',
      vaultName: 'Personal',
      userConfig: {}
    }
    const mcpTools = buildBaishouMcpToolSchemas(dummyRegistry as ToolRegistry, context)

    expect(mcpTools).toHaveLength(1)
    expect(mcpTools[0].name).toBe('baishou_current_time')
    expect(mcpTools[0].inputSchema.type).toBe('object')

    const executeResult = await executeBaishouMcpTool(
      dummyRegistry as ToolRegistry,
      async () => context,
      { name: 'baishou_current_time' }
    )
    expect(executeResult.isError).toBe(false)
    expect(executeResult.content[0].text).toContain('Test execution result')
  })

  it('binds Streamable HTTP session to target workspace from ?vault= query parameter', async () => {
    const resolvedVaults: Array<string | undefined> = []
    const vaultEchoTool = {
      name: 'current_time',
      description: 'Echo vault',
      parameters: z.object({}),
      execute: async (_args: unknown, ctx: { vaultId: string; vaultName: string }) =>
        `vault=${ctx.vaultId}:${ctx.vaultName}`
    }
    const dummyRegistry = {
      getAllRaw: () => [vaultEchoTool],
      getEnabledToolsRaw: () => [vaultEchoTool],
      isToolEnabled: () => true,
      get: (name: string) => (name === 'current_time' ? vaultEchoTool : undefined)
    } as unknown as ToolRegistry

    service = new McpService(dummyRegistry, async (targetVault) => {
      resolvedVaults.push(targetVault)
      return {
        sessionId: MCP_EXTERNAL_SESSION_ID,
        vaultId: targetVault || 'vlt_default',
        vaultName: targetVault === 'vlt_work' ? '工作区B' : 'Personal',
        userConfig: {}
      }
    })

    await service.start()
    const mcpHeaders = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream'
    }

    const initRes = await fetch(`http://127.0.0.1:${testPort}/mcp?vault=vlt_work`, {
      method: 'POST',
      headers: mcpHeaders,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0.0' }
        }
      })
    })
    expect(initRes.status).toBe(200)
    const sessionId = initRes.headers.get('mcp-session-id')
    expect(sessionId).toBeTruthy()

    const callRes = await fetch(`http://127.0.0.1:${testPort}/mcp?vault=vlt_work`, {
      method: 'POST',
      headers: { ...mcpHeaders, 'mcp-session-id': sessionId! },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'baishou_current_time',
          arguments: {}
        }
      })
    })
    expect(callRes.status).toBe(200)
    const callText = await callRes.text()
    expect(callText).toContain('vault=vlt_work:工作区B')
    expect(resolvedVaults).toContain('vlt_work')
  }, 15000)
})
