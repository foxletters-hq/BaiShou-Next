import { DEFAULT_BUILTIN_ASSISTANT_AVATAR_PATH } from '@baishou/shared'
import * as path from '../../fs/path.util'
import { DeepSeekImportError } from './deepseek-import.errors'
import {
  buildDeepSeekImportedSessionId,
  buildSessionAggregateFromDeepSeek,
  isSafeDeepSeekExportFilePath,
  type ResolvedDeepSeekImageAttachment
} from './deepseek-import.mapper'
import { loadDeepSeekSessionFile } from './deepseek-import.parser'
import type {
  DeepSeekExportFileMeta,
  DeepSeekImportDeps,
  DeepSeekImportOptions,
  DeepSeekImportResult,
  DeepSeekSessionFile
} from './deepseek-import.types'

const MAX_FAILURE_SAMPLES = 10

function inferMimeTypeFromFileName(fileName: string): string {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.bmp')) return 'image/bmp'
  if (lower.endsWith('.avif')) return 'image/avif'
  return 'image/jpeg'
}

function sanitizeAttachmentFileName(rawName: string, fallbackId: string): string {
  const base = rawName.replace(/[/\\:*?"<>|\0]/g, '_').trim()
  if (!base || base === '.' || base === '..') {
    return `image_${fallbackId}.jpg`
  }
  return base.slice(0, 120)
}

async function copyExportImageAttachment(params: {
  deps: DeepSeekImportDeps
  payloadDir: string
  sourceSessionId: string
  targetSessionId: string
  attachmentsBaseDir: string
  file: DeepSeekExportFileMeta
}): Promise<ResolvedDeepSeekImageAttachment | null> {
  const { deps, payloadDir, sourceSessionId, targetSessionId, attachmentsBaseDir, file } = params
  const exportPath = file.export_path
  if (!exportPath || !isSafeDeepSeekExportFilePath(sourceSessionId, exportPath)) {
    return null
  }

  const srcPath = path.join(payloadDir, exportPath.normalize('NFC'))
  if (!(await deps.fileSystem.exists(srcPath))) {
    return null
  }

  const safeSessionDir = targetSessionId.replace(/[\\/]/g, '_')
  const destDir = path.join(attachmentsBaseDir, safeSessionDir)
  await deps.fileSystem.mkdir(destDir, { recursive: true })

  const safeFileName = sanitizeAttachmentFileName(file.file_name || 'image.jpg', file.id || 'img')
  const uniqueName = `${file.id ? `${file.id.slice(0, 12)}_` : ''}${safeFileName}`
  const destPath = path.join(destDir, uniqueName)
  await deps.fileSystem.copyFile(srcPath, destPath)

  return {
    name: file.file_name || safeFileName,
    fileName: uniqueName,
    filePath: destPath,
    relativePath: `${safeSessionDir}/${uniqueName}`,
    mimeType: inferMimeTypeFromFileName(file.file_name || uniqueName),
    size: typeof file.file_size === 'number' ? file.file_size : undefined
  }
}

async function loadExistingSessionIdSet(
  deps: DeepSeekImportDeps,
  assistantId: string,
  vaultId: string
): Promise<Set<string> | null> {
  if (typeof deps.sessionRepo.findAllSessions !== 'function') return null
  const rows = await deps.sessionRepo.findAllSessions(-1, 0, assistantId, undefined, vaultId)
  return new Set(rows.map((r) => r.id))
}

/**
 * 将已扫描的 DeepSeek 对话批量导入到指定已有伙伴或新建伙伴。
 * 保证 SQLite 与 `<vault>/Sessions/<id>.json` 双写一致，并对同伙伴同源会话自动去重跳过。
 */
export async function importDeepSeekSessions(
  deps: DeepSeekImportDeps,
  options: DeepSeekImportOptions
): Promise<DeepSeekImportResult> {
  const { scanResult, target, vaultId, vaultName, attachmentsBaseDir, onProgress } = options

  onProgress?.({ phase: 'preparing', current: 0, total: 0 })

  const selectedSet = options.selectedSessionIds ? new Set(options.selectedSessionIds) : null
  const targetSessions = selectedSet
    ? scanResult.sessions.filter((s) => selectedSet.has(s.sourceId))
    : scanResult.sessions

  if (targetSessions.length === 0) {
    throw new DeepSeekImportError('EMPTY_ARCHIVE', '请至少选择一条要导入的对话记录')
  }

  let assistantId = ''
  let assistantName = ''
  let createdNewAssistant = false

  if (target.mode === 'existing') {
    const trimmedId = target.assistantId.trim()
    if (!trimmedId) {
      throw new DeepSeekImportError('INVALID_TARGET', '请选择一个已有伙伴作为导入目标')
    }
    assistantId = trimmedId
    if (target.assistantName?.trim()) {
      assistantName = target.assistantName.trim()
    } else if (typeof deps.assistantManager.findById === 'function') {
      const existing = await deps.assistantManager.findById(trimmedId)
      if (!existing) {
        throw new DeepSeekImportError('INVALID_TARGET', '所选目标伙伴不存在，请刷新后重试')
      }
      assistantName = existing.name
    } else {
      assistantName = trimmedId
    }
  } else {
    const trimmedName = target.name.trim()
    if (!trimmedName) {
      throw new DeepSeekImportError('INVALID_TARGET', '请输入新建伙伴的名称')
    }
    onProgress?.({ phase: 'creating_assistant', current: 0, total: targetSessions.length })
    assistantId = `ast-ds-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    assistantName = trimmedName
    await deps.assistantManager.create({
      id: assistantId,
      vaultId,
      name: trimmedName,
      description: target.description?.trim() || '',
      systemPrompt: target.systemPrompt?.trim() || '',
      isDefault: false,
      isPinned: false,
      providerId: target.providerId ?? null,
      modelId: target.modelId ?? null,
      avatarPath: target.avatarPath || DEFAULT_BUILTIN_ASSISTANT_AVATAR_PATH,
      ...(target.contextWindow !== undefined ? { contextWindow: target.contextWindow } : {}),
      ...(target.compressTokenThreshold !== undefined
        ? { compressTokenThreshold: target.compressTokenThreshold }
        : {}),
      ...(target.compressKeepTurns !== undefined
        ? { compressKeepTurns: target.compressKeepTurns }
        : {}),
      ...(target.compressSystemPrompt !== undefined
        ? { compressSystemPrompt: target.compressSystemPrompt }
        : {}),
      assistantKind: target.assistantKind ?? 'companion'
    })
    createdNewAssistant = true
  }

  const existingIds = createdNewAssistant
    ? new Set<string>()
    : await loadExistingSessionIdSet(deps, assistantId, vaultId)

  const legacyCache =
    scanResult.format === 'legacy' ? new Map<string, DeepSeekSessionFile>() : undefined

  let importedSessions = 0
  let importedMessages = 0
  let importedAttachments = 0
  let skippedSessions = 0
  let failedSessions = 0
  const failureSamples: string[] = []
  const importedSessionIds: string[] = []

  for (let i = 0; i < targetSessions.length; i++) {
    const preview = targetSessions[i]!
    onProgress?.({
      phase: 'importing',
      current: i + 1,
      total: targetSessions.length,
      sessionTitle: preview.title || preview.sourceId
    })

    const targetSessionId = buildDeepSeekImportedSessionId(assistantId, preview.sourceId)

    try {
      const alreadyExists = existingIds
        ? existingIds.has(targetSessionId)
        : typeof deps.sessionRepo.getSessionById === 'function'
          ? Boolean(await deps.sessionRepo.getSessionById(targetSessionId))
          : false

      if (alreadyExists) {
        skippedSessions += 1
        continue
      }

      const sourceSession = await loadDeepSeekSessionFile(
        deps.fileSystem,
        scanResult,
        preview,
        legacyCache
      )

      const { aggregate, importedAttachments: sessionAttachments } =
        await buildSessionAggregateFromDeepSeek({
          sourceSession,
          targetSessionId,
          assistantId,
          vaultId,
          vaultName,
          fallbackTitle: preview.title,
          resolveImageAttachment: attachmentsBaseDir
            ? (file) =>
                copyExportImageAttachment({
                  deps,
                  payloadDir: scanResult.payloadDir,
                  sourceSessionId: preview.sourceId,
                  targetSessionId,
                  attachmentsBaseDir,
                  file
                })
            : undefined
        })

      if (aggregate.messages.length === 0) {
        skippedSessions += 1
        continue
      }

      await deps.sessionRepo.upsertAggregate(aggregate)
      await deps.sessionManager.flushSessionToDisk(targetSessionId, vaultName)

      existingIds?.add(targetSessionId)
      importedSessions += 1
      importedMessages += aggregate.messages.length
      importedAttachments += sessionAttachments
      importedSessionIds.push(targetSessionId)
    } catch (error) {
      failedSessions += 1
      if (failureSamples.length < MAX_FAILURE_SAMPLES) {
        const label = preview.title || preview.sourceId
        const detail = error instanceof Error ? error.message : String(error)
        failureSamples.push(`${label}（${detail}）`)
      }
    }
  }

  onProgress?.({
    phase: 'finishing',
    current: targetSessions.length,
    total: targetSessions.length
  })

  return {
    assistantId,
    assistantName,
    createdNewAssistant,
    importedSessions,
    importedMessages,
    importedAttachments,
    skippedSessions,
    failedSessions,
    failureSamples,
    importedSessionIds,
    firstImportedSessionId: importedSessionIds[0] ?? null
  }
}
