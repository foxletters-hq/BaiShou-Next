import * as fs from 'fs/promises'
import * as path from 'path'
import { app } from 'electron'
import type { SessionInputRecord } from '@baishou/shared'
import {
  MemorySessionInboxStore,
  setSessionInboxStore,
  type SessionInboxStore
} from '@baishou/ai'

const PERSIST_DEBOUNCE_MS = 75

/**
 * 文件持久化的 SessionInboxStore。
 *
 * 约定：业务入口须先 `await initDesktopSessionInboxStore()`（启动时已 await ready），
 * 之后 list/get/upsert/delete/nextSeq 可同步读写内存；persist 经 loadPromise 串行化，
 * upsert/delete 触发 debounce 写盘（短时间多次变更 coalesce 为一次）。
 */
class FileSessionInboxStore implements SessionInboxStore {
  private readonly memory = new MemorySessionInboxStore()
  private filePath: string | null = null
  /** 单次 hydrate；所有读写链到同一 promise */
  private loadPromise: Promise<void> | null = null
  /** 串行化磁盘写入，避免并发 persist 互相覆盖 */
  private persistChain: Promise<void> = Promise.resolve()
  private persistTimer: ReturnType<typeof setTimeout> | null = null
  private dirty = false

  private resolvePath(): string {
    if (!this.filePath) {
      this.filePath = path.join(app.getPath('userData'), 'session-runtime', 'inbox.json')
    }
    return this.filePath
  }

  private ensureLoaded(): Promise<void> {
    if (!this.loadPromise) {
      this.loadPromise = this.hydrateFromDisk()
    }
    return this.loadPromise
  }

  private async hydrateFromDisk(): Promise<void> {
    try {
      const raw = await fs.readFile(this.resolvePath(), 'utf8')
      const parsed = JSON.parse(raw) as { records?: SessionInputRecord[] }
      if (!Array.isArray(parsed.records)) return
      const pending = parsed.records.filter((r) => r && r.status === 'pending')
      // 仅首次 load：不覆盖已有内存记录（防止 hydrate 完成前的 upsert 被盘上旧数据盖掉）
      for (const r of pending) {
        if (this.memory.get(r.id)) continue
        this.memory.upsert(r)
      }
    } catch {
      /* missing file ok */
    }
  }

  private enqueuePersistWrite(): void {
    const prev = this.persistChain
    this.persistChain = this.ensureLoaded()
      .then(() => prev)
      .then(async () => {
        if (!this.dirty) return
        this.dirty = false
        const file = this.resolvePath()
        await fs.mkdir(path.dirname(file), { recursive: true })
        const pending = this.memory.dumpPending()
        // compact JSON：减小体积与写盘成本
        await fs.writeFile(file, JSON.stringify({ records: pending }), 'utf8')
      })
      .catch(() => {
        /* persist best-effort */
      })
  }

  private schedulePersist(): void {
    this.dirty = true
    if (this.persistTimer != null) return
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null
      this.enqueuePersistWrite()
    }, PERSIST_DEBOUNCE_MS)
  }

  /** 取消 debounce 并确保脏数据写入完成（进程退出前调用） */
  async flush(): Promise<void> {
    if (this.persistTimer != null) {
      clearTimeout(this.persistTimer)
      this.persistTimer = null
    }
    if (this.dirty) {
      this.enqueuePersistWrite()
    }
    await this.persistChain
  }

  list(sessionId: string): SessionInputRecord[] {
    // ready() / init 完成后可读；hydrate 前调用可能看不到盘上 pending
    return this.memory.list(sessionId)
  }

  get(id: string): SessionInputRecord | null {
    return this.memory.get(id)
  }

  upsert(record: SessionInputRecord): void {
    // 先写内存，保证 admit 后立刻 listPending 可见
    this.memory.upsert(record)
    this.schedulePersist()
  }

  delete(id: string): void {
    this.memory.delete(id)
    this.schedulePersist()
  }

  nextSeq(sessionId: string): number {
    return this.memory.nextSeq(sessionId)
  }

  async ready(): Promise<void> {
    await this.ensureLoaded()
  }
}

let desktopInboxStore: FileSessionInboxStore | null = null

export async function initDesktopSessionInboxStore(): Promise<void> {
  if (!desktopInboxStore) {
    desktopInboxStore = new FileSessionInboxStore()
    setSessionInboxStore(desktopInboxStore)
  }
  await desktopInboxStore.ready()
}

/** 进程退出前 flush debounce 中的脏写入 */
export async function flushDesktopSessionInboxStore(): Promise<void> {
  if (!desktopInboxStore) return
  await desktopInboxStore.flush()
}
