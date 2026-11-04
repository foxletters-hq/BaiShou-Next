import { path, type IFileSystem, type VaultService } from '@baishou/core-mobile'
import { deriveLegacyVaultId, isVaultId, logger, type ISqlExecutor } from '@baishou/shared'

export interface AutoHealMobileOptions {
  fileSystem: IFileSystem
  storageRoot: string
  vaultService?: VaultService
  /** 调用方已知的当前小窝名；用于在后台任务中跳过用户正在使用的小窝 */
  activeVaultName?: string | null
  sqlExecutor?: ISqlExecutor | ((sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>)
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

/** 仅识别系统默认小窝 Personal 后面追加 2 位以上数字的目录，避免误合并用户自建的其它小窝 */
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

/**
 * 扫描并递归收集指定目录下所有文件的相对路径
 */
async function collectFilesRecursively(
  fileSystem: IFileSystem,
  baseDir: string,
  relDir = ''
): Promise<string[]> {
  const currentDir = relDir ? path.join(baseDir, relDir) : baseDir
  if (!(await fileSystem.exists(currentDir))) {
    return []
  }

  const entries = await fileSystem.readdir(currentDir).catch(() => [])
  const files: string[] = []

  for (const entry of entries) {
    if (entry.startsWith('.')) continue
    const safeEntry = path.basename(entry)
    const relPath = relDir ? path.join(relDir, safeEntry) : safeEntry
    const fullPath = path.join(baseDir, relPath)

    try {
      const st = await fileSystem.stat(fullPath)
      if (st.isDirectory) {
        const subFiles = await collectFilesRecursively(fileSystem, baseDir, relPath)
        files.push(...subFiles)
      } else if (st.isFile) {
        files.push(relPath)
      }
    } catch {
      // 忽略不可读条目
    }
  }

  return files
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
 * 移动端工作区分裂自愈服务：
 * 1. 仅在存储根下确实存在由重名随机数产生的衍生工作区（如 Personal82、Personal8273）时执行；
 * 2. 将衍生工作区中的 Sessions、Journals、Attachments 安全迁移/合并回主工作区（同名冲突不覆盖）；
 * 3. 只修正引用了被合并小窝的会话 JSON，不重写无关会话；
 * 4. 只对齐本次实际合并/修正过的会话在 SQLite 中的 vault_id 与 assistant_id；
 * 5. 清理 vault_registry.json 中已成功合并的衍生条目；
 * 6. 不改变用户当前选择的小窝，也不改写其它小窝的会话归属。
 *
 * 没有衍生小窝时直接返回，避免每次启动/切换都全量扫描会话文件。
 */
export async function autoHealMobileDerivativeVaults(
  options: AutoHealMobileOptions
): Promise<AutoHealResult> {
  const { fileSystem, storageRoot, vaultService, sqlExecutor } = options
  const result: AutoHealResult = {
    healed: false,
    mergedSessions: 0,
    mergedJournals: 0,
    removedVaults: []
  }

  if (!storageRoot) return result

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

    const derivativeCandidates: Array<{ baseName: string; derivativeName: string }> = []
    for (const entry of allEntries) {
      if (entry.startsWith('.')) continue
      if (!DERIVATIVE_DIR_PATTERN.test(entry)) continue
      const baseName = 'Personal'
      if (entry === activeName) {
        // 用户明确选择的小窝即使名字类似衍生目录也不能删，否则切换会被自愈逻辑回滚
        logger.info('[AutoHeal] 跳过当前活跃小窝，保留用户选择:', entry)
        continue
      }
      derivativeCandidates.push({ baseName, derivativeName: entry })
    }

    // 目录已被删除但注册表仍残留的衍生小窝：仍需要清洗引用它们的会话
    const staleRegistryDerivatives = registryEntries.filter((entry) => {
      const name = typeof entry.name === 'string' ? entry.name : ''
      if (!name || name === activeName) return false
      if (!DERIVATIVE_DIR_PATTERN.test(name)) return false
      return !entriesSet.has(name)
    })

    // 检查主小窝 Personal/Sessions 下是否存在未清洗的残留衍生会话或旧随机 ID
    const personalSessionsDir = path.join(storageRoot, 'Personal', 'Sessions')
    let hasLingeringPersonalSessions = false
    const lingeringDerivativeNames = new Set<string>()
    const lingeringDerivativeIds = new Set<string>()

    if (await fileSystem.exists(personalSessionsDir)) {
      const personalRegistryEntry = registryByName.get('Personal')
      const targetPersonalId =
        typeof personalRegistryEntry?.id === 'string' && isVaultId(personalRegistryEntry.id)
          ? personalRegistryEntry.id
          : deriveLegacyVaultId('Personal')
      const personalFiles = await fileSystem.readdir(personalSessionsDir).catch(() => [])

      for (const file of personalFiles) {
        if (!file.endsWith('.json')) continue
        const filePath = path.join(personalSessionsDir, path.basename(file))
        try {
          const raw = await fileSystem.readFile(filePath, 'utf8')
          const meta = parseSessionMeta(raw)
          const needsRepair =
            (meta.vaultName && DERIVATIVE_DIR_PATTERN.test(meta.vaultName)) ||
            (meta.vaultId && meta.vaultId !== targetPersonalId && isVaultId(meta.vaultId))
          if (needsRepair) {
            hasLingeringPersonalSessions = true
            if (meta.vaultName) lingeringDerivativeNames.add(meta.vaultName)
            if (meta.vaultId) lingeringDerivativeIds.add(meta.vaultId)
          }
        } catch {
          // ignore
        }
      }
    }

    if (
      derivativeCandidates.length === 0 &&
      staleRegistryDerivatives.length === 0 &&
      !hasLingeringPersonalSessions
    ) {
      return result
    }

    const staleRegistryNames = new Set(
      staleRegistryDerivatives
        .map((entry) => (typeof entry.name === 'string' ? entry.name : ''))
        .filter(Boolean)
    )

    logger.info('[AutoHeal] 启动自愈检查', {
      storageRoot,
      derivatives: derivativeCandidates.map((item) => item.derivativeName),
      staleRegistryDerivatives: staleRegistryDerivatives.map((item) => item.name),
      hasLingeringPersonalSessions
    })

    /** baseName -> 需要清洗的衍生小窝名集合 */
    const derivativeNamesByBase = new Map<string, Set<string>>()
    /** baseName -> 需要清洗的衍生小窝 id 集合 */
    const derivativeIdsByBase = new Map<string, Set<string>>()
    /** baseName -> 本次修正过的会话 id */
    const repairedSessionIdsByBase = new Map<string, Set<string>>()

    const addSetValue = (target: Map<string, Set<string>>, key: string, value: string) => {
      if (!value) return
      const set = target.get(key) ?? new Set<string>()
      set.add(value)
      target.set(key, set)
    }

    const addDerivativeIdentity = (baseName: string, name: string, id?: string) => {
      addSetValue(derivativeNamesByBase, baseName, name)
      if (id) addSetValue(derivativeIdsByBase, baseName, id)
      const registryEntry = registryByName.get(name)
      const registryId = typeof registryEntry?.id === 'string' ? registryEntry.id : ''
      if (registryId) addSetValue(derivativeIdsByBase, baseName, registryId)
    }

    for (const name of lingeringDerivativeNames) {
      addSetValue(derivativeNamesByBase, 'Personal', name)
    }
    for (const id of lingeringDerivativeIds) {
      addSetValue(derivativeIdsByBase, 'Personal', id)
    }

    for (const stale of staleRegistryDerivatives) {
      const name = typeof stale.name === 'string' ? stale.name : ''
      if (!name) continue
      addDerivativeIdentity('Personal', name, typeof stale.id === 'string' ? stale.id : undefined)
    }

    for (const { baseName, derivativeName } of derivativeCandidates) {
      const baseDir = path.join(storageRoot, baseName)
      const derivDir = path.join(storageRoot, derivativeName)
      const baseRegistryEntry = registryByName.get(baseName)
      const targetVaultId =
        typeof baseRegistryEntry?.id === 'string' && isVaultId(baseRegistryEntry.id)
          ? baseRegistryEntry.id
          : deriveLegacyVaultId(baseName)

      addDerivativeIdentity(
        baseName,
        derivativeName,
        typeof registryByName.get(derivativeName)?.id === 'string'
          ? registryByName.get(derivativeName)!.id
          : undefined
      )

      let mergeFailed = false
      await fileSystem.mkdir(baseDir, { recursive: true })

      // 1. 合并 Sessions/*.json
      const derivSessionsDir = path.join(derivDir, 'Sessions')
      const baseSessionsDir = path.join(baseDir, 'Sessions')
      if (await fileSystem.exists(derivSessionsDir)) {
        await fileSystem.mkdir(baseSessionsDir, { recursive: true })
        const sessionFiles = await fileSystem.readdir(derivSessionsDir).catch(() => [])

        for (const file of sessionFiles) {
          if (!file.endsWith('.json')) continue
          const safeFile = path.basename(file)
          const srcPath = path.join(derivSessionsDir, safeFile)
          const destPath = path.join(baseSessionsDir, safeFile)

          try {
            const raw = await fileSystem.readFile(srcPath, 'utf8')
            const contentToWrite = sanitizeSessionJsonContent(raw, baseName, targetVaultId)
            const meta = parseSessionMeta(raw)

            const destExists = await fileSystem.exists(destPath)
            if (destExists) {
              const destRaw = await fileSystem.readFile(destPath, 'utf8').catch(() => null)
              const destStat = await fileSystem.stat(destPath).catch(() => null)
              const canReplaceEmpty = destStat ? destStat.size === 0 : false
              const destMeta = destRaw ? parseSessionMeta(destRaw) : {}
              const isDestDerivative = Boolean(
                destMeta.vaultName && DERIVATIVE_DIR_PATTERN.test(destMeta.vaultName)
              )
              if (destRaw !== contentToWrite && !canReplaceEmpty && !isDestDerivative) {
                // 同名会话内容不同：保留源文件，避免静默丢弃历史消息
                mergeFailed = true
                logger.warn('[AutoHeal] 目标会话已存在且内容不同，保留衍生文件:', {
                  derivativeName,
                  file: safeFile
                })
                continue
              }
              if (canReplaceEmpty || isDestDerivative) {
                await fileSystem.writeFile(destPath, contentToWrite, 'utf8')
              }
            } else {
              await fileSystem.writeFile(destPath, contentToWrite, 'utf8')
            }

            if (meta.id) addSetValue(repairedSessionIdsByBase, baseName, meta.id)
            else addSetValue(repairedSessionIdsByBase, baseName, safeFile.replace(/\.json$/i, ''))
            await fileSystem.unlink(srcPath).catch(() => {})
            result.mergedSessions++
          } catch (sessionErr) {
            mergeFailed = true
            logger.warn(`[AutoHeal] 迁移会话文件 ${safeFile} 失败:`, sessionErr as Error)
          }
        }
      }

      // 2. 合并 Journals/**/*.md
      const derivJournalsDir = path.join(derivDir, 'Journals')
      const baseJournalsDir = path.join(baseDir, 'Journals')
      if (await fileSystem.exists(derivJournalsDir)) {
        await fileSystem.mkdir(baseJournalsDir, { recursive: true })
        const journalFiles = await collectFilesRecursively(fileSystem, derivJournalsDir)

        for (const relFile of journalFiles) {
          if (!relFile.endsWith('.md')) continue
          const srcPath = path.join(derivJournalsDir, relFile)
          const destPath = path.join(baseJournalsDir, relFile)

          try {
            const destExists = await fileSystem.exists(destPath)
            if (destExists) {
              const [srcRaw, destRaw] = await Promise.all([
                fileSystem.readFile(srcPath, 'utf8'),
                fileSystem.readFile(destPath, 'utf8').catch(() => null)
              ])
              if (srcRaw !== destRaw) {
                mergeFailed = true
                logger.warn('[AutoHeal] 目标日记已存在且内容不同，保留衍生文件:', {
                  derivativeName,
                  file: relFile
                })
                continue
              }
            } else {
              await fileSystem.mkdir(path.dirname(destPath), { recursive: true })
              const content = await fileSystem.readFile(srcPath, 'utf8')
              await fileSystem.writeFile(destPath, content, 'utf8')
              result.mergedJournals++
            }
            await fileSystem.unlink(srcPath).catch(() => {})
          } catch (journalErr) {
            mergeFailed = true
            logger.warn(`[AutoHeal] 迁移日记文件 ${relFile} 失败:`, journalErr as Error)
          }
        }
      }

      // 3. 合并 Attachments
      const derivAttDir = path.join(derivDir, 'Attachments')
      const baseAttDir = path.join(baseDir, 'Attachments')
      if (await fileSystem.exists(derivAttDir)) {
        await fileSystem.mkdir(baseAttDir, { recursive: true })
        const attFiles = await collectFilesRecursively(fileSystem, derivAttDir)

        for (const relFile of attFiles) {
          const srcPath = path.join(derivAttDir, relFile)
          const destPath = path.join(baseAttDir, relFile)
          try {
            if (!(await fileSystem.exists(destPath))) {
              await fileSystem.mkdir(path.dirname(destPath), { recursive: true })
              await fileSystem.copyFile(srcPath, destPath)
            }
            await fileSystem.unlink(srcPath).catch(() => {})
          } catch (attachmentErr) {
            mergeFailed = true
            logger.warn(`[AutoHeal] 迁移附件 ${relFile} 失败:`, attachmentErr as Error)
          }
        }
      }

      // 4. 合并 Assistants/*.json
      const derivAssistantsDir = path.join(derivDir, 'Assistants')
      const baseAssistantsDir = path.join(baseDir, 'Assistants')
      if (await fileSystem.exists(derivAssistantsDir)) {
        await fileSystem.mkdir(baseAssistantsDir, { recursive: true })
        const assistantFiles = await fileSystem.readdir(derivAssistantsDir).catch(() => [])

        for (const file of assistantFiles) {
          if (!file.endsWith('.json')) continue
          const safeFile = path.basename(file)
          const srcPath = path.join(derivAssistantsDir, safeFile)
          const destPath = path.join(baseAssistantsDir, safeFile)

          try {
            const destExists = await fileSystem.exists(destPath)
            if (destExists) {
              const [srcRaw, destRaw] = await Promise.all([
                fileSystem.readFile(srcPath, 'utf8'),
                fileSystem.readFile(destPath, 'utf8').catch(() => null)
              ])
              if (srcRaw !== destRaw) {
                // 若为 latte.json 且内容不同，转存为衍生自定义助手，避免静默丢失
                if (safeFile.toLowerCase() === 'latte.json') {
                  try {
                    const parsed = JSON.parse(srcRaw)
                    const newId = `ast_derived_${Date.now()}`
                    parsed.id = newId
                    parsed.isDefault = false
                    const migratedPath = path.join(baseAssistantsDir, `${newId}.json`)
                    await fileSystem.writeFile(
                      migratedPath,
                      JSON.stringify(parsed, null, 2),
                      'utf8'
                    )
                    if (sqlExecutor) {
                      await runSql(
                        sqlExecutor,
                        `INSERT OR REPLACE INTO agent_assistants (id, name, emoji, avatar_path, description, system_prompt, custom_system_prompt, is_default, is_pinned, context_window, provider_id, model_id, compress_token_threshold, compress_keep_turns, assistant_kind, sort_order, vault_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                          newId,
                          parsed.name || 'Latte',
                          parsed.emoji || '✨',
                          parsed.avatarPath || null,
                          parsed.description || null,
                          parsed.systemPrompt || null,
                          parsed.customSystemPrompt || null,
                          0,
                          parsed.isPinned ? 1 : 0,
                          parsed.contextWindow || null,
                          parsed.providerId || null,
                          parsed.modelId || null,
                          parsed.compressTokenThreshold || null,
                          parsed.compressKeepTurns || null,
                          'custom',
                          parsed.sortOrder || 0,
                          targetVaultId,
                          Date.now(),
                          Date.now()
                        ]
                      )
                    }
                  } catch (astParseErr) {
                    mergeFailed = true
                    logger.warn('[AutoHeal] 转存衍生 latte 失败:', astParseErr as Error)
                    continue
                  }
                } else {
                  mergeFailed = true
                  logger.warn('[AutoHeal] 目标助手已存在且内容不同，保留衍生文件:', {
                    derivativeName,
                    file: safeFile
                  })
                  continue
                }
              }
            } else {
              const content = await fileSystem.readFile(srcPath, 'utf8')
              await fileSystem.writeFile(destPath, content, 'utf8')
              if (sqlExecutor) {
                try {
                  const parsed = JSON.parse(content)
                  if (parsed.id && parsed.name) {
                    await runSql(
                      sqlExecutor,
                      `INSERT OR REPLACE INTO agent_assistants (id, name, emoji, avatar_path, description, system_prompt, custom_system_prompt, is_default, is_pinned, context_window, provider_id, model_id, compress_token_threshold, compress_keep_turns, assistant_kind, sort_order, vault_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                      [
                        parsed.id,
                        parsed.name,
                        parsed.emoji || '✨',
                        parsed.avatarPath || null,
                        parsed.description || null,
                        parsed.systemPrompt || null,
                        parsed.customSystemPrompt || null,
                        parsed.isDefault ? 1 : 0,
                        parsed.isPinned ? 1 : 0,
                        parsed.contextWindow || null,
                        parsed.providerId || null,
                        parsed.modelId || null,
                        parsed.compressTokenThreshold || null,
                        parsed.compressKeepTurns || null,
                        parsed.assistantKind || (parsed.isDefault ? 'default' : 'custom'),
                        parsed.sortOrder || 0,
                        targetVaultId,
                        Date.now(),
                        Date.now()
                      ]
                    )
                  }
                } catch {
                  // 忽略个别非法 JSON
                }
              }
            }
            await fileSystem.unlink(srcPath).catch(() => {})
          } catch (assistantErr) {
            mergeFailed = true
            logger.warn(`[AutoHeal] 迁移助手 ${safeFile} 失败:`, assistantErr as Error)
          }
        }
      }

      // 5. 仅在全部内容迁移成功时移除衍生目录，否则保留以便下次重试
      if (mergeFailed) {
        logger.warn('[AutoHeal] 衍生工作区存在未迁移内容，保留目录:', derivativeName)
        continue
      }

      try {
        await fileSystem.rm(derivDir, { recursive: true, force: true })
        result.removedVaults.push(derivativeName)
      } catch (removeErr) {
        logger.warn('[AutoHeal] 删除衍生工作区失败:', removeErr as Error)
      }
    }

    // 5. 只清洗引用了衍生小窝的会话文件，避免每次改写无关会话
    for (const [baseName, derivativeNames] of derivativeNamesByBase) {
      const baseSessionsDir = path.join(storageRoot, baseName, 'Sessions')
      if (!(await fileSystem.exists(baseSessionsDir))) continue
      const derivativeIds = derivativeIdsByBase.get(baseName) ?? new Set<string>()
      const baseRegistryEntry = registryByName.get(baseName)
      const targetVaultId =
        typeof baseRegistryEntry?.id === 'string' && isVaultId(baseRegistryEntry.id)
          ? baseRegistryEntry.id
          : deriveLegacyVaultId(baseName)
      const files = await fileSystem.readdir(baseSessionsDir).catch(() => [])
      let updatedCount = 0

      for (const file of files) {
        if (!file.endsWith('.json')) continue
        const filePath = path.join(baseSessionsDir, path.basename(file))
        try {
          const raw = await fileSystem.readFile(filePath, 'utf8')
          const meta = parseSessionMeta(raw)
          const referencesDerivative =
            (meta.vaultName !== undefined && derivativeNames.has(meta.vaultName)) ||
            (meta.vaultId !== undefined && derivativeIds.has(meta.vaultId)) ||
            (baseName === 'Personal' &&
              ((meta.vaultName !== undefined && DERIVATIVE_DIR_PATTERN.test(meta.vaultName)) ||
                (meta.vaultId !== undefined &&
                  meta.vaultId !== targetVaultId &&
                  isVaultId(meta.vaultId))))
          if (!referencesDerivative) continue

          const sanitized = sanitizeSessionJsonContent(raw, baseName, targetVaultId)
          if (sanitized !== raw) {
            await fileSystem.writeFile(filePath, sanitized, 'utf8')
            updatedCount++
          }
          if (meta.id) addSetValue(repairedSessionIdsByBase, baseName, meta.id)
          else addSetValue(repairedSessionIdsByBase, baseName, file.replace(/\.json$/i, ''))
        } catch (sanitizeErr) {
          logger.warn(`[AutoHeal] 清洗会话文件 ${file} 失败:`, sanitizeErr as Error)
        }
      }

      if (updatedCount > 0) {
        logger.info('[AutoHeal] 会话归属清洗完成', {
          baseName,
          updatedFiles: updatedCount,
          derivatives: Array.from(derivativeNames)
        })
      }
    }

    // 6. 只更新本次实际修正过的会话，不再全表改写 vault_id
    if (sqlExecutor) {
      for (const [baseName, sessionIds] of repairedSessionIdsByBase) {
        if (sessionIds.size === 0) continue
        const baseRegistryEntry = registryByName.get(baseName)
        const targetVaultId =
          typeof baseRegistryEntry?.id === 'string' && isVaultId(baseRegistryEntry.id)
            ? baseRegistryEntry.id
            : deriveLegacyVaultId(baseName)
        const ids = Array.from(sessionIds)
        const chunkSize = 400

        try {
          for (let offset = 0; offset < ids.length; offset += chunkSize) {
            const chunk = ids.slice(offset, offset + chunkSize)
            const placeholders = chunk.map(() => '?').join(', ')
            await runSql(
              sqlExecutor,
              `UPDATE agent_sessions SET vault_id = ?, assistant_id = CASE WHEN assistant_id = 'default' OR assistant_id IS NULL OR assistant_id = '' THEN 'latte' ELSE assistant_id END WHERE id IN (${placeholders})`,
              [targetVaultId, ...chunk]
            )
          }
          logger.info('[AutoHeal] SQLite 会话归属已对齐', {
            baseName,
            targetVaultId,
            sessionCount: ids.length
          })
        } catch (sqlErr) {
          logger.warn('[AutoHeal] SQLite 会话归属对齐出现非致命异常:', sqlErr as Error)
        }
      }
    }

    // 7. 只移除已成功合并的衍生目录与已确认不存在的幽灵条目，保留其它小窝和 Personal 的既有身份
    const registryNamesToRemove = new Set([...result.removedVaults, ...staleRegistryNames])
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

    // 8. 重新加载注册表，让内存与磁盘一致；不改变用户当前选择的小窝
    if (vaultService) {
      try {
        await vaultService.initRegistry()
      } catch (registryErr) {
        logger.warn('[AutoHeal] 重载 vault_registry 失败:', registryErr as Error)
      }
    }

    if (derivativeCandidates.length > 0) {
      result.healed = true
      logger.info('[AutoHeal] 衍生工作区自愈完成:', {
        mergedSessions: result.mergedSessions,
        mergedJournals: result.mergedJournals,
        removedVaults: result.removedVaults
      })
    }
  } catch (err) {
    logger.error('[AutoHeal] 自动修复衍生工作区异常:', err as Error)
  }

  return result
}
