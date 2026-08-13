import type {
  AdmitSessionInputParams,
  SessionInputDelivery,
  SessionInputRecord,
  SessionInputStatus
} from '@baishou/shared'

export interface SessionInboxStore {
  list(sessionId: string): SessionInputRecord[]
  get(id: string): SessionInputRecord | null
  upsert(record: SessionInputRecord): void
  delete(id: string): void
  /** 下一 admittedSeq */
  nextSeq(sessionId: string): number
}

export class MemorySessionInboxStore implements SessionInboxStore {
  private readonly byId = new Map<string, SessionInputRecord>()
  private readonly seqBySession = new Map<string, number>()

  list(sessionId: string): SessionInputRecord[] {
    return [...this.byId.values()]
      .filter((r) => r.sessionId === sessionId)
      .sort((a, b) => a.admittedSeq - b.admittedSeq)
  }

  get(id: string): SessionInputRecord | null {
    return this.byId.get(id) ?? null
  }

  upsert(record: SessionInputRecord): void {
    this.byId.set(record.id, record)
    const cur = this.seqBySession.get(record.sessionId) ?? 0
    if (record.admittedSeq >= cur) this.seqBySession.set(record.sessionId, record.admittedSeq + 1)
  }

  delete(id: string): void {
    this.byId.delete(id)
  }

  nextSeq(sessionId: string): number {
    const cur = this.seqBySession.get(sessionId) ?? 0
    this.seqBySession.set(sessionId, cur + 1)
    return cur
  }

  /** 测试/恢复：批量灌入 */
  hydrate(records: SessionInputRecord[]): void {
    for (const r of records) this.upsert(r)
  }

  clear(): void {
    this.byId.clear()
    this.seqBySession.clear()
  }

  dumpPending(): SessionInputRecord[] {
    return [...this.byId.values()].filter((r) => r.status === 'pending')
  }
}

let defaultInboxStore: SessionInboxStore = new MemorySessionInboxStore()

export function getSessionInboxStore(): SessionInboxStore {
  return defaultInboxStore
}

export function setSessionInboxStore(store: SessionInboxStore): void {
  defaultInboxStore = store
}

export function resetSessionInboxStoreForTests(): void {
  defaultInboxStore = new MemorySessionInboxStore()
}

function newId(): string {
  return `sin_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export class SessionInbox {
  constructor(private readonly store: SessionInboxStore = getSessionInboxStore()) {}

  admit(params: AdmitSessionInputParams): SessionInputRecord {
    const delivery: SessionInputDelivery = params.delivery === 'steer' ? 'steer' : 'queue'
    const record: SessionInputRecord = {
      id: newId(),
      sessionId: params.sessionId,
      delivery,
      text: params.text,
      status: 'pending',
      userMessageId: params.userMessageId,
      admittedAt: Date.now(),
      admittedSeq: this.store.nextSeq(params.sessionId),
      payload: params.payload
    }
    this.store.upsert(record)
    return record
  }

  listPending(sessionId: string): SessionInputRecord[] {
    return this.store.list(sessionId).filter((r) => r.status === 'pending')
  }

  cancelInput(inputId: string): SessionInputRecord | null {
    const cur = this.store.get(inputId)
    if (!cur || cur.status !== 'pending') return null
    const next = { ...cur, status: 'cancelled' as SessionInputStatus }
    this.store.upsert(next)
    return next
  }

  cancelAllPending(sessionId: string): SessionInputRecord[] {
    const cancelled: SessionInputRecord[] = []
    for (const input of this.listPending(sessionId)) {
      const next = this.cancelInput(input.id)
      if (next) cancelled.push(next)
    }
    return cancelled
  }

  /**
   * 提升下一条：steer 优先于 queue；同 delivery 按 admittedSeq。
   */
  promoteNext(sessionId: string): SessionInputRecord | null {
    const pending = this.listPending(sessionId)
    if (pending.length === 0) return null
    const steer = pending.filter((r) => r.delivery === 'steer')
    const pick = (steer.length > 0 ? steer : pending)[0]
    if (!pick) return null
    const next: SessionInputRecord = {
      ...pick,
      status: 'promoted',
      promotedAt: Date.now()
    }
    this.store.upsert(next)
    return next
  }

  markFailed(inputId: string): void {
    const cur = this.store.get(inputId)
    if (!cur) return
    this.store.upsert({ ...cur, status: 'failed' })
  }
}

let sharedInbox: SessionInbox | null = null

export function getSharedSessionInbox(): SessionInbox {
  if (!sharedInbox) sharedInbox = new SessionInbox()
  return sharedInbox
}

export function resetSharedSessionInboxForTests(): void {
  sharedInbox = null
  resetSessionInboxStoreForTests()
}
