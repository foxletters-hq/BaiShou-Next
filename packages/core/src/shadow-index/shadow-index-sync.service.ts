import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

import {
  ShadowIndexRepository,
  UpsertShadowIndexPayload,
} from '@baishou/database';
import { formatLocalDate, DiaryMeta, logger } from '@baishou/shared';

import { IStoragePathService } from '../vault/storage-path.types';
import { IVaultService } from '../vault/vault.types';
import { JournalSyncResult, JournalSyncEvent, IEmbeddingCallback, ParsedJournal } from './shadow-index-sync.types';
import { parseJournalMarkdown } from './shadow-index-sync.utils';

// ── 影子索引同步服务 ──────────────────────

/**
 * 影子索引同步服务 (Shadow Index Sync Service)
 *
 * 像素级还原原版 `shadow_index_sync_service.dart` 的全部逻辑：
 *
 * 1. `syncJournal(date)` — 单条日记的 Hash 比对与强同步
 *    - 检测物理文件存在性 → 孤立索引清理
 *    - MD5 内容指纹比对 → 脏数据检测
 *    - 完整解析 Frontmatter → Upsert 到影子索引 + FTS
 *    - 异步触发 RAG 向量嵌入
 *
 * 2. `fullScanVault()` — 全量物理磁盘扫描
 *    - 递归遍历 Journals 目录下所有 yyyy-MM-dd.md
 *    - 串行 syncJournal 每个文件
 *    - 清理孤立索引 (数据库有但磁盘无的记录)
 *
 * 3. 同步开关 (`setSyncEnabled`) — 导入恢复期间暂停同步防止海量无意义操作
 */
export class ShadowIndexSyncService {
  private _isScanning = false;
  private _isSyncDisabled = false;
  private _scanPromise: Promise<void> | null = null;

  /** 同步事件监听者回调池 */
  private _listeners: Array<(event: JournalSyncEvent) => void> = [];

  constructor(
    private readonly shadowRepo: ShadowIndexRepository,
    private readonly pathService: IStoragePathService,
    private readonly vaultService: IVaultService,
    private readonly embeddingCallback?: IEmbeddingCallback,
  ) {}

  // ── 公开 API ────────────────────────────

  /**
   * 外部手动开启或关闭自动同步功能（例如导入期间暂停同步）
   * 对标原版 `setSyncEnabled()`
   */
  setSyncEnabled(enabled: boolean): void {
    this._isSyncDisabled = !enabled;
    logger.info(`[ShadowSync] 同步功能已${enabled ? '启用' : '禁用'}`);
  }

  /**
   * 等待当前正在进行的全量扫描完成
   * 对标原版 `waitForScan()`
   */
  async waitForScan(): Promise<void> {
    if (this._scanPromise) {
      logger.info('[ShadowSync] 等待正在进行的扫描完成...');
      await this._scanPromise;
      logger.info('[ShadowSync] 扫描已完成');
    }
  }

  /**
   * 注册同步事件监听器
   * 返回取消注册的函数
   */
  onSyncEvent(listener: (event: JournalSyncEvent) => void): () => void {
    this._listeners.push(listener);
    return () => {
      const idx = this._listeners.indexOf(listener);
      if (idx !== -1) this._listeners.splice(idx, 1);
    };
  }

  /**
   * 触发单条日记的强同步
   */
  async syncJournal(date: Date, skipRag = false): Promise<JournalSyncResult> {
    const results = await this.syncJournalsBatch([date], skipRag);
    return results[0] || { meta: null, isChanged: false };
  }

  /**
   * 批量触发日记的并行同步 (内存并行 Hash计算/文件读取 + DB 批量事务)
   * 专治极端压测或拖拽多文件并发引起的 SQLite 拥堵与损坏
   */
  async syncJournalsBatch(dates: Date[], skipRag = false): Promise<JournalSyncResult[]> {
    if (this._isSyncDisabled || dates.length === 0) {
      return dates.map(() => ({ meta: null, isChanged: false }));
    }

    const journalBase = await this.pathService.getJournalsBaseDirectory();
    const results: JournalSyncResult[] = [];
    const CHUNK_SIZE = 50; // 内存并发阈值

    for (let i = 0; i < dates.length; i += CHUNK_SIZE) {
      const chunk = dates.slice(i, i + CHUNK_SIZE);
      const payloads: UpsertShadowIndexPayload[] = [];
      const parsedDiaries: ParsedJournal[] = [];
      const events: JournalSyncEvent[] = [];
      const idsToDelete: {id: number, dateStr: string}[] = [];

      await Promise.all(chunk.map(async (date) => {
        const filePath = this._getJournalFilePath(journalBase, date);
        const dayStr = this._formatDayStr(date);
        const dateKey = formatLocalDate(date);

        // ── 1. 孤立检测 ──
        if (!fs.existsSync(filePath)) {
          const existingRows = await this.shadowRepo.findByDatePrefix(dayStr);
          for (const row of existingRows) {
            idsToDelete.push({ id: row.id, dateStr: dayStr });
          }
          results.push({ meta: null, isChanged: true });
          events.push({ filePath: path.relative(path.dirname(journalBase), filePath), result: { meta: null, isChanged: true } });
          return;
        }

        // ── 2. Hash 脏检测 ──
        const currentHash = await this._computeFileHash(filePath);
        const existingHash = await this.shadowRepo.getHashByDate(dateKey);

        if (existingHash !== null && existingHash === currentHash) {
          results.push({ meta: null, isChanged: false });
          return;
        }

        // ── 3. 解析落盘 ──
        const rawContent = await fsp.readFile(filePath, 'utf8');
        const diary = parseJournalMarkdown(rawContent, date);
        if (!diary) {
          results.push({ meta: null, isChanged: false });
          return;
        }

        const relFilePath = path.relative(path.dirname(journalBase), filePath);
        
        payloads.push({
          id: diary.id || undefined,
          filePath: relFilePath,
          date: formatLocalDate(diary.date),
          createdAt: diary.createdAt.toISOString(),
          updatedAt: diary.updatedAt.toISOString(),
          contentHash: currentHash,
          weather: diary.weather ?? null,
          mood: diary.mood ?? null,
          location: diary.location ?? null,
          locationDetail: diary.locationDetail ?? null,
          isFavorite: diary.isFavorite,
          hasMedia: diary.mediaPaths.length > 0,
          rawContent: diary.content,
          tags: diary.tags.join(','),
        });
        parsedDiaries.push(diary);
      }));

      // ── 4. 提交物理清退 ──
      for (const req of idsToDelete) {
        await this.shadowRepo.deleteById(req.id);
        logger.info(`[ShadowSync] 已批量清理孤立索引 ID=${req.id} (日期: ${req.dateStr})`);
        if (this.embeddingCallback) {
          try {
            await this.embeddingCallback.deleteEmbeddingsBySource('diary', req.id.toString());
          } catch (e: any) { }
        }
      }

      // ── 5. 提交超重型批量事务 ──
      if (payloads.length > 0) {
        logger.info(`[ShadowSync] 正在开启巨型批量事务，并入 ${payloads.length} 篇日志...`);
        const rowIds = await this.shadowRepo.batchUpsert(payloads);
        
        for (let j = 0; j < payloads.length; j++) {
          const p = payloads[j]!;
          const d = parsedDiaries[j]!;
          const id = rowIds[j]!;
          
          if (!skipRag && this.embeddingCallback) {
             this._triggerEmbeddingAsync({ ...d, id });
          }
          
          const meta: DiaryMeta = {
            id,
            date: d.date,
            preview: d.content.length > 120 ? d.content.substring(0, 120) : d.content,
            tags: d.tags,
            updatedAt: d.updatedAt,
            weather: d.weather || undefined,
            mood: d.mood || undefined,
            location: d.location || undefined,
            isFavorite: d.isFavorite || false,
          };
          const res = { meta, isChanged: true };
          results.push(res);
          events.push({ filePath: p.filePath, result: res });
        }
      }

      // ── 6. 广播事件 ──
      for (const e of events) {
         for (const listener of this._listeners) {
           try { listener(e); } catch {}
         }
      }
    }

    return results;
  }


  /**
   * 全量空间扫描
   *
   * 对标原版 `fullScanVault()` —— "影子索引"架构的兜底同步机制：
   * 当用户更换设备拷入文件、或者数据库意外损坏时，
   * 该方法会递归物理磁盘，将所有 Markdown 文件重新解析并强行对齐到 SQLite 中。
   */
  async fullScanVault(skipRag = false): Promise<void> {
    if (this._isSyncDisabled) {
      logger.info('[ShadowSync] 同步已禁用，跳过全量扫描');
      return;
    }

    if (this._isScanning) {
      logger.info('[ShadowSync] 另一个扫描正在进行，跳过');
      return;
    }

    this._isScanning = true;

    let resolvePromise: () => void;
    this._scanPromise = new Promise<void>((resolve) => {
      resolvePromise = resolve;
    });

    try {
      const activeVault = this.vaultService.getActiveVault();
      if (!activeVault) return;

      const journalsDir = path.join(activeVault.path, 'Journals');

      // 1. 收集所有符合 yyyy-MM-dd.md 格式的物理文件日期
      const dateFileRegex = /^(\d{4}-\d{2}-\d{2})\.md$/;
      const targetDates: Date[] = [];

      if (fs.existsSync(journalsDir)) {
        await this._walkDir(journalsDir, (filePath) => {
          const fileName = path.basename(filePath);
          const match = dateFileRegex.exec(fileName);
          if (match && match[1]) {
             targetDates.push(new Date(match[1] + 'T00:00:00.000Z'));
          }
        });
      }

      // 2. 将整个文件池放进内存并发分块事务系统中处理
      if (targetDates.length > 0) {
         logger.info(`[ShadowSync] 全量扫描提取到 ${targetDates.length} 份文件，进入并行流水线...`);
         await this.syncJournalsBatch(targetDates, skipRag);
      }

      // 3. 【关键】清理孤立索引 (Orphaned Index Cleanup)
      const allRecords = await this.shadowRepo.getAllRecords();
      const journalBase = await this.pathService.getJournalsBaseDirectory();

      for (const record of allRecords) {
        const dateStr = record.date.split('T')[0]; // 提取 yyyy-MM-dd
        if (!dateStr) continue;

        // 实时检查物理文件是否存在（而非依赖启动时的快照）
        const recordDate = new Date(dateStr + 'T00:00:00.000Z');
        const filePath = this._getJournalFilePath(journalBase, recordDate);

        if (!fs.existsSync(filePath)) {
          // 物理文件确实不存在，安全执行影子清理
          await this.shadowRepo.deleteById(record.id);

          // 同步清理 RAG 碎片
          if (this.embeddingCallback) {
            try {
              await this.embeddingCallback.deleteEmbeddingsBySource(
                'diary',
                record.id.toString()
              );
            } catch (e: any) {
              logger.warn(
                `[ShadowSync] 清理孤立 RAG 向量失败 (ID=${record.id}):`,
                e.message
              );
            }
          }

          logger.info(
            `[ShadowSync] 已清理孤立索引: date=${dateStr}, ID=${record.id}`
          );
        }
      }
    } finally {
      this._isScanning = false;
      resolvePromise!();
      this._scanPromise = null;
    }
  }

  // ── 内部方法 ────────────────────────────

  /**
   * 计算文件的 MD5 Hash
   * 对标原版 `_computeFileHash()`
   */
  private async _computeFileHash(filePath: string): Promise<string> {
    const content = await fsp.readFile(filePath);
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * 获取特定日期的日记文件物理路径
   * 遵循 yyyy/MM/yyyy-MM-dd.md 存储规约
   */
  private _getJournalFilePath(journalBase: string, date: Date): string {
    // 使用本地时区（对齐原版 Flutter DateFormat）
    const dateStr = formatLocalDate(date);
    const [year, month] = dateStr.split('-');
    return path.join(journalBase, year!, month!, `${dateStr}.md`);
  }

  /**
   * 格式化日期为 YYYY-MM-DD 字符串（本地时区）
   * 用于文件前缀查询与日志输出
   */
  private _formatDayStr(date: Date): string {
    return formatLocalDate(date);
  }

  /**
   * 异步触发日记内容的 RAG 向量嵌入
   *
   * 对标原版 `_triggerEmbeddingAsync()` ——
   * 这是整个系统中日记 Embedding 的**唯一触发源**。
   */
  private _triggerEmbeddingAsync(diary: ParsedJournal): void {
    if (!this.embeddingCallback) return;

    // 使用微任务异步执行，不阻塞同步流程
    const cb = this.embeddingCallback;
    void (async () => {
      try {
        await cb.reEmbedDiary({
          diaryId: diary.id,
          content: diary.content,
          tags: diary.tags,
          date: diary.date,
          updatedAt: diary.updatedAt,
        });
        const dayStr = this._formatDayStr(diary.date);
        logger.info(`[ShadowSync] RAG 嵌入完成: ${dayStr}`);
      } catch (e: any) {
        logger.warn(`[ShadowSync] RAG 嵌入失败:`, e.message);
      }
    })();
  }

  /**
   * 递归遍历目录树
   */
  private async _walkDir(
    dir: string,
    callback: (filePath: string) => void,
  ): Promise<void> {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await this._walkDir(fullPath, callback);
      } else if (entry.isFile()) {
        callback(fullPath);
      }
    }
  }
}
