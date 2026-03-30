import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '../session/system-prompt-builder';

describe('SystemPromptBuilder', () => {
  it('should include persona when provided', () => {
    const result = buildSystemPrompt({
      persona: '你是白守，一位温暖的 AI 伙伴',
      vaultName: 'TestVault',
      tools: [],
    });
    expect(result).toContain('白守');
  });

  it('should include time context', () => {
    const result = buildSystemPrompt({
      vaultName: 'TestVault',
      tools: [],
    });
    // 应包含当前年份
    expect(result).toContain(String(new Date().getFullYear()));
  });

  it('should include vault name', () => {
    const result = buildSystemPrompt({
      vaultName: 'MyLifeVault',
      tools: [],
    });
    expect(result).toContain('Vault: MyLifeVault');
  });

  it('should list tools with descriptions', () => {
    const result = buildSystemPrompt({
      vaultName: 'TestVault',
      tools: [
        { id: 'diary_read', description: 'Read diary entries' },
        { id: 'current_time', description: 'Get current time' },
      ],
    });
    expect(result).toContain('**diary_read**');
    expect(result).toContain('**current_time**');
  });

  it('should add RAG disabled note when memory tools are missing', () => {
    const result = buildSystemPrompt({
      vaultName: 'TestVault',
      tools: [{ id: 'diary_read', description: 'Read diary entries' }],
    });
    expect(result).toContain('Memory/RAG tools are currently disabled');
  });

  it('should NOT add RAG note when memory tools are present', () => {
    const result = buildSystemPrompt({
      vaultName: 'TestVault',
      tools: [
        { id: 'memory_store', description: 'Store memories' },
        { id: 'vector_search', description: 'Search vectors' },
      ],
    });
    expect(result).not.toContain('Memory/RAG tools are currently disabled');
  });

  it('should include guidelines when provided', () => {
    const result = buildSystemPrompt({
      vaultName: 'TestVault',
      tools: [],
      guidelines: '请用温暖友好的语气回复',
    });
    expect(result).toContain('温暖友好');
  });

  it('should include user profile block when provided', () => {
    const result = buildSystemPrompt({
      vaultName: 'TestVault',
      tools: [],
      userProfileBlock: '用户: Anson, 开发者',
    });
    expect(result).toContain('Anson');
  });
});
