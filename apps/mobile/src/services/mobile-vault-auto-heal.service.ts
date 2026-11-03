import {
  path,
  type IFileSystem,
  type VaultService
} from '@baishou/core-mobile'
import { deriveLegacyVaultId, isVaultId, logger, type ISqlExecutor } from '@baishou/shared'

export interface AutoHealMobileOptions {
  fileSystem: IFileSystem
  storageRoot: string
  vaultService?: VaultService
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

/**
 * 移动端工作区分裂自愈服务：
 * 1. 扫描存储根目录下由重名随机数产生的衍生工作区（如 Personal82, Personal8273 等）
 * 2. 将衍生工作区中的 Sessions、Journals、Attachments 等安全迁移/合并回主工作区（Personal）
 * 3. 规范化会话 JSON 中的 vaultName 与 vaultId，纠正 default 伙伴为 latte
 * 4. 深度就地清洗 Personal/Sessions 下所有会话文件，防止后续 reconcile 倒退
 * 5. 清理 vault_registry.json 中的冗余条目并使 Personal 拥有确定性的派生 ID
 * 6. 在本地 SQLite 数据库中强制统一对齐 agent_sessions 的 vault_id 与 assistant_id
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

    logger.info('[AutoHeal] 启动自愈检查', { storageRoot, diskEntryCount: allEntries.length })

    // 识别形如 NameXX... 的衍生工作区（如 Personal82, Personal8273）
    const derivativeVaults: Array<{ baseName: string; derivativeName: string }> = []
    for (const entry of allEntries) {
      if (entry.startsWith('.')) continue
      const match = entry.match(/^(.+?)(\d{2,})$/)
      if (match) {
        const prefix = match[1]
        if (prefix === 'Personal' || entriesSet.has(prefix)) {
          derivativeVaults.push({ baseName: prefix, derivativeName: entry })
        }
      }
    }

    if (derivativeVaults.length > 0) {
      logger.info('[AutoHeal] 检测到待合并的衍生工作区:', {
        vaults: derivativeVaults.map((d) => d.derivativeName)
      })

      for (const { baseName, derivativeName } of derivativeVaults) {
        const baseDir = path.join(storageRoot, baseName)
        const derivDir = path.join(storageRoot, derivativeName)
        const targetVaultId = deriveLegacyVaultId(baseName)

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

              const destExists = await fileSystem.exists(destPath)
              if (destExists) {
                const destStat = await fileSystem.stat(destPath).catch(() => null)
                // 目标文件若为空，则用衍生目录有效文件替换
                if (destStat && destStat.size === 0) {
                  await fileSystem.writeFile(destPath, contentToWrite, 'utf8')
                }
              } else {
                await fileSystem.writeFile(destPath, contentToWrite, 'utf8')
              }

              await fileSystem.unlink(srcPath).catch(() => {})
              result.mergedSessions++
            } catch (sessionErr) {
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
              if (!destExists) {
                await fileSystem.mkdir(path.dirname(destPath), { recursive: true })
                const content = await fileSystem.readFile(srcPath, 'utf8')
                await fileSystem.writeFile(destPath, content, 'utf8')
                result.mergedJournals++
              }
              await fileSystem.unlink(srcPath).catch(() => {})
            } catch (journalErr) {
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
            } catch {
              // 忽略非关键附件搬运错误
            }
          }
        }

        // 4. 清理已合并的衍生目录
        try {
          await fileSystem.rm(derivDir, { recursive: true, force: true })
          result.removedVaults.push(derivativeName)
        } catch {
          // 部分系统或权限下若无法直接删除目录，不阻断流程
        }
      }
    }

    // 5. 对 Personal/Sessions 目录下的所有文件进行就地深度清洗规范化
    const personalSessionsDir = path.join(storageRoot, 'Personal', 'Sessions')
    if (await fileSystem.exists(personalSessionsDir)) {
      const personalVaultId = deriveLegacyVaultId('Personal')
      const files = await fileSystem.readdir(personalSessionsDir).catch(() => [])
      let updatedCount = 0
      const sessionFileSummaries: Array<{ file: string; title?: string }> = []

      for (const file of files) {
        if (!file.endsWith('.json')) continue
        const filePath = path.join(personalSessionsDir, path.basename(file))
        try {
          const raw = await fileSystem.readFile(filePath, 'utf8')
          const sanitized = sanitizeSessionJsonContent(raw, 'Personal', personalVaultId)
          let title: string | undefined
          try {
            const p = JSON.parse(sanitized)
            title = p?.session?.title || p?.title
          } catch {
            // ignore
          }
          sessionFileSummaries.push({ file: path.basename(file), title })
          if (sanitized !== raw) {
            await fileSystem.writeFile(filePath, sanitized, 'utf8')
            updatedCount++
          }
        } catch {
          // ignore
        }
      }

      logger.info('[AutoHeal] Personal/Sessions 就地深度清洗完成', {
        totalFiles: sessionFileSummaries.length,
        updatedFiles: updatedCount,
        sessions: sessionFileSummaries.slice(0, 20)
      })
    }

    // 6. SQLite 数据库统一对齐（将所有会话归属和默认助手强制扶正）
    if (sqlExecutor) {
      try {
        const targetVaultId = deriveLegacyVaultId('Personal')
        await runSql(
          sqlExecutor,
          `UPDATE agent_sessions SET vault_id = ? WHERE (vault_id != ? OR vault_id LIKE 'vlt_Personal%' OR vault_name LIKE 'Personal%')`,
          [targetVaultId, targetVaultId]
        )
        await runSql(
          sqlExecutor,
          `UPDATE agent_sessions SET assistant_id = 'latte' WHERE assistant_id = 'default' OR assistant_id IS NULL OR assistant_id = ''`
        )
        logger.info('[AutoHeal] SQLite 数据库会话归属与助手对齐成功', { targetVaultId })
      } catch (sqlErr) {
        logger.warn('[AutoHeal] SQLite 数据库对齐出现非致命异常:', sqlErr as Error)
      }
    }

    // 7. 整理并规范化 vault_registry.json
    const registryPath = path.join(storageRoot, 'vault_registry.json')
    if (await fileSystem.exists(registryPath)) {
      try {
        const rawRegistry = await fileSystem.readFile(registryPath, 'utf8')
        const parsedRegistry = JSON.parse(rawRegistry)
        if (Array.isArray(parsedRegistry)) {
          const removedSet = new Set(result.removedVaults)
          let cleaned = parsedRegistry.filter((v: any) => {
            const name = typeof v?.name === 'string' ? v.name : ''
            if (removedSet.has(name)) return false
            if (/^Personal\d{2,}$/.test(name) && !entriesSet.has(name)) return false
            return true
          })

          const hasPersonal = cleaned.some((v: any) => v?.name === 'Personal')
          if (!hasPersonal) {
            cleaned.unshift({
              id: deriveLegacyVaultId('Personal'),
              name: 'Personal',
              path: path.join(storageRoot, 'Personal'),
              createdAt: new Date().toISOString(),
              lastAccessedAt: new Date().toISOString()
            })
          }

          cleaned = cleaned.map((v: any) => {
            const name = v?.name || 'Personal'
            const defaultId = deriveLegacyVaultId(name)
            return {
              ...v,
              // 若是 Personal 主仓，确保其 ID 对齐为确定性的派生 ID
              id: name === 'Personal' ? defaultId : (isVaultId(v?.id) ? v.id : defaultId)
            }
          })

          await fileSystem.writeFile(registryPath, JSON.stringify(cleaned, null, 2), 'utf8')
          logger.info('[AutoHeal] vault_registry.json 整理完成', {
            vaults: cleaned.map((v: any) => ({ name: v.name, id: v.id }))
          })
        }
      } catch (registryErr) {
        logger.warn('[AutoHeal] 更新 vault_registry.json 失败:', registryErr as Error)
      }
    }

    // 8. 若传入了 vaultService，重新加载 registry 并切回 Personal
    if (vaultService) {
      try {
        await vaultService.initRegistry()
        const active = vaultService.getActiveVault()
        if (!active || active.name !== 'Personal' || result.removedVaults.includes(active.name)) {
          await vaultService.switchVault('Personal')
        }
      } catch {
        // ignore
      }
    }

    if (derivativeVaults.length > 0) {
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
