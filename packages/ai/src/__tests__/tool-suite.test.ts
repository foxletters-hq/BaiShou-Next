import { describe, it, expect } from 'vitest';
import { ToolRegistry } from '../tools/tool-registry';
import { CurrentTimeTool } from '../tools/current-time.tool';
import { DiaryReadTool } from '../tools/diary-read.tool';
import { DiaryListTool } from '../tools/diary-list.tool';
import { DiaryEditTool } from '../tools/diary-edit.tool';
import { DiaryDeleteTool } from '../tools/diary-delete.tool';
import { DiarySearchTool } from '../tools/diary-search.tool';
import { MemoryStoreTool } from '../tools/memory-store.tool';
import { MemoryDeleteTool } from '../tools/memory-delete.tool';
import { VectorSearchTool } from '../tools/vector-search.tool';
import { MessageSearchTool } from '../tools/message-search.tool';
import { SummaryReadTool } from '../tools/summary-read.tool';
import { WebSearchTool } from '../tools/web-search.tool';
import { UrlReadTool } from '../tools/url-read.tool';

describe('ToolRegistry — Full Tool Suite', () => {
  it('should auto-register all 13 built-in tools on construction', () => {
    const registry = new ToolRegistry();
    const allTools = registry.getAllRaw();

    expect(allTools).toHaveLength(13);

    // 检验每个预期工具都被注册了
    const toolNames = allTools.map(t => t.name);
    expect(toolNames).toContain('current_time');
    expect(toolNames).toContain('diary_read');
    expect(toolNames).toContain('diary_edit');
    expect(toolNames).toContain('diary_delete');
    expect(toolNames).toContain('diary_list');
    expect(toolNames).toContain('diary_search');
    expect(toolNames).toContain('memory_store');
    expect(toolNames).toContain('memory_delete');
    expect(toolNames).toContain('vector_search');
    expect(toolNames).toContain('message_search');
    expect(toolNames).toContain('summary_read');
    expect(toolNames).toContain('web_search');
    expect(toolNames).toContain('url_read');
  });

  it('should convert enabled tools to Vercel format', () => {
    const registry = new ToolRegistry();

    const vercelTools = registry.getEnabledToolsAsVercel({
      sessionId: 'test',
      vaultName: '/tmp',
    });

    // 所有 13 个工具都应该被启用（无禁用列表）
    expect(Object.keys(vercelTools)).toHaveLength(13);
    expect(vercelTools['current_time']).toBeDefined();
    expect(vercelTools['diary_read']).toBeDefined();
    expect(vercelTools['memory_store']).toBeDefined();
    expect(vercelTools['vector_search']).toBeDefined();
  });

  it('should respect disabledToolIds in userConfig', () => {
    const registry = new ToolRegistry();

    const vercelTools = registry.getEnabledToolsAsVercel({
      sessionId: 'test',
      vaultName: '/tmp',
      userConfig: {
        disabledToolIds: ['web_search', 'url_read'],
      },
    });

    expect(vercelTools['web_search']).toBeUndefined();
    expect(vercelTools['url_read']).toBeUndefined();
    expect(vercelTools['current_time']).toBeDefined();
    expect(Object.keys(vercelTools)).toHaveLength(11);
  });

  it('should disable RAG tools when ragEnabled is false', () => {
    const registry = new ToolRegistry();

    const vercelTools = registry.getEnabledToolsAsVercel({
      sessionId: 'test',
      vaultName: '/tmp',
      userConfig: {
        ragEnabled: false,
      },
    });

    expect(vercelTools['vector_search']).toBeUndefined();
    expect(vercelTools['memory_store']).toBeUndefined();
    // 非 RAG 工具仍然应该存在
    expect(vercelTools['current_time']).toBeDefined();
    expect(vercelTools['diary_read']).toBeDefined();
  });

  it('should allow looking up tools by name', () => {
    const registry = new ToolRegistry();

    expect(registry.get('current_time')).toBeInstanceOf(CurrentTimeTool);
    expect(registry.get('memory_store')).toBeInstanceOf(MemoryStoreTool);
    expect(registry.get('nonexistent_tool')).toBeUndefined();
  });

  it('each tool should have name, description, and parameters', () => {
    const tools = [
      new CurrentTimeTool(),
      new DiaryReadTool(),
      new DiaryListTool(),
      new DiaryEditTool(),
      new DiaryDeleteTool(),
      new DiarySearchTool(),
      new MemoryStoreTool(),
      new MemoryDeleteTool(),
      new VectorSearchTool(),
      new MessageSearchTool(),
      new SummaryReadTool(),
      new WebSearchTool(),
      new UrlReadTool(),
    ];

    for (const tool of tools) {
      expect(tool.name).toBeTruthy();
      expect(tool.name).toMatch(/^[a-z_]+$/);
      expect(tool.description.length).toBeGreaterThan(20);
      expect(tool.parameters).toBeDefined();
    }
  });
});
