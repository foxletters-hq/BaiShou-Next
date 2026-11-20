import {
  path,
  vaultDirectoryHasUserContent,
  type IFileSystem,
  type VaultService
} from '@baishou/core-mobile'
import {
  deriveLegacyVaultId,
  isVaultId,
  logger,
  normalizeStorageRoot,
  type ISqlExecutor
} from '@baishou/shared'
import { AUTO_HEAL_PERSONAL_SESSIONS_DONE_ROOTS_KEY } from '../constants/storage'

export interface AutoHealMobileOptions {
  fileSystem: IFileSystem
  storageRoot: string
  vaultService?: VaultService
  /** 调用方已知的当前小窝名；用于在后台任务中跳过用户正在使用的小窝 */
  activeVaultName?: string | null
  sqlExecutor?: ISqlExecutor | ((sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>)
  /** 可选覆盖：是否已完成该 storageRoot 的一次性 Personal/Sessions 历史归属扫描（便于测试注入） */
  hasCompletedPersonalSessionScan?: (normalizedRoot: string) => Promise<boolean>
  /** 可选覆盖：标记该 storageRoot 已完成一次性 Personal/Sessions 扫描 */
  markPersonalSessionScanCompleted?: (normalizedRoot: string) => Promise<void>
}

const completedPersonalScanRootsMemory = new Set<string>()
const inFlightAutoHealByRoot = new Map<string, Promise<AutoHealResult>>()

async function loadAsyncStorageSafe(): Promise<{
  getItem: (key: string) => Promise<string | null>
  setItem: (key: string, value: string) => Promise<void>
} | null> {
  try {
    const mod = await import('@react-native-async-storage/async-storage')
    const store = mod.default ?? (mod as unknown as { getItem?: unknown; setItem?: unknown })
    if (typeof store?.getItem === 'function' && typeof store?.setItem === 'function') {
      return store as {
        getItem: (key: string) => Promise<string | null>
        setItem: (key: string, value: string) => Promise<void>
      }
    }
    return null
  } catch {
    return null
  }
}

async function defaultHasCompletedPersonalSessionScan(normalizedRoot: string): Promise<boolean> {
  if (completedPersonalScanRootsMemory.has(normalizedRoot)) return true
  const store = await loadAsyncStorageSafe()
  if (!store) return false
  try {
    const raw = await store.getItem(AUTO_HEAL_PERSONAL_SESSIONS_DONE_ROOTS_KEY)
    if (!raw) return false
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (typeof item === 'string' && item) completedPersonalScanRootsMemory.add(item)
      }
      return completedPersonalScanRootsMemory.has(normalizedRoot)
    }
  } catch {
    // 忽略损坏缓存，回退重新扫描一次
  }
  return false
}

async function defaultMarkPersonalSessionScanCompleted(normalizedRoot: string): Promise<void> {
  completedPersonalScanRootsMemory.add(normalizedRoot)
  const store = await loadAsyncStorageSafe()
  if (!store) return
  try {
    const raw = await store.getItem(AUTO_HEAL_PERSONAL_SESSIONS_DONE_ROOTS_KEY)
    const set = new Set<string>(completedPersonalScanRootsMemory)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (typeof item === 'string' && item) set.add(item)
        }
      }
    }
    await store.setItem(AUTO_HEAL_PERSONAL_SESSIONS_DONE_ROOTS_KEY, JSON.stringify(Array.from(set)))
  } catch {
    // 持久化失败不影响主流程，本进程内存已标记
  }
}

/** 测试用：重置进程内自愈完成缓存 */
export function resetAutoHealMemoryStateForTest(): void {
  completedPersonalScanRootsMemory.clear()
  inFlightAutoHealByRoot.clear()
}

async function runSql(
  executor: ISqlExecutor | ((sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>),
  sql: string,
  params?: any[]
): Promise<void> {
  if ('execute' in executor && typeof executor.execute === 'function') {
    await executor.execute({ sql, args: params })
  } else if (typeof executor === 'function') {
    await executor(sql, params)
  }
}

export interface AutoHealResult {
  healed: boolean
  mergedSessions: number
  mergedJournals: number
  removedVaults: string[]
}

interface RegistryEntry {
  id?: string
  name?: string
  [key: string]: unknown
}

interface SessionMeta {
  id?: string
  vaultName?: string
  vaultId?: string
}

/** 仅识别系统默认小窝 Personal 后面追加 2 位以上数字的目录 */
const DERIVATIVE_DIR_PATTERN = /^Personal(\d{2,})$/

function parseSessionMeta(raw: string): SessionMeta {
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    const id = parsed?.session?.id ?? parsed?.id
    return {
      id: typeof id === 'string' ? id : undefined,
      vaultName:
        typeof parsed?.session?.vaultName === 'string'
          ? parsed.session.vaultName
          : typeof parsed?.vaultName === 'string'
            ? parsed.vaultName
            : undefined,
      vaultId:
        typeof parsed?.session?.vaultId === 'string'
          ? parsed.session.vaultId
          : typeof parsed?.vaultId === 'string'
            ? parsed.vaultId
            : undefined
    }
  } catch {
    return {}
  }
}

/**
 * 规范化会话 JSON 文本：
 * 兼容标准嵌套格式 `{ session: { vaultId, vaultName, assistantId }, messages: [...] }`
 * 以及遗留扁平格式 `{ vaultId, vaultName, assistantId }`，确保两层均对齐至目标仓库与系统助手 latte。
 */
export function sanitizeSessionJsonContent(
  rawContent: string,
  targetVaultName: string,
  targetVaultId: string
): string {
  try {
    const parsed = JSON.parse(rawContent)
    if (!parsed || typeof parsed !== 'object') return rawContent

    // 1. 若为标准嵌套结构 { session: { ... }, messages: [...] }
    if (parsed.session && typeof parsed.session === 'object') {
      parsed.session.vaultName = targetVaultName
      parsed.session.vaultId = targetVaultId
      if (!parsed.session.assistantId || parsed.session.assistantId === 'default') {
        parsed.session.assistantId = 'latte'
      }
    }

    // 2. 顶层兼容
    parsed.vaultName = targetVaultName
    parsed.vaultId = targetVaultId
    if (!parsed.assistantId || parsed.assistantId === 'default') {
      parsed.assistantId = 'latte'
    }

    return JSON.stringify(parsed, null, 2)
  } catch {
    return rawContent
  }
}

async function readRegistryEntries(
  fileSystem: IFileSystem,
  storageRoot: string
): Promise<RegistryEntry[]> {
  const registryPath = path.join(storageRoot, 'vault_registry.json')
  try {
    if (!(await fileSystem.exists(registryPath))) return []
    const raw = await fileSystem.readFile(registryPath, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((item: unknown): item is RegistryEntry => {
          return Boolean(
            item && typeof item === 'object' && typeof (item as RegistryEntry).name === 'string'
          )
        })
      : []
  } catch {
    return []
  }
}

async function writeRegistryEntries(
  fileSystem: IFileSystem,
  storageRoot: string,
  entries: RegistryEntry[]
): Promise<void> {
  const registryPath = path.join(storageRoot, 'vault_registry.json')
  await fileSystem.writeFile(registryPath, JSON.stringify(entries, null, 2), 'utf8')
}

/**
 * 移动端衍生工作区安全自愈服务（仅执行无损清理，严禁静默合并或删除含真实用户数据的小窝）：
 * 1. 若磁盘上的 PersonalXX 目录包含任何真实用户数据（日记、会话、总结、附件、自定义伙伴），
 *    一律视作独立工作空间原样保留（用户可能将其作为主工作空间使用），绝不后台静默搬迁或删除；
 * 2. 仅清理确认无任何用户内容且非当前活跃小窝的空壳 PersonalXX 目录；
 * 3. 清理目录已在磁盘上不存在的幽灵 PersonalXX 注册表条目；
 * 4. 仅原地清洗物理位于 Personal/Sessions 目录下、但元信息错指向已不存在衍生小窝或旧随机 ID 的会话。
 */
export async function autoHealMobileDerivativeVaults(
  options: AutoHealMobileOptions
): Promise<AutoHealResult> {
  if (!options.storageRoot) {
    return { healed: false, mergedSessions: 0, mergedJournals: 0, removedVaults: [] }
  }
  const normalizedRoot = normalizeStorageRoot(options.storageRoot) || options.storageRoot
  const existingTask = inFlightAutoHealByRoot.get(normalizedRoot)
  if (existingTask) return existingTask

  const task = runAutoHealMobileDerivativeVaults(options, normalizedRoot).finally(() => {
    if (inFlightAutoHealByRoot.get(normalizedRoot) === task) {
      inFlightAutoHealByRoot.delete(normalizedRoot)
    }
  })
  inFlightAutoHealByRoot.set(normalizedRoot, task)
  return task
}

async function runAutoHealMobileDerivativeVaults(
  options: AutoHealMobileOptions,
  normalizedRoot: string
): Promise<AutoHealResult> {
  const { fileSystem, storageRoot, vaultService, sqlExecutor } = options
  const hasCompletedPersonalScan =
    options.hasCompletedPersonalSessionScan ?? defaultHasCompletedPersonalSessionScan
  const markPersonalScanCompleted =
    options.markPersonalSessionScanCompleted ?? defaultMarkPersonalSessionScanCompleted
  const result: AutoHealResult = {
    healed: false,
    mergedSessions: 0,
    mergedJournals: 0,
    removedVaults: []
  }

  try {
    if (!(await fileSystem.exists(storageRoot))) {
      return result
    }

    const allEntries = await fileSystem.readdir(storageRoot).catch(() => [])
    const entriesSet = new Set(allEntries)
    const registryEntries = await readRegistryEntries(fileSystem, storageRoot)
    const registryByName = new Map<string, RegistryEntry>()
    for (const entry of registryEntries) {
      const name = typeof entry.name === 'string' ? entry.name : ''
      if (name) registryByName.set(name, entry)
    }

    const activeName = options.activeVaultName ?? vaultService?.getActiveVault()?.name ?? null

    // 1. 仅识别「无任何真实用户内容」的空壳衍生目录；有用户内容的独立小窝一律原样保留
    const emptyDerivativeDirs: string[] = []
    const preservedDerivativeDirs = new Set<string>()
    for (const entry of allEntries) {
      if (entry.startsWith('.')) continue
      if (!DERIVATIVE_DIR_PATTERN.test(entry)) continue
      if (entry === activeName) {
        preservedDerivativeDirs.add(entry)
        logger.info('[AutoHeal] 跳过当前活跃小窝，保留用户选择:', entry)
        continue
      }
      const hasContent = await vaultDirectoryHasUserContent(fileSystem, storageRoot, entry)
      if (hasContent) {
        preservedDerivativeDirs.add(entry)
        logger.info('[AutoHeal] 保留含用户数据的独立工作区，不执行静默合并:', entry)
        continue
      }
      emptyDerivativeDirs.push(entry)
    }

    // 2. 目录已不存在但注册表仍残留的衍生条目
    const staleRegistryDerivatives = registryEntries.filter((entry) => {
      const name = typeof entry.name === 'string' ? entry.name : ''
      if (!name || name === activeName) return false
      if (!DERIVATIVE_DIR_PATTERN.test(name)) return false
      return !entriesSet.has(name)
    })

    // 3. 快路径：无空壳/幽灵衍生小窝且已完成过一次性 Personal/Sessions 扫描时，直接跳过 O(N) 会话读取
    const hasDerivativeCleanupWork =
      emptyDerivativeDirs.length > 0 || staleRegistryDerivatives.length > 0
    const personalScanAlreadyDone = hasDerivativeCleanupWork
      ? false
      : await hasCompletedPersonalScan(normalizedRoot)
    if (!hasDerivativeCleanupWork && personalScanAlreadyDone) {
      return result
    }

    // 4. 收集仍然独立存活的其它小窝 ID，防止误改写
    const preservedDerivativeIds = new Set<string>()
    for (const name of preservedDerivativeDirs) {
      const regId = registryByName.get(name)?.id
      if (typeof regId === 'string' && regId.trim()) preservedDerivativeIds.add(regId.trim())
      preservedDerivativeIds.add(deriveLegacyVaultId(name))
    }

    // 5. 检查物理位于 Personal/Sessions 下的会话是否残余引用了已不存在的衍生目录或旧随机 ID
    const personalSessionsDir = path.join(storageRoot, 'Personal', 'Sessions')
    const personalRegistryEntry = registryByName.get('Personal')
    const targetPersonalId =
      typeof personalRegistryEntry?.id === 'string' && isVaultId(personalRegistryEntry.id)
        ? personalRegistryEntry.id
        : deriveLegacyVaultId('Personal')

    const removableDerivativeNames = new Set<string>([
      ...emptyDerivativeDirs,
      ...staleRegistryDerivatives
        .map((entry) => (typeof entry.name === 'string' ? entry.name : ''))
        .filter(Boolean)
    ])
    const removableDerivativeIds = new Set<string>()
    for (const name of removableDerivativeNames) {
      const regId = registryByName.get(name)?.id
      if (typeof regId === 'string' && regId.trim()) removableDerivativeIds.add(regId.trim())
      removableDerivativeIds.add(deriveLegacyVaultId(name))
    }

    const personalSessionsToRepair: Array<{
      filePath: string
      fileName: string
      raw: string
      id: string
    }> = []
    if (await fileSystem.exists(personalSessionsDir)) {
      const personalFiles = await fileSystem.readdir(personalSessionsDir).catch(() => [])
      for (const file of personalFiles) {
        if (!file.endsWith('.json')) continue
        const safeFile = path.basename(file)
        const filePath = path.join(personalSessionsDir, safeFile)
        try {
          const raw = await fileSystem.readFile(filePath, 'utf8')
          const meta = parseSessionMeta(raw)
          const refsRemovedDerivative =
            (meta.vaultName !== undefined && removableDerivativeNames.has(meta.vaultName)) ||
            (meta.vaultId !== undefined && removableDerivativeIds.has(meta.vaultId))
          const refsUnregisteredDerivativeName =
            meta.vaultName !== undefined &&
            DERIVATIVE_DIR_PATTERN.test(meta.vaultName) &&
            !preservedDerivativeDirs.has(meta.vaultName)
          const refsStalePersonalRandomId =
            meta.vaultId !== undefined &&
            isVaultId(meta.vaultId) &&
            meta.vaultId !== targetPersonalId &&
            !preservedDerivativeIds.has(meta.vaultId) &&
            (!meta.vaultName ||
              meta.vaultName === 'Personal' ||
              meta.vaultName === 'default' ||
              refsUnregisteredDerivativeName)

          if (
            refsRemovedDerivative ||
            refsUnregisteredDerivativeName ||
            refsStalePersonalRandomId
          ) {
            personalSessionsToRepair.push({
              filePath,
              fileName: safeFile,
              raw,
              id: meta.id || safeFile.replace(/\.json$/i, '')
            })
          }
        } catch {
          // 忽略不可读文件
        }
      }
    }

    if (
      emptyDerivativeDirs.length === 0 &&
      staleRegistryDerivatives.length === 0 &&
      personalSessionsToRepair.length === 0
    ) {
      await markPersonalScanCompleted(normalizedRoot)
      return result
    }

    logger.info('[AutoHeal] 启动安全自愈清理', {
      storageRoot,
      emptyDerivativeDirs,
      staleRegistryDerivatives: staleRegistryDerivatives.map((item) => item.name),
      personalSessionsToRepairCount: personalSessionsToRepair.length
    })

    // 6. 仅删除空壳衍生目录
    for (const dirName of emptyDerivativeDirs) {
      const derivDir = path.join(storageRoot, dirName)
      try {
        await fileSystem.rm(derivDir, { recursive: true, force: true })
        result.removedVaults.push(dirName)
      } catch (removeErr) {
        logger.warn('[AutoHeal] 删除空壳衍生目录失败:', removeErr as Error)
      }
    }

    // 7. 原地清洗物理位于 Personal/Sessions 下且归属错位的会话 JSON
    const repairedSessionIds: string[] = []
    let updatedCount = 0
    let repairHadError = false
    for (const item of personalSessionsToRepair) {
      try {
        const sanitized = sanitizeSessionJsonContent(item.raw, 'Personal', targetPersonalId)
        if (sanitized !== item.raw) {
          await fileSystem.writeFile(item.filePath, sanitized, 'utf8')
          updatedCount++
        }
        repairedSessionIds.push(item.id)
      } catch (sanitizeErr) {
        repairHadError = true
        logger.warn(`[AutoHeal] 清洗会话文件 ${item.fileName} 失败:`, sanitizeErr as Error)
      }
    }

    if (updatedCount > 0) {
      logger.info('[AutoHeal] Personal 会话归属清洗完成', {
        updatedFiles: updatedCount
      })
    }

    // 8. 仅对齐本次原地清洗过的 Personal 会话在 SQLite 中的归属
    if (sqlExecutor && repairedSessionIds.length > 0) {
      const chunkSize = 400
      try {
        for (let offset = 0; offset < repairedSessionIds.length; offset += chunkSize) {
          const chunk = repairedSessionIds.slice(offset, offset + chunkSize)
          const placeholders = chunk.map(() => '?').join(', ')
          await runSql(
            sqlExecutor,
            `UPDATE agent_sessions SET vault_id = ?, assistant_id = CASE WHEN assistant_id = 'default' OR assistant_id IS NULL OR assistant_id = '' THEN 'latte' ELSE assistant_id END WHERE id IN (${placeholders})`,
            [targetPersonalId, ...chunk]
          )
        }
        logger.info('[AutoHeal] SQLite 会话归属已对齐', {
          baseName: 'Personal',
          targetVaultId: targetPersonalId,
          sessionCount: repairedSessionIds.length
        })
      } catch (sqlErr) {
        logger.warn('[AutoHeal] SQLite 会话归属对齐出现非致命异常:', sqlErr as Error)
      }
    }

    // 9. 清理已删除空壳与已确认不存在的幽灵注册表条目
    const staleNames = staleRegistryDerivatives
      .map((entry) => (typeof entry.name === 'string' ? entry.name : ''))
      .filter(Boolean)
    const registryNamesToRemove = new Set([...result.removedVaults, ...staleNames])
    if (registryNamesToRemove.size > 0) {
      const cleaned = registryEntries.filter((entry) => {
        const name = typeof entry.name === 'string' ? entry.name : ''
        return !registryNamesToRemove.has(name)
      })
      if (cleaned.length !== registryEntries.length) {
        await writeRegistryEntries(fileSystem, storageRoot, cleaned)
        logger.info('[AutoHeal] vault_registry.json 整理完成', {
          removedVaults: Array.from(registryNamesToRemove)
        })
      }
    }

    // 10. 重载注册表，不改变用户当前选择的小窝
    if (vaultService && (result.removedVaults.length > 0 || staleNames.length > 0)) {
      try {
        await vaultService.initRegistry()
      } catch (registryErr) {
        logger.warn('[AutoHeal] 重载 vault_registry 失败:', registryErr as Error)
      }
    }

    if (!repairHadError) {
      await markPersonalScanCompleted(normalizedRoot)
    }

    if (result.removedVaults.length > 0) {
      result.healed = true
      logger.info('[AutoHeal] 空壳衍生目录清理完成:', {
        removedVaults: result.removedVaults
      })
    }
  } catch (err) {
    logger.error('[AutoHeal] 自动修复衍生工作区异常:', err as Error)
  }

  return result
}
