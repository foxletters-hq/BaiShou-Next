import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { SettingsRepository } from '@baishou/database';
// @ts-ignore
import { Server as HttpServer } from 'http';

import { ToolRegistry } from '@baishou/ai/src/tools/tool-registry';
// @ts-ignore
import { zodToJsonSchema } from 'zod-to-json-schema';

interface McpSession {
  server: Server;
  transport: SSEServerTransport;
}

export class McpService {
  private readonly app = express();
  private httpServer: HttpServer | null = null;
  private isRunning = false;
  private readonly connections = new Map<string, McpSession>();

  // 这里为了解耦架构传入 repository（具体实例化将在主入口或者测试里发生）
  constructor(
    private readonly settingsRepo: SettingsRepository,
    private readonly toolRegistry?: ToolRegistry
  ) {
    this.app.use(express.json());
    this.app.use(this.corsMiddleware);
    this.setupRoutes();
  }

  private corsMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, mcp-session-id');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  }

  /**
   * 建立 Express 路由
   */
  private setupRoutes() {
    this.app.get('/mcp', (req, res) => {
      res.json({
        name: 'BaiShou MCP Server',
        version: '1.0.0',
        protocolVersion: '2024-11-05',
        description: 'BaiShou AI Companion Diary - MCP Interface'
      });
    });

    // 遗留同步旧版 JSON RPC 端点 (仅供老客户端过渡)
    this.app.post('/mcp', async (req, res) => {
      try {
        const payload = req.body;
        const method = payload.method;
        if (method === 'notifications/initialized' || method === 'notifications/cancelled') {
          res.send('');
          return;
        }

        const id = payload.id;
        const params = payload.params || {};

        let result;
        if (method === 'initialize') {
            result = {
               protocolVersion: '2024-11-05',
               capabilities: { tools: { listChanged: false } },
               serverInfo: { name: 'BaiShou MCP Server', version: '1.0.0' },
               instructions: 'BaiShou is an AI companion diary app. Use the tools below to read/edit diaries, search memories, and manage stored knowledge.'
            };
        } else if (method === 'tools/list') {
            result = { tools: this.getAgentToolsMcp() };
        } else if (method === 'tools/call') {
            result = await this.executeAgentTool(params);
        } else if (method === 'ping') {
            result = {};
        } else {
            res.status(400).json({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } });
            return;
        }

        res.json({ jsonrpc: '2.0', id, result });
      } catch (e: any) {
        res.json({ jsonrpc: '2.0', id: req.body?.id, error: { code: -32700, message: `Error: ${e.message}` } });
      }
    });

    // --- 标准 MCP SSE 协议实现 ---

    this.app.get('/sse', async (req, res) => {
      const sessionId = Date.now().toString();
      
      const transport = new SSEServerTransport(`/message?sessionId=${sessionId}`, res);
      const server = new Server(
        { name: 'BaiShou MCP Server', version: '1.0.0' },
        { capabilities: { tools: { listChanged: false } } }
      );

      this.registerServerHandlers(server);

      await server.connect(transport);
      this.connections.set(sessionId, { server, transport });

      res.on('close', () => {
        this.connections.delete(sessionId);
      });
    });

    this.app.post('/message', async (req, res) => {
      // 官方 SDK 的 Transport 可以接管 JSON RPC post 的逻辑
      const sessionId = req.query.sessionId as string;
      const session = this.connections.get(sessionId);

      if (!session) {
        res.status(404).send('Session not found');
        return;
      }

      await session.transport.handlePostMessage(req, res);
    });
  }

  /**
   * 将所有的 Tool 路由与处理逻辑挂载至 MCP 标准 Server 上
   */
  private registerServerHandlers(server: Server) {
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.getAgentToolsMcp()
      };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;
      const args = request.params.arguments || {};
      
      try {
        const result = await this.executeAgentTool({ name: toolName, arguments: args });
        return result as any;
      } catch (e: any) {
        return {
          content: [{ type: 'text', text: `Tool execution failed: ${e.message}` }],
          isError: true
        };
      }
    });
  }


  // --- 外部控制与生命周期 ---

  async start(): Promise<void> {
    if (this.isRunning) return;
    
    // 从 Settings 系统拿到动态端口
    const config = await this.settingsRepo.getMcpServerConfig();
    const port = config.mcpPort || 31004;

    return new Promise((resolve, reject) => {
      try {
        this.httpServer = this.app.listen(port, () => {
          this.isRunning = true;
          console.log(`[McpService] Server started on http://localhost:${port}/sse`);
          resolve();
        });
      } catch (e) {
        console.error(`[McpService] Failed to start on port ${port}`, e);
        reject(e);
      }
    });
  }

  async stop(): Promise<void> {
    if (!this.isRunning || !this.httpServer) return;

    for (const [id, session] of this.connections.entries()) {
      try { await session.server.close(); } catch (e) {}
    }
    this.connections.clear();

    return new Promise((resolve) => {
      this.httpServer!.close(() => {
        this.isRunning = false;
        this.httpServer = null;
        console.log(`[McpService] Server stopped`);
        resolve();
      });
    });
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }


  private getAgentToolsMcp() {
    if (!this.toolRegistry) return [];
    
    const tools = this.toolRegistry.getAllRaw();
    return tools.map((tool: any) => ({
      name: `baishou_${tool.name}`,
      description: tool.description,
      inputSchema: zodToJsonSchema(tool.parameters, { target: 'jsonSchema7' })
    }));
  }

  private async executeAgentTool(params: Record<string, any>) {
    const rawName = (params.name || '').replace(/^baishou_/, '');
    if (!rawName || !this.toolRegistry) {
      throw new Error('Missing tool name or registry not initialized');
    }

    const tool = this.toolRegistry.get(rawName);
    if (!tool) throw new Error(`Tool not found: ${rawName}`);

    const context: any = {
      sessionId: 'mcp-external',
      vaultName: 'default', // TODO: 从 Vault Service 获取活跃 vault
      userConfig: {},
    };

    const result = await tool.execute(params.arguments || {}, context);
    return {
      content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result) }],
      isError: false
    };
  }
}
