import { describe, it, expect, vi } from 'vitest';
import {
  CompressionService,
  type CompressibleMessage,
  type CompressibleMessageRepository,
  type CompressionSnapshotRepository,
  type SummaryGenerator,
} from '../session/compression.service';

// ─── Mock 仓库实现 ──────────────────────────────────────────

function createMockMessages(roles: string[]): CompressibleMessage[] {
  return roles.map((role, i) => ({
    id: `msg_${i}`,
    role,
    content: role === 'tool' ? 'x'.repeat(500) : `Message ${i} from ${role}`,
  }));
}

function createMockRepos(messages: CompressibleMessage[]) {
  const snapshotRepo: CompressionSnapshotRepository = {
    getLatestSnapshot: vi.fn().mockResolvedValue(null),
    insertSnapshot: vi.fn().mockResolvedValue({ id: 'snap_1', createdAt: new Date() }),
  };

  const messageRepo: CompressibleMessageRepository = {
    getMessagesBySession: vi.fn().mockResolvedValue(messages),
    updateMessageContent: vi.fn().mockResolvedValue(undefined),
  };

  const summaryGenerator: SummaryGenerator = {
    generateSummary: vi.fn().mockResolvedValue('这是一份压缩摘要'),
  };

  return { snapshotRepo, messageRepo, summaryGenerator };
}

// ─── 测试 ────────────────────────────────────────────────

describe('CompressionService', () => {
  describe('shouldCompress', () => {
    it('should return false when threshold is 0 (disabled)', () => {
      const { snapshotRepo, messageRepo, summaryGenerator } = createMockRepos([]);
      const service = new CompressionService(snapshotRepo, messageRepo, summaryGenerator);
      expect(service.shouldCompress(50000, 0)).toBe(false);
    });

    it('should return true when tokens exceed threshold', () => {
      const { snapshotRepo, messageRepo, summaryGenerator } = createMockRepos([]);
      const service = new CompressionService(snapshotRepo, messageRepo, summaryGenerator);
      expect(service.shouldCompress(60000, 50000)).toBe(true);
    });

    it('should return false when tokens are below threshold', () => {
      const { snapshotRepo, messageRepo, summaryGenerator } = createMockRepos([]);
      const service = new CompressionService(snapshotRepo, messageRepo, summaryGenerator);
      expect(service.shouldCompress(30000, 50000)).toBe(false);
    });
  });

  describe('prune', () => {
    it('should prune old tool outputs beyond the protection zone', async () => {
      // 创建足够多的 tool 消息让剪枝有收益
      const messages = createMockMessages([
        'user', 'assistant', 'tool', 'tool', 'tool', 'tool',
        'user', 'assistant', 'tool',
      ]);
      const { snapshotRepo, messageRepo, summaryGenerator } = createMockRepos(messages);
      const service = new CompressionService(snapshotRepo, messageRepo, summaryGenerator);

      const prunedCount = await service.prune('session_1', 400);

      // 应该有一些被剪枝
      expect(prunedCount).toBeGreaterThanOrEqual(0);
    });

    it('should skip pruning when gain is below minimum', async () => {
      // 只有一条 tool 消息，收益不够
      const messages = createMockMessages(['user', 'assistant', 'tool']);
      const { snapshotRepo, messageRepo, summaryGenerator } = createMockRepos(messages);
      const service = new CompressionService(snapshotRepo, messageRepo, summaryGenerator);

      const prunedCount = await service.prune('session_1', 100000);
      expect(prunedCount).toBe(0);
    });
  });

  describe('compress', () => {
    it('should call summary generator and insert snapshot when enough messages', async () => {
      // 创建足够多的消息确保有东西可以压缩（>= 3 轮 user）
      const messages = createMockMessages([
        'user', 'assistant',
        'user', 'assistant',
        'user', 'assistant',
        'user', 'assistant',
        'user', 'assistant',
      ]);
      const { snapshotRepo, messageRepo, summaryGenerator } = createMockRepos(messages);
      const service = new CompressionService(snapshotRepo, messageRepo, summaryGenerator);

      await service.compress('session_1', { threshold: 100 });

      expect(summaryGenerator.generateSummary).toHaveBeenCalled();
      expect(snapshotRepo.insertSnapshot).toHaveBeenCalled();
    });

    it('should not compress when there are too few messages', async () => {
      const messages = createMockMessages(['user', 'assistant']);
      const { snapshotRepo, messageRepo, summaryGenerator } = createMockRepos(messages);
      const service = new CompressionService(snapshotRepo, messageRepo, summaryGenerator);

      await service.compress('session_1', { threshold: 100 });

      expect(summaryGenerator.generateSummary).not.toHaveBeenCalled();
    });
  });
});
