import {
  ShadowIndexRepository,
  UpsertShadowIndexPayload,
  normalizeShadowFilePath
} from '@baishou/database'
import { parseDateStr, DiaryMeta, logger } from '@baishou/shared'

import type { IFileSystem } from '../fs/file-system.types'
import { md5Hex } from '../fs/md5'
import * as path from '../fs/path.util'
import { IStoragePathService } from '../vault/storage-path.types'
import { IVaultService } from '../vault/vault.types'
import {
  JournalSyncResult,
  JournalSyncEvent,
  IEmbeddingCallback,
  ParsedJournal
} from './shadow-index-sync.types'
import { parseJournalMarkdown } from './shadow-index-sync.utils'
import {
  buildCanonicalJournalFilePath,
  resolveJournalFilePath
} from '../journal/journal-files.util'

export type { IEmbeddingCallback }

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
export type ShadowScanProgress = {
  indexed: number
  total: number
}

export class ShadowIndexSyncService {
  private _isScanning = false
  private _isSyncDisabled = false
  private _scanPromise: Promise<void> | null = null

  /** 同步事件监听者回调池 */
  private _listeners: Array<(event: JournalSyncEvent) => void> = []
  private _progressListeners: Array<(progress: ShadowScanProgress) => void> = []

  constructor(
    private readonly shadowRepo: ShadowIndexRepository,
    private readonly pathService: IStoragePathService,
    private readonly vaultService: IVaultService,
    private readonly fileSystem: IFileSystem,
    private readonly embeddingCallback?: IEmbeddingCallback
  ) {}

  // ── 公开 API ────────────────────────────

  /**
   * 外部手动开启或关闭自动同步功能（例如导入期间暂停同步）
   * 对标原版 `setSyncEnabled()`
   */
  setSyncEnabled(enabled: boolean): void {
    this._isSyncDisabled = !enabled
    logger.info(`[ShadowSync] 同步功能已${enabled ? '启用' : '禁用'}`)
  }

  /**
   * 等待当前正在进行的全量扫描完成
   * 对标原版 `waitForScan()`
   */
  async waitForScan(): Promise<void> {
    if (this._scanPromise) {
      logger.info('[ShadowSync] 等待正在进行的扫描完成...')
      await this._scanPromise
      logger.info('[ShadowSync] 扫描已完成')
    }
  }

  /**
   * 注册同步事件监听器
   * 返回取消注册的函数
   */
  onSyncEvent(listener: (event: JournalSyncEvent) => void): () => void {
    this._listeners.push(listener)
    return () => {
      const idx = this._listeners.indexOf(listener)
      if (idx !== -1) this._listeners.splice(idx, 1)
    }
  }

  onScanProgress(listener: (progress: ShadowScanProgress) => void): () => void {
    this._progressListeners.push(listener)
    return () => {
      const idx = this._progressListeners.indexOf(listener)
      if (idx !== -1) this._progressListeners.splice(idx, 1)
    }
  }

  get isScanning(): boolean {
    return this._isScanning
  }

  private _emitScanProgress(progress: ShadowScanProgress): void {
    for (const listener of this._progressListeners) {
      try {
        listener(progress)
      } catch {}
    }
  }

  /**
   * 触发单条日记的强同步
   */
  async syncJournal(dateStr: string, skipRag = false): Promise<JournalSyncResult> {
    const results = await this.syncJournalsBatch([dateStr], skipRag)
    return results[0] || { meta: null, isChanged: false }
  }

  /**
   * 批量触发日记的并行同步 (内存并行 Hash计算/文件读取 + DB 批量事务)
   * 专治极端压测或拖拽多文件并发引起的 SQLite 拥堵与损坏
   */
  async syncJournalsBatch(
    dateStrs: string[],
    skipRag = false,
    options?: { pathsByDate?: ReadonlyMap<string, string> }
  ): Promise<JournalSyncResult[]> {
    if (this._isSyncDisabled || dateStrs.length === 0) {
      return dateStrs.map(() => ({ meta: null, isChanged: false }))
    }

    const journalBase = await this.pathService.getJournalsBaseDirectory()
    const results: JournalSyncResult[] = []
    const CHUNK_SIZE = 100 // 内存并发阈值

    for (let i = 0; i < dateStrs.length; i += CHUNK_SIZE) {
      const chunk = dateStrs.slice(i, i + CHUNK_SIZE)
      const payloads: UpsertShadowIndexPayload[] = []
      const parsedDiaries: ParsedJournal[] = []
      const events: JournalSyncEvent[] = []
      const idsToDelete: { id: number; dateStr: string }[] = []
      const existingHashes = await this.shadowRepo.getHashesByDates(chunk)

      await Promise.all(
        chunk.map(async (dateStr) => {
          const filePath = await resolveJournalFilePath(
            this.fileSystem,
            journalBase,
            dateStr,
            options?.pathsByDate?.get(dateStr)
          )
          const dateKey = dateStr

          // ── 1. 孤立检测 ──
          if (!filePath) {
            const existingRows = await this.shadowRepo.findByDatePrefix(dateStr)
            if (existingRows.length > 0) {
              for (const row of existingRows) {
                idsToDelete.push({ id: row.id, dateStr })
              }
              results.push({ meta: null, isChanged: true })
              events.push({
                filePath: buildCanonicalJournalFilePath(journalBase, dateStr),
                result: { meta: null, isChanged: true }
              })
            } else {
              results.push({ meta: null, isChanged: false })
            }
            return
          }

          // ── 2. 单次读盘：Hash 脏检测 + 解析共用同一份内容 ──
          const rawContent = await this.fileSystem.readFile(filePath, 'utf8')
          const currentHash = md5Hex(rawContent)
          const existingHash = existingHashes.get(dateKey) ?? null

          if (existingHash !== null && existingHash === currentHash) {
            results.push({ meta: null, isChanged: false })
            return
          }

          // ── 3. 解析落盘 ──
          const diary = parseJournalMarkdown(rawContent, dateStr)
          if (!diary) {
            results.push({ meta: null, isChanged: false })
            return
          }

          const relFilePath = path.relative(path.dirname(journalBase), filePath)

          payloads.push({
            id: diary.id || undefined,
            filePath: normalizeShadowFilePath(relFilePath),
            date: diary.date,
            createdAt: diary.createdAt.toISOString(),
            updatedAt: diary.updatedAt.toISOString(),
            contentHash: currentHash,
            weather: diary.weather ?? null,
            mood: diary.mood ?? null,
            location: diary.location ?? null,
            locationDetail: diary.locationDetail ?? null,
            isFavorite: diary.isFavorite,
            hasMedia: (diary.mediaPaths?.length ?? 0) > 0,
            rawContent: diary.content ?? '',
            tags: (diary.tags ?? []).join(',')
          })
          parsedDiaries.push(diary)
        })
      )

      // ── 4. 提交物理清退 ──
      for (const req of idsToDelete) {
        await this.shadowRepo.deleteById(req.id)
        logger.info(`[ShadowSync] 已批量清理孤立索引 ID=${req.id} (日期: ${req.dateStr})`)
        if (this.embeddingCallback) {
          try {
            await this.embeddingCallback.deleteEmbeddingsBySource('diary', req.id.toString())
          } catch (e: any) {}
        }
      }

      // ── 5. 提交超重型批量事务 ──
      if (payloads.length > 0) {
        logger.info(`[ShadowSync] 正在开启巨型批量事务，并入 ${payloads.length} 篇日志...`)
        const rowIds = await this.shadowRepo.batchUpsert(payloads)

        for (let j = 0; j < payloads.length; j++) {
          const p = payloads[j]!
          const d = parsedDiaries[j]!
          const id = rowIds[j]!

          if (!skipRag && this.embeddingCallback) {
            this._triggerEmbeddingAsync({ ...d, id })
          }

          const meta: DiaryMeta = {
            id,
            date: parseDateStr(d.date),
            preview:
              (d.content?.length ?? 0) > 120 ? d.content!.substring(0, 120) : (d.content ?? ''),
            tags: d.tags ?? [],
            updatedAt: d.updatedAt,
            weather: d.weather || undefined,
            mood: d.mood || undefined,
            location: d.location || undefined,
            isFavorite: d.isFavorite || false
          }
          const res = { meta, isChanged: true }
          results.push(res)
          events.push({ filePath: p.filePath, result: res })
        }
      }

      // ── 6. 广播事件 ──
      for (const e of events) {
        for (const listener of this._listeners) {
          try {
            listener(e)
          } catch {}
        }
      }
    }

    return results
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
      logger.info('[ShadowSync] 同步已禁用，跳过全量扫描')
      return
    }

    if (this._isScanning) {
      logger.info('[ShadowSync] 另一个扫描正在进行，跳过')
      return
    }

    this._isScanning = true

    let resolvePromise: () => void
    this._scanPromise = new Promise<void>((resolve) => {
      resolvePromise = resolve
    })

    try {
      const activeVault = this.vaultService.getActiveVault()
      if (!activeVault) return

      const journalsDir = await this.pathService.getJournalsBaseDirectory()

      // 1. 收集所有符合 yyyy-MM-dd.md 格式的物理文件日期
      const dateFileRegex = /^(\d{4}-\d{2}-\d{2})\.md$/
      const pathsByDate = new Map<string, string>()

      const journalsDirExists = await this.fileSystem.exists(journalsDir)

      if (journalsDirExists) {
        await this._walkDir(journalsDir, (filePath) => {
          const fileName = path.basename(filePath)
          const match = dateFileRegex.exec(fileName)
          if (!match?.[1]) return

          const dateStr = match[1]
          const canonicalPath = buildCanonicalJournalFilePath(journalsDir, dateStr)
          const existing = pathsByDate.get(dateStr)
          if (!existing || path.resolve(filePath) === path.resolve(canonicalPath)) {
            pathsByDate.set(dateStr, filePath)
          }
        })
      }

      // 2. 将整个文件池放进内存并发分块事务系统中处理
      const uniqueDates = [...pathsByDate.keys()]
      if (uniqueDates.length > 0) {
        logger.info(`[ShadowSync] 全量扫描提取到 ${uniqueDates.length} 份文件，进入并行流水线...`)
        const CHUNK_SIZE = 100
        for (let i = 0; i < uniqueDates.length; i += CHUNK_SIZE) {
          const chunk = uniqueDates.slice(i, i + CHUNK_SIZE)
          await this.syncJournalsBatch(chunk, skipRag, { pathsByDate })
          this._emitScanProgress({
            indexed: Math.min(i + chunk.length, uniqueDates.length),
            total: uniqueDates.length
          })
        }
      }

      // 3. 【关键】清理孤立索引 (Orphaned Index Cleanup)
      const allRecords = await this.shadowRepo.getAllRecords()
      const existingDatesSet = new Set(uniqueDates)

      for (const record of allRecords) {
        const dateStr = record.date.split('T')[0] // 提取 yyyy-MM-dd
        if (!dateStr) continue

        // 不需要再去判断 fs.existsSync(filePath)，直接查 Set！
        if (!existingDatesSet.has(dateStr)) {
          // 物理文件确实不存在，安全执行影子清理
          await this.shadowRepo.deleteById(record.id)

          // 同步清理 RAG 碎片
          if (this.embeddingCallback) {
            try {
              await this.embeddingCallback.deleteEmbeddingsBySource('diary', record.id.toString())
            } catch (e: any) {
              logger.warn(`[ShadowSync] 清理孤立 RAG 向量失败 (ID=${record.id}):`, e.message)
            }
          }

          logger.info(`[ShadowSync] 已清理孤立索引: date=${dateStr}, ID=${record.id}`)
        }
      }
    } finally {
      this._isScanning = false
      resolvePromise!()
      this._scanPromise = null
    }
  }

  // ── 内部方法 ────────────────────────────

  /**
   * 格式化日期为 YYYY-MM-DD 字符串（本地时区）
   * 用于文件前缀查询与日志输出
   */
  private _formatDayStr(dateStr: string): string {
    return dateStr
  }

  /**
   * 异步触发日记内容的 RAG 向量嵌入
   *
   * 对标原版 `_triggerEmbeddingAsync()` ——
   * 这是整个系统中日记 Embedding 的**唯一触发源**。
   */
  private _triggerEmbeddingAsync(diary: ParsedJournal): void {
    if (!this.embeddingCallback) return

    // 使用微任务异步执行，不阻塞同步流程
    const cb = this.embeddingCallback
    void (async () => {
      try {
        await cb.reEmbedDiary({
          diaryId: diary.id,
          content: diary.content,
          tags: diary.tags,
          date: diary.date,
          updatedAt: diary.updatedAt
        })
        const dayStr = this._formatDayStr(diary.date)
        logger.info(`[ShadowSync] RAG 嵌入完成: ${dayStr}`)
      } catch (e: any) {
        logger.warn(`[ShadowSync] RAG 嵌入失败:`, e.message)
      }
    })()
  }

  /**
   * 递归遍历目录树
   */
  private async _walkDir(dir: string, callback: (filePath: string) => void): Promise<void> {
    let entries: string[] = []
    try {
      entries = await this.fileSystem.readdir(dir)
    } catch (e: any) {
      if (e.code === 'ENOENT') return
      throw e
    }
    for (const name of entries) {
      const fullPath = path.join(dir, name)
      try {
        const stat = await this.fileSystem.stat(fullPath)
        if (stat.isDirectory) {
          await this._walkDir(fullPath, callback)
        } else if (stat.isFile) {
          callback(fullPath)
        }
      } catch {
        // 跳过不可读条目，避免单个异常路径导致整次全量扫描失败
      }
    }
  }
}
