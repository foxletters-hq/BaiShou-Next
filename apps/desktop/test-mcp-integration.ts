import { McpService } from './src/main/services/mcp.service';

async function runTest() {
  console.log('--- 启动端到端集成测试 ---');
  // 注入一个临时的 Mock Repo 以提供端口号
  const mockSettingsRepo = {
    getMcpServerConfig: async () => ({ mcpPort: 31006, mcpEnabled: true })
  } as any;

  const mcp = new McpService(mockSettingsRepo);
  await mcp.start();
  console.log('✅ 服务器已在 31006 端口启动\n');

  // ==========================================
  // 测试 1: 旧版 POST /mcp 兼容路由 (测试 tools/list)
  // ==========================================
  console.log('➡️ 发送请求 POST /mcp [Method: tools/list]');
  const res1 = await fetch('http://localhost:31006/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: "abc-123",
      method: 'tools/list'
    })
  });
  const data1 = await res1.json();
  console.log('⬅️ 收到响应:');
  console.dir(data1, { depth: null });
  console.log();

  // ==========================================
  // 测试 2: 官方 MCP SDK SSE GET /sse 建立连接
  // ==========================================
  console.log('➡️ 发起 SSE 请求 GET /sse 以构建持久层通讯');
  // 我们直接用 fetch 发起一个长流看能不能获得 text/event-stream 和 endpoint
  const sseRes = await fetch('http://localhost:31006/sse', {
     method: 'GET',
     headers: { 'Accept': 'text/event-stream' }
  });
  
  console.log(`⬅️ 收到 SSE 初始化状态: ${sseRes.status} ${sseRes.statusText}`);
  console.log(`⬅️ 标头 Content-Type: ${sseRes.headers.get('content-type')}`);

  // 消费一小段 stream 来获取端点
  const reader = sseRes.body?.getReader();
  if (reader) {
     const { value } = await reader.read();
     // Decode buffer
     const chunk = new TextDecoder().decode(value);
     console.log('⬅️ SSE 首次下发流数据事件:\n' + chunk.trim());
  }
  
  console.log();
  await mcp.stop();
  console.log('✅ 测试完毕，服务器已关闭');
}

runTest().catch(console.error);
