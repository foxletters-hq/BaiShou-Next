import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

import { ShadowIndexSyncService, IEmbeddingCallback } from '../shadow-index-sync.service';
import { IStoragePathService } from '../../vault/storage-path.types';
import { IVaultService, VaultInfo } from '../../vault/vault.types';

// ── Mock: ShadowIndexRepository ──────────
class MockShadowIndexRepository {
  private records: any[] = [];
  private idCounter = 1;

  async mountFTS() { /* noop */ }

  async upsert(payload: any) {
    const existing = this.records.findIndex(r => r.filePath === payload.filePath);
    const id = existing !== -1 ? this.records[existing].id : this.idCounter++;
    const record = { ...payload, id };
    if (existing !== -1) {
      this.records[existing] = record;
    } else {
      this.records.push(record);
    }
    return id;
  }

  async deleteById(id: number) {
    this.records = this.records.filter(r => r.id !== id);
  }

  async findByDatePrefix(dayStr: string) {
    return this.records.filter(r => r.date.startsWith(dayStr));
  }

  async getHashByDate(dateIso: string) {
    const rec = this.records.find(r => r.date === dateIso);
    return rec?.contentHash ?? null;
  }

  async getAllRecords() {
    return this.records.map(r => ({ id: r.id, date: r.date, filePath: r.filePath }));
  }

  async searchFTS() {
    return [];
  }

  // 测试辅助
  _getRecordCount() { return this.records.length; }
}

// ── 测试套件 ──────────────────────────────
describe('ShadowIndexSyncService', () => {
  let tmpDir: string;
  let journalsDir: string;
  let mockRepo: MockShadowIndexRepository;
  let mockPathService: IStoragePathService;
  let mockVaultService: IVaultService;
  let mockEmbeddingCb: IEmbeddingCallback;
  let service: ShadowIndexSyncService;

  beforeEach(async () => {
    // 创建临时沙盒目录结构
    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'shadow-idx-test-'));
    journalsDir = path.join(tmpDir, 'TestVault', 'Journals');
    await fsp.mkdir(journalsDir, { recursive: true });

    mockRepo = new MockShadowIndexRepository();

    mockPathService = {
      getGlobalRegistryDirectory: async () => path.join(tmpDir, '.registry'),
      getVaultDirectory: async () => path.join(tmpDir, 'TestVault'),
      getVaultSystemDirectory: async () => path.join(tmpDir, 'TestVault', '.baishou'),
      getRootDirectory: async () => tmpDir,
      getSnapshotsDirectory: async () => path.join(tmpDir, 'snapshots'),
      getJournalsBaseDirectory: async () => journalsDir,
      getSummariesBaseDirectory: async () => path.join(tmpDir, 'TestVault', 'Summaries'),
    };

    const vault: VaultInfo = {
      name: 'TestVault',
      path: path.join(tmpDir, 'TestVault'),
      createdAt: new Date(),
      lastAccessedAt: new Date(),
    };

    mockVaultService = {
      initRegistry: async () => {},
      getActiveVault: () => vault,
      getAllVaults: () => [vault],
      switchVault: async () => {},
      deleteVault: async () => {},
    };

    mockEmbeddingCb = {
      reEmbedDiary: vi.fn().mockResolvedValue(undefined),
      deleteEmbeddingsBySource: vi.fn().mockResolvedValue(undefined),
    };

    service = new ShadowIndexSyncService(
      mockRepo as any,
      mockPathService,
      mockVaultService,
      mockEmbeddingCb,
    );
  });

  afterEach(async () => {
    await fsp.rm(tmpDir, { recursive: true, force: true });
  });

  // 辅助: 写入一个标准 Markdown 日记文件
  async function writeJournal(date: string, content: string, tags: string[] = []) {
    const [year, month] = date.split('-');
    const dir = path.join(journalsDir, year!, month!);
    await fsp.mkdir(dir, { recursive: true });

    const tagLine = tags.length > 0 ? `tags: [${tags.join(', ')}]\n` : '';
    const md = `---\ndate: ${date}\n${tagLine}---\n\n${content}`;
    await fsp.writeFile(path.join(dir, `${date}.md`), md, 'utf8');
  }

  // ── 1. 基本同步：新文件索引 ──
  it('应当为新的日记文件创建影子索引', async () => {
    await writeJournal('2026-03-31', '今天是美好的一天', ['生活', '测试']);

    const result = await service.syncJournal(new Date('2026-03-31T00:00:00.000Z'));

    expect(result.isChanged).toBe(true);
    expect(result.meta).not.toBeNull();
    expect(result.meta!.date).toEqual(new Date('2026-03-31T00:00:00.000Z'));
    expect(result.meta!.tags).toEqual(['生活', '测试']);
    expect(result.meta!.preview).toContain('今天是美好的一天');
    expect(mockRepo._getRecordCount()).toBe(1);
  });

  // ── 2. Hash 脏检测：内容不变时跳过 ──
  it('连续两次同步同一文件时第二次应无变化', async () => {
    await writeJournal('2026-03-30', '内容不变');

    const r1 = await service.syncJournal(new Date('2026-03-30T00:00:00.000Z'));
    expect(r1.isChanged).toBe(true);

    const r2 = await service.syncJournal(new Date('2026-03-30T00:00:00.000Z'));
    expect(r2.isChanged).toBe(false);
  });

  // ── 3. Hash 脏检测：内容变更时触发更新 ──
  it('文件内容变更后应触发重新同步', async () => {
    await writeJournal('2026-03-29', '原始内容');
    await service.syncJournal(new Date('2026-03-29T00:00:00.000Z'));

    // 修改文件内容
    await writeJournal('2026-03-29', '修改后的内容');
    const r2 = await service.syncJournal(new Date('2026-03-29T00:00:00.000Z'));
    expect(r2.isChanged).toBe(true);
    expect(r2.meta!.preview).toContain('修改后的内容');
  });

  // ── 4. 物理文件删除后的孤立索引清理 ──
  it('物理文件被删除后应清理孤立索引', async () => {
    await writeJournal('2026-03-28', '即将消失的日记');
    await service.syncJournal(new Date('2026-03-28T00:00:00.000Z'));
    expect(mockRepo._getRecordCount()).toBe(1);

    // 删除物理文件
    const [year, month] = ['2026', '03'];
    await fsp.unlink(path.join(journalsDir, year, month, '2026-03-28.md'));

    const result = await service.syncJournal(new Date('2026-03-28T00:00:00.000Z'));
    expect(result.isChanged).toBe(true);
    expect(result.meta).toBeNull(); // 删除操作没有元数据返回
    expect(mockRepo._getRecordCount()).toBe(0);

    // 验证 RAG 清理回调被调用
    expect(mockEmbeddingCb.deleteEmbeddingsBySource).toHaveBeenCalled();
  });

  // ── 5. 不存在的文件且无索引 → 无变化 ──
  it('目标文件和索引都不存在时应返回无变化', async () => {
    const result = await service.syncJournal(new Date('2099-01-01T00:00:00.000Z'));
    expect(result.isChanged).toBe(false);
  });

  // ── 6. 全量扫描 ──
  it('fullScanVault 应扫描所有物理文件并写入索引', async () => {
    await writeJournal('2026-01-15', '一月的日记');
    await writeJournal('2026-02-20', '二月的日记');
    await writeJournal('2026-03-31', '三月的日记');

    await service.fullScanVault(true);

    expect(mockRepo._getRecordCount()).toBe(3);
  });

  // ── 7. 全量扫描的孤立清理 ──
  it('fullScanVault 应清理数据库中的孤立记录', async () => {
    // 先建两条索引
    await writeJournal('2026-04-01', '保留的日记');
    await writeJournal('2026-04-02', '将被删除的日记');

    await service.fullScanVault(true);
    expect(mockRepo._getRecordCount()).toBe(2);

    // 删除第二个文件
    await fsp.unlink(path.join(journalsDir, '2026', '04', '2026-04-02.md'));

    // 再次全扫
    await service.fullScanVault(true);
    expect(mockRepo._getRecordCount()).toBe(1);
  });

  // ── 8. 同步禁用 ──
  it('禁用同步后 syncJournal 和 fullScanVault 应提早返回', async () => {
    await writeJournal('2026-05-01', '不会被索引的日记');

    service.setSyncEnabled(false);

    const result = await service.syncJournal(new Date('2026-05-01T00:00:00.000Z'));
    expect(result.isChanged).toBe(false);

    await service.fullScanVault();
    expect(mockRepo._getRecordCount()).toBe(0);
  });

  // ── 9. RAG 嵌入回调 ──
  it('同步时应异步触发 RAG 嵌入回调', async () => {
    await writeJournal('2026-06-01', '触发 RAG 的日记', ['AI']);

    await service.syncJournal(new Date('2026-06-01T00:00:00.000Z'));

    // 给异步回调一点时间完成
    await new Promise(r => setTimeout(r, 100));

    expect(mockEmbeddingCb.reEmbedDiary).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('触发 RAG 的日记'),
        tags: ['AI'],
      })
    );
  });

  // ── 10. 重复扫描防护 ──
  it('并发 fullScanVault 调用应被跳过', async () => {
    await writeJournal('2026-07-01', '并发测试');

    // 启动两个并发扫描
    const p1 = service.fullScanVault(true);
    const p2 = service.fullScanVault(true); // 应被跳过

    await Promise.all([p1, p2]);
    // 只要不 throw 就算成功
    expect(mockRepo._getRecordCount()).toBe(1);
  });

  // ── 11. 同步事件广播 ──
  it('同步时应广播事件给注册的监听器', async () => {
    const events: any[] = [];
    service.onSyncEvent((event) => events.push(event));

    await writeJournal('2026-08-01', '事件测试');
    await service.syncJournal(new Date('2026-08-01T00:00:00.000Z'));

    expect(events.length).toBe(1);
    expect(events[0].result.isChanged).toBe(true);
  });

  // ── 12. 无 Frontmatter 的纯文本文件 ──
  it('应能处理无 Frontmatter 的纯 Markdown 文件', async () => {
    const [year, month] = ['2026', '09'];
    const dir = path.join(journalsDir, year, month);
    await fsp.mkdir(dir, { recursive: true });
    await fsp.writeFile(
      path.join(dir, '2026-09-15.md'),
      '这是没有 Frontmatter 的纯文本日记',
      'utf8'
    );

    const result = await service.syncJournal(new Date('2026-09-15T00:00:00.000Z'));
    expect(result.isChanged).toBe(true);
    expect(result.meta!.preview).toContain('这是没有 Frontmatter 的纯文本日记');
  });
});
