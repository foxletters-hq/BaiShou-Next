import express from 'express'
import { randomUUID } from 'node:crypto'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  InitializeRequestSchema,
  ToolSchema,
  isInitializeRequest
} from '@modelcontextprotocol/sdk/types.js'
import type { SettingsRepository } from '@baishou/database-desktop'
import { APP_VERSION } from '../../app-version'
// @ts-ignore
import { Server as HttpServer } from 'http'

import { z } from 'zod'
import {
  ToolRegistry,
  type ToolContext,
  buildMcpInstructions,
  formatMcpToolCallResult
} from '@baishou/ai'
import { isMcpRequestAuthorized, logger } from '@baishou/shared'
import { buildMcpToolContext } from '../ipc/agent-helpers'

interface SseMcpSession {
  server: Server
  transport: SSEServerTransport
}

export class McpService {
  private readonly app = express()
  private httpServer: HttpServer | null = null
  private isRunning = false
  private readonly sseSessions = new Map<string, SseMcpSession>()
  private readonly streamableTransports = new Map<string, StreamableHTTPServerTransport>()

  get running(): boolean {
    return this.isRunning
  }

  constructor(
    private readonly settingsRepo: SettingsRepository,
    private readonly toolRegistry?: ToolRegistry,
    private readonly resolveToolContext: () => Promise<ToolContext> = buildMcpToolContext
  ) {
    this.app.use(express.json())
    this.app.use(this.corsMiddleware)
    this.setupRoutes()
  }

  private corsMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
    res.header(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, mcp-session-id, Mcp-Session-Id, Last-Event-ID, mcp-protocol-version, MCP-Protocol-Version'
    )
    if (req.method === 'OPTIONS') {
      res.sendStatus(200)
      return
    }
    next()
  }

  private async ensureAuthorized(req: express.Request, res: express.Response): Promise<boolean> {
    const config = await this.settingsRepo.getMcpServerConfig()
    const authHeader = req.headers.authorization
    const headerValue = Array.isArray(authHeader) ? authHeader[0] : authHeader
    if (isMcpRequestAuthorized(config, headerValue)) return true

    if (!res.headersSent) {
      res.status(401).json({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Unauthorized: invalid or missing MCP auth token' },
        id: null
      })
    }
    return false
  }

  private createMcpServer(): Server {
    const server = new Server(
      { name: 'BaiShou MCP Server', version: APP_VERSION },
      { capabilities: { tools: { listChanged: false } } }
    )
    this.registerServerHandlers(server)
    return server
  }

  private setupRoutes() {
    // Streamable HTTP (Cursor / modern MCP clients) — primary endpoint
    this.app.post('/mcp', async (req, res) => {
      await this.handleStreamablePost(req, res)
    })
    this.app.get('/mcp', async (req, res) => {
      await this.handleStreamableGet(req, res)
    })
    this.app.delete('/mcp', async (req, res) => {
      await this.handleStreamableDelete(req, res)
    })

    // Legacy SSE transport (optional; session id must match SDK transport.sessionId)
    this.app.get('/sse', async (req, res) => {
      if (!(await this.ensureAuthorized(req, res))) return
      const transport = new SSEServerTransport('/message', res)
      const server = this.createMcpServer()

      await server.connect(transport)
      this.sseSessions.set(transport.sessionId, { server, transport })

      res.on('close', () => {
        this.sseSessions.delete(transport.sessionId)
      })
    })

    this.app.post('/message', async (req, res) => {
      if (!(await this.ensureAuthorized(req, res))) return
      const sessionId = req.query.sessionId as string
      const session = sessionId ? this.sseSessions.get(sessionId) : undefined

      if (!session) {
        logger.warn(`[McpService] SSE session not found: ${sessionId ?? '(missing)'}`)
        res.status(404).send('Session not found')
        return
      }

      await session.transport.handlePostMessage(req, res)
    })
  }

  private getStreamableSessionId(req: express.Request): string | undefined {
    const headerSessionId = req.headers['mcp-session-id']
    const raw = Array.isArray(headerSessionId) ? headerSessionId[0] : headerSessionId
    return typeof raw === 'string' && raw.length > 0 ? raw : undefined
  }

  private async handleStreamablePost(req: express.Request, res: express.Response) {
    if (!(await this.ensureAuthorized(req, res))) return

    const sessionId = this.getStreamableSessionId(req)

    try {
      if (sessionId) {
        const transport = this.streamableTransports.get(sessionId)
        if (!transport) {
          res.status(404).json({
            jsonrpc: '2.0',
            error: { code: -32001, message: `Session not found: ${sessionId}` },
            id: null
          })
          return
        }
        await transport.handleRequest(req, res, req.body)
        return
      }

      if (!isInitializeRequest(req.body)) {
        res.status(400).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
          id: null
        })
        return
      }

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          this.streamableTransports.set(sid, transport)
          logger.info(`[McpService] Streamable session initialized: ${sid}`)
        },
        onsessionclosed: (sid) => {
          this.streamableTransports.delete(sid)
          logger.info(`[McpService] Streamable session closed: ${sid}`)
        }
      })

      const server = this.createMcpServer()
      await server.connect(transport)
      if (transport.sessionId) {
        this.streamableTransports.set(transport.sessionId, transport)
      }

      await transport.handleRequest(req, res, req.body)
    } catch (e: any) {
      logger.error('[McpService] Streamable POST failed:', e)
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null
        })
      }
    }
  }

  private async handleStreamableGet(req: express.Request, res: express.Response) {
    if (!(await this.ensureAuthorized(req, res))) return

    const sessionId = this.getStreamableSessionId(req)
    if (!sessionId) {
      res.status(400).send('Invalid or missing session ID')
      return
    }

    const transport = this.streamableTransports.get(sessionId)
    if (!transport) {
      res.status(404).send('Session not found')
      return
    }

    await transport.handleRequest(req, res)
  }

  private async handleStreamableDelete(req: express.Request, res: express.Response) {
    if (!(await this.ensureAuthorized(req, res))) return

    const sessionId = this.getStreamableSessionId(req)
    if (!sessionId) {
      res.status(400).send('Invalid or missing session ID')
      return
    }

    const transport = this.streamableTransports.get(sessionId)
    if (!transport) {
      res.status(404).send('Session not found')
      return
    }

    try {
      await transport.handleRequest(req, res)
    } catch (e: any) {
      logger.error('[McpService] Streamable DELETE failed:', e)
      if (!res.headersSent) {
        res.status(500).send('Error processing session termination')
      }
    }
  }

  private registerServerHandlers(server: Server) {
    server.setRequestHandler(InitializeRequestSchema, async () => {
      const { vaultName } = await this.resolveToolContext()
      return {
        protocolVersion: '2024-11-05',
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'BaiShou MCP Server', version: APP_VERSION },
        instructions: buildMcpInstructions(vaultName)
      }
    })

    server.setRequestHandler(ListToolsRequestSchema, async () => {
      const context = await this.resolveToolContext()
      return {
        tools: this.getAgentToolsMcp(context)
      }
    })

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name
      const args = request.params.arguments || {}

      try {
        const result = await this.executeAgentTool({ name: toolName, arguments: args })
        return result as any
      } catch (e: any) {
        return {
          content: [{ type: 'text', text: `Tool execution failed: ${e.message}` }],
          isError: true
        }
      }
    })
  }

  async start(): Promise<void> {
    if (this.isRunning) return

    const config = await this.settingsRepo.getMcpServerConfig()
    const port = config.mcpPort || 31004

    return new Promise((resolve, reject) => {
      try {
        this.httpServer = this.app.listen(port, '127.0.0.1', () => {
          this.isRunning = true
          logger.info(`[McpService] Server started on http://127.0.0.1:${port}/mcp`)
          resolve()
        })
      } catch (e) {
        logger.error(`[McpService] Failed to start on port ${port}`, e as any)
        reject(e)
      }
    })
  }

  async stop(): Promise<void> {
    if (!this.isRunning || !this.httpServer) return

    for (const [_id, session] of this.sseSessions.entries()) {
      try {
        await session.server.close()
      } catch (e) {}
    }
    this.sseSessions.clear()

    for (const transport of this.streamableTransports.values()) {
      try {
        await transport.close()
      } catch (e) {}
    }
    this.streamableTransports.clear()

    const server = this.httpServer
    return new Promise((resolve) => {
      server.closeAllConnections?.()
      server.close(() => {
        this.isRunning = false
        this.httpServer = null
        logger.info(`[McpService] Server stopped`)
        resolve()
      })
    })
  }

  async restart(): Promise<void> {
    await this.stop()
    await this.start()
  }

  /**
   * MCP SDK 要求 inputSchema.type === "object"，且包含 properties 与 required。
   */
  private toMcpInputSchema(parameters: z.ZodType) {
    const raw = z.toJSONSchema(parameters) as Record<string, unknown>
    return {
      type: 'object' as const,
      properties: (raw.properties as Record<string, unknown>) ?? {},
      required: Array.isArray(raw.required) ? raw.required : []
    }
  }

  private getAgentToolsMcp(context: ToolContext) {
    if (!this.toolRegistry) return []

    const tools = this.toolRegistry.getEnabledToolsRaw(context)
    const mcpTools: Array<{
      name: string
      description: string
      inputSchema: { type: 'object'; properties: Record<string, unknown>; required: string[] }
    }> = []

    for (const tool of tools) {
      const name = `baishou_${tool.name}`
      const inputSchema = this.toMcpInputSchema(tool.parameters)
      try {
        const parsed = ToolSchema.parse({
          name,
          description: tool.description || name,
          inputSchema
        })
        mcpTools.push({
          name: parsed.name,
          description: parsed.description ?? name,
          inputSchema
        })
      } catch (e) {
        logger.error(`[McpService] Skipping invalid MCP tool "${name}":`, e as any)
      }
    }

    return mcpTools
  }

  private async executeAgentTool(params: Record<string, any>) {
    const rawName = (params.name || '').replace(/^baishou_/, '')
    if (!rawName || !this.toolRegistry) {
      throw new Error('Missing tool name or registry not initialized')
    }

    const tool = this.toolRegistry.get(rawName)
    if (!tool) throw new Error(`Tool not found: ${rawName}`)

    const context = await this.resolveToolContext()

    if (!this.toolRegistry.isToolEnabled(rawName, context)) {
      throw new Error(`Tool not available: ${rawName}`)
    }

    const result = await tool.execute(params.arguments || {}, context)
    return formatMcpToolCallResult(typeof result === 'string' ? result : JSON.stringify(result))
  }
}
