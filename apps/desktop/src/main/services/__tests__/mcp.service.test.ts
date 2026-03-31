import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { McpService } from '../mcp.service';

describe('McpService', () => {
  let mockSettingsRepo: any;
  let service: McpService;
  // 避开系统常用端口进行测试
  const TEST_PORT = 35688;

  beforeEach(() => {
    mockSettingsRepo = {
      getMcpServerConfig: vi.fn().mockResolvedValue({
        mcpPort: TEST_PORT,
        mcpEnabled: true
      })
    };
    service = new McpService(mockSettingsRepo);
  });

  afterEach(async () => {
    // 强制清理产生的 HTTP 监听以保证后面测试不报 Port In Use
    await service.stop();
  });

  it('should initialize with isRunning = false', () => {
    expect((service as any).isRunning).toBe(false);
    expect((service as any).httpServer).toBeNull();
  });

  it('should start HTTP server successfully', async () => {
    await service.start();
    expect((service as any).isRunning).toBe(true);
    expect((service as any).httpServer).toBeDefined();
    
    // 多次启动不应抛异常
    await service.start();
    expect((service as any).isRunning).toBe(true);
  });

  it('should stop HTTP server strictly', async () => {
    await service.start();
    await service.stop();
    expect((service as any).isRunning).toBe(false);
    expect((service as any).httpServer).toBeNull();
  });

  it('should restart seamlessly', async () => {
    await service.start();
    await service.restart();
    expect((service as any).isRunning).toBe(true);
    expect((service as any).httpServer).toBeDefined();
  });

  it('should expose agent tools via MCP stubs logic', async () => {
    // 纯逻辑调用覆盖率补偿
    const stubResult = (service as any).getAgentToolsMcpStub();
    expect(stubResult).length(1);
    expect(stubResult[0].name).toBe('baishou_search_memory');

    const executeResult = await (service as any).executeAgentToolStub({ name: 'baishou_search_memory' });
    expect(executeResult.isError).toBe(false);
    expect(executeResult.content[0].text).contain('RAG framework is pending integration');
  });
});
