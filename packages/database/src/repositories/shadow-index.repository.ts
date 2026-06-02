import type { AppDatabase } from '../types'
import { ShadowIndexQueryOps } from './shadow-index.repository.queries'
import { ShadowIndexUpsertOps, normalizeShadowFilePath } from './shadow-index.repository.upsert'

export type {
  ShadowJournalRecord,
  UpsertShadowIndexPayload,
  ShadowFTSResult,
  DiaryListFilterOptions
} from './shadow-index.repository.types'

export { normalizeShadowFilePath } from './shadow-index.repository.upsert'

/**
 * Shadow Index Repository
 *
 * 像素级还原原版 `ShadowIndexDatabase` 的全部 CRUD 能力。
 *
 * 核心设计理念：
 * - 影子索引是可被安全重建的——它只是物理文件的元数据镜像
 * - FTS5 表（journals_fts）跟随影子索引同步更新，确保全文搜索始终一致
 * - 所有方法通过注入的 AppDatabase 操作，不持有全局单例
 * - FTS 操作使用 libsql 裸 SQL（Drizzle 不直接支持 FTS5 虚拟表）
 *
 * 注意：此 Repository 操作的是 shadow_index.db 中的 `journals_index` 和 `journals_fts` 表，
 *       由 ShadowIndexConnectionManager connect() 后传入的 AppDatabase 实例来驱动。
 */
export class ShadowIndexRepository {
  private readonly upsertOps: ShadowIndexUpsertOps
  private readonly queryOps: ShadowIndexQueryOps

  constructor(database: AppDatabase) {
    this.upsertOps = new ShadowIndexUpsertOps(database)
    this.queryOps = new ShadowIndexQueryOps(database)
  }

  async upsert(...args: Parameters<ShadowIndexUpsertOps['upsert']>) {
    return this.upsertOps.upsert(...args)
  }

  async batchUpsert(...args: Parameters<ShadowIndexUpsertOps['batchUpsert']>) {
    return this.upsertOps.batchUpsert(...args)
  }

  async deleteById(...args: Parameters<ShadowIndexUpsertOps['deleteById']>) {
    return this.upsertOps.deleteById(...args)
  }

  async findByDatePrefix(...args: Parameters<ShadowIndexQueryOps['findByDatePrefix']>) {
    return this.queryOps.findByDatePrefix(...args)
  }

  async findByDateRange(...args: Parameters<ShadowIndexQueryOps['findByDateRange']>) {
    return this.queryOps.findByDateRange(...args)
  }

  async getHashByDate(...args: Parameters<ShadowIndexQueryOps['getHashByDate']>) {
    return this.queryOps.getHashByDate(...args)
  }

  async getAllRecords(...args: Parameters<ShadowIndexQueryOps['getAllRecords']>) {
    return this.queryOps.getAllRecords(...args)
  }

  async searchFTS(...args: Parameters<ShadowIndexQueryOps['searchFTS']>) {
    return this.queryOps.searchFTS(...args)
  }

  async listFiltered(...args: Parameters<ShadowIndexQueryOps['listFiltered']>) {
    return this.queryOps.listFiltered(...args)
  }

  async countFiltered(...args: Parameters<ShadowIndexQueryOps['countFiltered']>) {
    return this.queryOps.countFiltered(...args)
  }

  async findByIds(...args: Parameters<ShadowIndexQueryOps['findByIds']>) {
    return this.queryOps.findByIds(...args)
  }

  async findById(...args: Parameters<ShadowIndexQueryOps['findById']>) {
    return this.queryOps.findById(...args)
  }

  async findByDate(...args: Parameters<ShadowIndexQueryOps['findByDate']>) {
    return this.queryOps.findByDate(...args)
  }

  async listAllWithFTS(...args: Parameters<ShadowIndexQueryOps['listAllWithFTS']>) {
    return this.queryOps.listAllWithFTS(...args)
  }

  async listAll(...args: Parameters<ShadowIndexQueryOps['listAll']>) {
    return this.queryOps.listAll(...args)
  }

  async count(...args: Parameters<ShadowIndexQueryOps['count']>) {
    return this.queryOps.count(...args)
  }

  async getActivityData(...args: Parameters<ShadowIndexQueryOps['getActivityData']>) {
    return this.queryOps.getActivityData(...args)
  }
}
