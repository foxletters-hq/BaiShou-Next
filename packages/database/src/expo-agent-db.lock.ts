/**
 * expo-sqlite（prepareSync）与 runAsync / Drizzle 查询不能并发争用同一连接，
 * 否则 Android 上会触发 NativeDatabase.prepareSync NullPointerException。
 *
 * 采用显式高低双优先级调度器替代 FIFO Promise 链：
 * - 前台 UI 读写默认 `'high'`，后台批量同步/向量落库/图谱抽取显式 `'low'`；
 * - 释放锁时无条件优先唤醒 `'high'` 队列，根除大批量后台写入导致的队头阻塞；
 * - 消除长 Promise 链的闭包内存驻留。
 *
 * 注意（防重入死锁红线）：严禁在已持有锁的回调内部再次请求本锁。
 */

import { logger } from '@baishou/shared'

export type SqliteDriverKind = 'better-sqlite' | 'expo-sync' | 'async'
export type ExpoDbLockPriority = 'high' | 'low'

const SLOW_LOCK_THRESHOLD_MS = 1000

export function detectSqliteDriver(db: unknown): SqliteDriverKind {
  const client = (db as { session?: { client?: Record<string, unknown> } })?.session?.client
  if (client?.prepare !== undefined) return 'better-sqlite'
  if (client?.prepareSync !== undefined) return 'expo-sync'
  return 'async'
}

export function usesSyncTransaction(db: unknown): boolean {
  const kind = detectSqliteDriver(db)
  return kind === 'better-sqlite' || kind === 'expo-sync'
}

/** Agent 主库（expo / drizzle）是否需要 JS 侧串行化 */
export function shouldSerializeExpoAgentDatabase(db: unknown): boolean {
  return detectSqliteDriver(db) !== 'better-sqlite'
}

let isLocked = false
const highWaiters: Array<() => void> = []
const lowWaiters: Array<() => void> = []
const idleWaiters: Array<() => void> = []

function acquireLock(priority: ExpoDbLockPriority): Promise<void> {
  if (!isLocked) {
    isLocked = true
    return Promise.resolve()
  }
  return new Promise<void>((resolve) => {
    if (priority === 'low') {
      lowWaiters.push(resolve)
    } else {
      highWaiters.push(resolve)
    }
  })
}

function releaseLock(): void {
  // 无条件优先唤醒 high 队首，并保持 isLocked=true 防止微任务切换期间被新 low 任务抢跑
  const next = highWaiters.shift() ?? lowWaiters.shift()
  if (next) {
    next()
    return
  }

  isLocked = false
  if (idleWaiters.length > 0) {
    const waiters = idleWaiters.splice(0, idleWaiters.length)
    for (const resolve of waiters) {
      resolve()
    }
  }
}

async function runWithPriorityLock<T>(
  priority: ExpoDbLockPriority,
  fn: () => Promise<T>,
  label?: string
): Promise<T> {
  const queuedAt = Date.now()
  await acquireLock(priority)
  const acquiredAt = Date.now()
  const waitMs = acquiredAt - queuedAt
  try {
    return await fn()
  } finally {
    const holdMs = Date.now() - acquiredAt
    const highQueued = highWaiters.length
    const lowQueued = lowWaiters.length
    releaseLock()
    if (waitMs >= SLOW_LOCK_THRESHOLD_MS || holdMs >= SLOW_LOCK_THRESHOLD_MS) {
      logger.warn('[ExpoAgentDbLock] slow lock', {
        label: label ?? 'anonymous',
        priority,
        waitMs,
        holdMs,
        highQueued,
        lowQueued
      })
    }
  }
}

/** 等待 Agent 主库上当前执行中及高低优先级队列全部清空（兼容多轮新增任务） */
export async function waitForExpoAgentDatabaseIdle(): Promise<void> {
  while (isLocked || highWaiters.length > 0 || lowWaiters.length > 0) {
    await new Promise<void>((resolve) => {
      idleWaiters.push(resolve)
    })
  }
}

/** 串行化 Agent 主库上的 Drizzle / runAsync 访问（expo 与 drizzle async 驱动） */
export function withExpoAgentDatabaseLock<T>(
  db: unknown,
  fn: () => Promise<T>,
  priority: ExpoDbLockPriority = 'high',
  label?: string
): Promise<T> {
  if (!shouldSerializeExpoAgentDatabase(db)) {
    return fn()
  }
  return runWithPriorityLock(priority, fn, label)
}

/** 无 drizzle 句柄时，对同一 Agent 主库 raw expo-sqlite 访问串行化 */
export function withExpoAgentRawSqliteLock<T>(
  fn: () => Promise<T>,
  priority: ExpoDbLockPriority = 'high',
  label?: string
): Promise<T> {
  return runWithPriorityLock(priority, fn, label)
}
