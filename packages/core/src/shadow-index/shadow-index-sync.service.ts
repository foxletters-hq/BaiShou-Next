import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

import {
  ShadowIndexRepository,
  UpsertShadowIndexPayload,
} from '@baishou/database';
import { formatLocalDate, parseDateStr } from '@baishou/shared';

import { IStoragePathService } from '../vault/storage-path.types';
import { IVaultService } from '../vault/vault.types';

// ── 类型定义 ──────────────────────────────

/**
 * 日记同步结果。
 * 对标原版 `JournalSyncResult`
 */
export interface JournalSyncResult {
  /** 变动后的最新元数据快照 (如果是删除则为 null) */
  meta: DiaryMeta | null;
  /** 是否真正发生了变动 (内容更新或删除) */
  isChanged: boolean;
}

/**
 * 简化的日记元数据视图 —— 仅含影子快照中上层 UI 需要的字段
 * 对标原版 `DiaryMeta`
 */
export interface DiaryMeta {
  id: number;
  date: Date;
  preview: string;
  tags: string[];
  updatedAt: Date;
}

/**
 * 同步事件载体 (广播给 Repository / VaultIndex 等消费者)
 */
export interface JournalSyncEvent {
  filePath: string;
  result: JournalSyncResult;
}

/**
 * RAG 嵌入回调接口
 * 
 * 影子索引本身不直接依赖 AI 包，而是通过此回调将嵌入责任上移。
 * 这解决了 `@baishou/core` 与 `@baishou/ai` 的循环依赖问题。
 */
export interface IEmbeddingCallback {
  reEmbedDiary(params: {
    diaryId: number;
    content: string;
    tags: string[];
    date: Date;
    updatedAt: Date;
  }): Promise<void>;

  deleteEmbeddingsBySource(sourceType: string, sourceId: string): Promise<void>;
}

/**
 * Markdown Frontmatter 解析后的日记结构体
 */
interface ParsedJournal {
  id: number;
  date: Date;
  content: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  weather?: string;
  mood?: string;
  location?: string;
  locationDetail?: string;
  isFavorite: boolean;
  mediaPaths: string[];
}

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
    console.log(`[ShadowSync] 同步功能已${enabled ? '启用' : '禁用'}`);
  }

  /**
   * 等待当前正在进行的全量扫描完成
   * 对标原版 `waitForScan()`
   */
  async waitForScan(): Promise<void> {
    if (this._scanPromise) {
      console.log('[ShadowSync] 等待正在进行的扫描完成...');
      await this._scanPromise;
      console.log('[ShadowSync] 扫描已完成');
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
   * 
   * 对标原版 `syncJournal()` —— 这是整个影子索引系统的原子同步单元。
   * 
   * 流程：
   * 1. 检查物理文件是否存在
   * 2. 若不存在 → 检测孤立索引并清理（含 RAG 碎片）
   * 3. 若存在 → 计算 MD5 Hash 与数据库中的 Hash 比对
   * 4. Hash 不匹配 → 完整解析 Markdown Frontmatter → Upsert 影子索引
   * 5. 异步触发 RAG 向量嵌入
   * 
   * @param date 目标日期
   * @param skipRag 是否跳过 RAG 嵌入（全量恢复时应设为 true 防止请求风暴）
   */
  async syncJournal(date: Date, skipRag = false): Promise<JournalSyncResult> {
    if (this._isSyncDisabled) {
      return { meta: null, isChanged: false };
    }

    const journalBase = await this.pathService.getJournalsBaseDirectory();
    const filePath = this._getJournalFilePath(journalBase, date);
    const dayStr = this._formatDayStr(date);
    // DB date 字段统一存 YYYY-MM-DD（本地时区）
    const dateKey = formatLocalDate(date);

    // ── Step 1: 物理文件不存在的孤立检测 ──
    if (!fs.existsSync(filePath)) {
      const existingRows = await this.shadowRepo.findByDatePrefix(dayStr);

      if (existingRows.length > 0) {
        // 发现孤儿索引，逐条执行物理清理
        for (const row of existingRows) {
          await this.shadowRepo.deleteById(row.id);

          // 同步清理 RAG 记忆中这篇日记留下的碎片
          if (this.embeddingCallback) {
            try {
              await this.embeddingCallback.deleteEmbeddingsBySource(
                'diary',
                row.id.toString()
              );
            } catch (e: any) {
              console.warn(`[ShadowSync] 清理 RAG 向量失败 (ID=${row.id}):`, e.message);
            }
          }

          console.log(`[ShadowSync] 已清理孤立索引 ID=${row.id} (日期: ${dayStr})`);
        }
        return { meta: null, isChanged: true };
      }
      return { meta: null, isChanged: false };
    }

    // ── Step 2: Hash 脏检测 ──
    const currentHash = await this._computeFileHash(filePath);
    const existingHash = await this.shadowRepo.getHashByDate(dateKey);

    if (existingHash !== null && existingHash === currentHash) {
      // 内容无变化，跳过
      return { meta: null, isChanged: false };
    }

    console.log(
      `[ShadowSync] Hash 不匹配或新建，执行完整解析: ${dayStr}`
    );

    // ── Step 3: 完整解析 Markdown 文件 ──
    const rawContent = await fsp.readFile(filePath, 'utf8');
    const diary = this._parseJournalMarkdown(rawContent, date);

    if (!diary) {
      return { meta: null, isChanged: false };
    }

    // ── Step 4: Upsert 影子索引 ──
    const relFilePath = path.relative(
      path.dirname(journalBase),
      filePath
    );

    const payload: UpsertShadowIndexPayload = {
      id: diary.id || undefined,
      filePath: relFilePath,
      // date 存 YYYY-MM-DD 本地日期字符串，与文件名一一对应，便于前缀查询
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
    };

    const upsertedId = await this.shadowRepo.upsert(payload);
    console.log(`[ShadowSync] Upsert 完成, ID=${upsertedId}, date=${dayStr}`);

    // ── Step 5: 异步触发 RAG 向量嵌入 ──
    if (!skipRag && this.embeddingCallback) {
      this._triggerEmbeddingAsync({
        ...diary,
        id: upsertedId,
      });
    }

    // 构建返回元数据
    const meta: DiaryMeta = {
      id: upsertedId,
      date: diary.date,
      preview: diary.content.length > 120
        ? diary.content.substring(0, 120)
        : diary.content,
      tags: diary.tags,
      updatedAt: diary.updatedAt,
    };

    // 广播同步事件
    const event: JournalSyncEvent = {
      filePath: relFilePath,
      result: { meta, isChanged: true },
    };
    for (const listener of this._listeners) {
      try { listener(event); } catch { /* 非阻塞 */ }
    }

    return { meta, isChanged: true };
  }

  /**
   * 全量空间扫描
   *
   * 对标原版 `fullScanVault()` —— "影子索引"架构的兜底同步机制：
   * 当用户更换设备拷入文件、或者数据库意外损坏时，
   * 该方法会递归物理磁盘，将所有 Markdown 文件重新解析并强行对齐到 SQLite 中。
   *
   * @param skipRag 是否跳过触发 RAG 同步（大批量数据还原时必带以防止请求风暴）
   */
  async fullScanVault(skipRag = false): Promise<void> {
    if (this._isSyncDisabled) {
      console.log('[ShadowSync] 同步已禁用，跳过全量扫描');
      return;
    }

    if (this._isScanning) {
      console.log('[ShadowSync] 另一个扫描正在进行，跳过');
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

      // 1. 收集所有符合 yyyy-MM-dd.md 格式的物理文件
      const dateFileRegex = /^(\d{4}-\d{2}-\d{2})\.md$/;
      const targetFiles: string[] = [];

      if (fs.existsSync(journalsDir)) {
        await this._walkDir(journalsDir, (filePath) => {
          const fileName = path.basename(filePath);
          if (dateFileRegex.test(fileName)) {
            targetFiles.push(filePath);
          }
        });
      }

      // 2. 串行同步每个文件
      const scannedDates = new Set<string>();

      for (const file of targetFiles) {
        try {
          const fileName = path.basename(file);
          const match = dateFileRegex.exec(fileName);
          if (match && match[1]) {
            scannedDates.add(match[1]);
            const date = new Date(match[1] + 'T00:00:00.000Z');
            await this.syncJournal(date, skipRag);
          }
        } catch (e) {
          // 单个文件失败不阻塞整体流程
          continue;
        }
      }

      // 3. 【关键】清理孤立索引 (Orphaned Index Cleanup)
      //
      // 对标原版修复逻辑：
      // ⚠️ 不能使用 scannedDates 集合来判断孤立——因为 fullScanVault 是异步执行的，
      //    在文件列举期间 saveDiary 可能创建了新文件，scannedDates 不包含它，
      //    会导致刚保存的日记被误判为孤立索引而删除！
      //    修复方案：在清理前实时检查物理文件是否存在。
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
              console.warn(
                `[ShadowSync] 清理孤立 RAG 向量失败 (ID=${record.id}):`,
                e.message
              );
            }
          }

          console.log(
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
   * 解析 Markdown 文件内容（含 Frontmatter）
   * 
   * 支持标准的 `---` 分隔的 YAML Frontmatter 格式：
   * ```
   * ---
   * id: 42
   * date: 2026-03-31
   * tags: [日记, 生活]
   * weather: 晴
   * mood: 开心
   * ---
   * 日记正文内容...
   * ```
   */
  private _parseJournalMarkdown(raw: string, fallbackDate: Date): ParsedJournal | null {
    const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
    const match = raw.match(frontmatterRegex);

    const content = match ? (match[2] || '').trim() : raw.trim();
    if (!content) return null;

    const meta: Record<string, string> = {};
    if (match && match[1]) {
      for (const line of match[1].split('\n')) {
        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) continue;
        const key = line.substring(0, colonIdx).trim();
        const val = line.substring(colonIdx + 1).trim();
        if (key) meta[key] = val;
      }
    }

    // 解析标签
    let tags: string[] = [];
    if (meta['tags']) {
      const tagStr = meta['tags'].replace(/^\[/, '').replace(/\]$/, '');
      tags = tagStr.split(',').map(s => s.trim()).filter(Boolean);
    }

    // 解析日期：使用本地时区（禁止 new Date('YYYY-MM-DD') 会被解析为 UTC）
    const dateStr = meta['date'];
    const parsedDate = dateStr ? parseDateStr(dateStr) : fallbackDate;

    // 解析媒体路径
    let mediaPaths: string[] = [];
    if (meta['mediaPaths'] || meta['media_paths']) {
      try {
        mediaPaths = JSON.parse(meta['mediaPaths'] || meta['media_paths'] || '[]');
      } catch { /* ignore */ }
    }

    const now = new Date();
    return {
      id: meta['id'] ? Number(meta['id']) : 0,
      date: parsedDate,
      content,
      tags,
      createdAt: meta['created_at'] ? new Date(meta['created_at']) : (meta['date'] ? parsedDate : now),
      updatedAt: meta['updated_at'] ? new Date(meta['updated_at']) : now,
      weather: meta['weather'] || undefined,
      mood: meta['mood'] || undefined,
      location: meta['location'] || undefined,
      locationDetail: meta['location_detail'] || undefined,
      isFavorite: meta['is_favorite'] === 'true' || meta['isFavorite'] === 'true',
      mediaPaths,
    };
  }

  /**
   * 异步触发日记内容的 RAG 向量嵌入
   *
   * 对标原版 `_triggerEmbeddingAsync()` ——
   * 这是整个系统中日记 Embedding 的**唯一触发源**。
   * 无论日记是通过 UI 编辑器、Agent diary_edit 工具、局域网同步、
   * 还是用户用外部编辑器手动修改 .md 文件，都会经过此方法。
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
        console.log(`[ShadowSync] RAG 嵌入完成: ${dayStr}`);
      } catch (e: any) {
        console.warn(`[ShadowSync] RAG 嵌入失败:`, e.message);
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
