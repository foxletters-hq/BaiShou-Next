import { describe, it, expect } from 'vitest';
import { AgentToolRegistry } from '../tools/tool-registry';
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

describe('AgentToolRegistry — Full Tool Suite', () => {
  it('should register all 13 built-in tools without conflicts', () => {
    const registry = new AgentToolRegistry();
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
      registry.register(tool);
    }

    expect(registry.ids).toHaveLength(13);
    expect(registry.hasTool('current_time')).toBe(true);
    expect(registry.hasTool('diary_read')).toBe(true);
    expect(registry.hasTool('diary_edit')).toBe(true);
    expect(registry.hasTool('diary_delete')).toBe(true);
    expect(registry.hasTool('diary_list')).toBe(true);
    expect(registry.hasTool('diary_search')).toBe(true);
    expect(registry.hasTool('memory_store')).toBe(true);
    expect(registry.hasTool('memory_delete')).toBe(true);
    expect(registry.hasTool('vector_search')).toBe(true);
    expect(registry.hasTool('message_search')).toBe(true);
    expect(registry.hasTool('summary_read')).toBe(true);
    expect(registry.hasTool('web_search')).toBe(true);
    expect(registry.hasTool('url_read')).toBe(true);
  });

  it('should convert all tools to Vercel format', () => {
    const registry = new AgentToolRegistry();
    registry.register(new CurrentTimeTool());
    registry.register(new DiaryReadTool());
    registry.register(new MemoryStoreTool());
    registry.register(new VectorSearchTool());

    const vercelTools = registry.toVercelTools({
      sessionId: 'test',
      vaultName: '/tmp',
    });

    expect(Object.keys(vercelTools)).toHaveLength(4);
    expect(vercelTools['current_time']).toBeDefined();
    expect(vercelTools['diary_read']).toBeDefined();
    expect(vercelTools['memory_store']).toBeDefined();
    expect(vercelTools['vector_search']).toBeDefined();
  });

  it('should throw when registering duplicate tool', () => {
    const registry = new AgentToolRegistry();
    registry.register(new CurrentTimeTool());

    expect(() => {
      registry.register(new CurrentTimeTool());
    }).toThrow("AgentTool 'current_time' is already registered.");
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
