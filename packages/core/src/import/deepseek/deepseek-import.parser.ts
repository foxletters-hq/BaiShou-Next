import * as path from '../../fs/path.util'
import type { IFileSystem } from '../../fs/file-system.types'
import { DeepSeekImportError } from './deepseek-import.errors'
import {
  extractMainMessageChain,
  isSafeDeepSeekSessionId,
  toValidDeepSeekDate
} from './deepseek-import.mapper'
import type {
  DeepSeekArchiveScanResult,
  DeepSeekFragment,
  DeepSeekManifest,
  DeepSeekRawMessage,
  DeepSeekSessionFile,
  DeepSeekSessionIndexItem,
  DeepSeekSessionPreview
} from './deepseek-import.types'

const SUPPORTED_EXPORT_FORMAT_VERSION = 3
const UNWRAP_SKIP_TOP_LEVEL = new Set(['__MACOSX'])

interface LegacyConversationNode {
  id?: string
  parent?: string | null
  children?: string[]
  message?: {
    inserted_at?: string
    role?: string
    content?: string
    fragments?: DeepSeekFragment[]
    status?: string
    thinking_enabled?: boolean
    search_enabled?: boolean
  } | null
}

interface LegacyConversation {
  id?: string
  title?: string | null
  inserted_at?: string | null
  updated_at?: string | null
  mapping?: Record<string, LegacyConversationNode>
}

function toIsoString(value: unknown, fallback?: Date): string {
  return toValidDeepSeekDate(value, fallback).toISOString()
}

async function hasDeepSeekMarkers(fileSystem: IFileSystem, dir: string): Promise<boolean> {
  if (await fileSystem.exists(path.join(dir, 'manifest.json'))) return true
  if (await fileSystem.exists(path.join(dir, 'conversations.json'))) return true
  if (await fileSystem.exists(path.join(dir, 'chat_session_index.json'))) return true
  return false
}

/** 解压目录仅包含单一外层包裹目录时自动下钻一层，兼容重新打包的 ZIP */
export async function resolveDeepSeekPayloadRoot(
  fileSystem: IFileSystem,
  extractDir: string
): Promise<string> {
  if (await hasDeepSeekMarkers(fileSystem, extractDir)) return extractDir

  let entries: string[]
  try {
    entries = await fileSystem.readdir(extractDir)
  } catch {
    return extractDir
  }

  const candidates = entries.filter(
    (name) => name && name !== '.' && name !== '..' && !UNWRAP_SKIP_TOP_LEVEL.has(name)
  )
  if (candidates.length !== 1) return extractDir

  const nested = path.join(extractDir, candidates[0]!)
  try {
    const stat = await fileSystem.stat(nested)
    if (!stat.isDirectory) return extractDir
  } catch {
    return extractDir
  }

  if (await hasDeepSeekMarkers(fileSystem, nested)) {
    return nested
  }
  return extractDir
}

async function readJsonFile<T>(fileSystem: IFileSystem, filePath: string): Promise<T> {
  const raw = await fileSystem.readFile(filePath, 'utf8')
  try {
    return JSON.parse(raw) as T
  } catch (error) {
    throw new DeepSeekImportError(
      'INVALID_JSON',
      '导出包内存在损坏的 JSON 文件，无法解析',
      error instanceof Error ? error.message : String(error)
    )
  }
}

function summarizeSessionFeatures(messages: ReadonlyArray<DeepSeekRawMessage>): {
  hasThinking: boolean
  hasSearch: boolean
  imageCount: number
} {
  let hasThinking = false
  let hasSearch = false
  let imageCount = 0

  for (const msg of messages) {
    if (msg.thinking_enabled) hasThinking = true
    for (const frag of msg.fragments ?? []) {
      if (!frag || typeof frag !== 'object') continue
      if (frag.type === 'THINK' && typeof frag.content === 'string' && frag.content.trim()) {
        hasThinking = true
      } else if (
        frag.type === 'TOOL_SEARCH' ||
        frag.type === 'TOOL_OPEN' ||
        frag.type === 'READ_LINK' ||
        frag.type === 'TOOL_IMAGE_SEARCH'
      ) {
        hasSearch = true
      } else if (frag.type === 'FILE' && Array.isArray(frag.files)) {
        for (const f of frag.files) {
          if (f?.is_image && typeof f.export_path === 'string' && f.export_path.trim()) {
            imageCount += 1
          }
        }
      }
    }
  }

  return { hasThinking, hasSearch, imageCount }
}

/** 将旧版 DeepSeek `conversations.json` 单条会话的 mapping 树规范化为通用 v3 会话结构 */
export function convertLegacyConversationToSessionFile(
  conv: LegacyConversation,
  fallbackIndex: number
): DeepSeekSessionFile | null {
  if (!conv || typeof conv !== 'object') return null
  const id =
    typeof conv.id === 'string' && isSafeDeepSeekSessionId(conv.id)
      ? conv.id
      : `legacy_${fallbackIndex + 1}`
  const mapping = conv.mapping
  if (!mapping || typeof mapping !== 'object') return null

  const rootNode =
    mapping['root'] ??
    Object.values(mapping).find((node) => node && (node.parent == null || node.parent === ''))

  const orderedNodes: LegacyConversationNode[] = []
  const visited = new Set<string>()
  let current: LegacyConversationNode | undefined = rootNode

  while (current) {
    const nodeId = typeof current.id === 'string' ? current.id : ''
    if (nodeId) {
      if (visited.has(nodeId)) break
      visited.add(nodeId)
    }
    if (current.message) {
      orderedNodes.push(current)
    }
    const children: string[] = Array.isArray(current.children) ? current.children : []
    const nextId: string | undefined =
      children.length > 0 ? children[children.length - 1] : undefined
    current = nextId ? mapping[nextId] : undefined
  }

  const messages: DeepSeekRawMessage[] = []
  let seqId = 1
  for (const node of orderedNodes) {
    const m = node.message
    if (!m) continue
    const fragments: DeepSeekFragment[] = []
    if (Array.isArray(m.fragments) && m.fragments.length > 0) {
      fragments.push(...m.fragments)
    } else if (typeof m.content === 'string' && m.content.trim()) {
      const upperRole = String(m.role ?? '').toUpperCase()
      fragments.push({
        type: upperRole === 'ASSISTANT' ? 'RESPONSE' : 'REQUEST',
        content: m.content
      })
    }
    if (fragments.length === 0) continue

    const explicitRole = String(m.role ?? '').toUpperCase()
    const inferredRole =
      explicitRole === 'USER' || explicitRole === 'ASSISTANT'
        ? explicitRole
        : fragments.some((f) => f.type === 'REQUEST' || f.type === 'FILE')
          ? 'USER'
          : 'ASSISTANT'

    messages.push({
      id: seqId,
      parent_id: seqId === 1 ? null : seqId - 1,
      role: inferredRole,
      status: m.status ?? 'FINISHED',
      thinking_enabled: Boolean(m.thinking_enabled),
      search_enabled: Boolean(m.search_enabled),
      inserted_at: m.inserted_at ?? conv.inserted_at ?? null,
      fragments
    })
    seqId += 1
  }

  return {
    id,
    title: conv.title ?? null,
    pinned: false,
    current_message_id: messages.length > 0 ? messages[messages.length - 1]!.id : null,
    inserted_at: conv.inserted_at ?? null,
    updated_at: conv.updated_at ?? conv.inserted_at ?? null,
    messages
  }
}

async function scanV3Archive(
  fileSystem: IFileSystem,
  payloadDir: string,
  manifest: DeepSeekManifest
): Promise<DeepSeekArchiveScanResult> {
  const version = manifest.export_format_version
  if (typeof version === 'number' && version > SUPPORTED_EXPORT_FORMAT_VERSION) {
    throw new DeepSeekImportError(
      'NEWER_VERSION',
      `该导出包格式版本（v${version}）高于当前支持版本（v${SUPPORTED_EXPORT_FORMAT_VERSION}），请更新应用后重试`
    )
  }
  if (version !== SUPPORTED_EXPORT_FORMAT_VERSION) {
    throw new DeepSeekImportError(
      'UNSUPPORTED_VERSION',
      '不支持的 DeepSeek 导出包版本，请前往 DeepSeek 重新导出最新格式数据'
    )
  }

  const warnings: string[] = []
  const sessionsDir = path.join(payloadDir, 'chat_sessions')
  const indexPath = path.join(payloadDir, 'chat_session_index.json')

  const indexMap = new Map<string, DeepSeekSessionIndexItem>()
  if (await fileSystem.exists(indexPath)) {
    const rawIndex = await readJsonFile<unknown>(fileSystem, indexPath)
    if (Array.isArray(rawIndex)) {
      for (const item of rawIndex) {
        if (
          item &&
          typeof item === 'object' &&
          typeof (item as DeepSeekSessionIndexItem).id === 'string' &&
          isSafeDeepSeekSessionId((item as DeepSeekSessionIndexItem).id)
        ) {
          const typed = item as DeepSeekSessionIndexItem
          indexMap.set(typed.id, typed)
        }
      }
    }
  }

  let diskFiles: string[] = []
  if (await fileSystem.exists(sessionsDir)) {
    const entries = await fileSystem.readdir(sessionsDir)
    diskFiles = entries.filter((name) => name.endsWith('.json'))
  }

  const candidateIds = new Set<string>(indexMap.keys())
  for (const fileName of diskFiles) {
    const id = fileName.slice(0, -5)
    if (isSafeDeepSeekSessionId(id)) {
      candidateIds.add(id)
    }
  }

  const sessions: DeepSeekSessionPreview[] = []
  for (const sourceId of candidateIds) {
    const relPath = `chat_sessions/${sourceId}.json`
    const fullPath = path.join(payloadDir, relPath)
    if (!(await fileSystem.exists(fullPath))) {
      warnings.push(`会话文件缺失：${sourceId}`)
      continue
    }

    try {
      const sessionJson = await readJsonFile<DeepSeekSessionFile>(fileSystem, fullPath)
      const indexEntry = indexMap.get(sourceId)
      const rawMessages = Array.isArray(sessionJson.messages) ? sessionJson.messages : []
      const activeChain = extractMainMessageChain(rawMessages, sessionJson.current_message_id)
      const features = summarizeSessionFeatures(activeChain)
      const insertedAt = toIsoString(sessionJson.inserted_at ?? indexEntry?.inserted_at)
      const updatedAt = toIsoString(
        sessionJson.updated_at ?? indexEntry?.updated_at ?? insertedAt,
        toValidDeepSeekDate(insertedAt)
      )
      const title =
        (typeof sessionJson.title === 'string' && sessionJson.title.trim()) ||
        (typeof indexEntry?.title === 'string' && indexEntry.title.trim()) ||
        ''

      sessions.push({
        sourceId,
        title,
        pinned: Boolean(sessionJson.pinned ?? indexEntry?.pinned),
        messageCount: activeChain.length,
        insertedAt,
        updatedAt,
        hasThinking: features.hasThinking,
        hasSearch: features.hasSearch,
        imageCount: features.imageCount,
        sessionFilePath: relPath
      })
    } catch (error) {
      warnings.push(
        `跳过无法解析的会话 ${sourceId}：${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  return finalizeScanResult({
    format: 'v3',
    exportFormatVersion: SUPPORTED_EXPORT_FORMAT_VERSION,
    payloadDir,
    sessions,
    warnings
  })
}

async function scanLegacyArchive(
  fileSystem: IFileSystem,
  payloadDir: string,
  conversationsPath: string
): Promise<DeepSeekArchiveScanResult> {
  const warnings: string[] = []
  const raw = await readJsonFile<unknown>(fileSystem, conversationsPath)
  if (!Array.isArray(raw)) {
    throw new DeepSeekImportError(
      'UNRECOGNIZED_ARCHIVE',
      '未识别到有效的 DeepSeek 对话列表（conversations.json 格式不正确）'
    )
  }

  const sessions: DeepSeekSessionPreview[] = []
  for (let i = 0; i < raw.length; i++) {
    const normalized = convertLegacyConversationToSessionFile(raw[i] as LegacyConversation, i)
    if (!normalized || !normalized.messages?.length) continue
    const features = summarizeSessionFeatures(normalized.messages)
    const insertedAt = toIsoString(normalized.inserted_at)
    const updatedAt = toIsoString(
      normalized.updated_at ?? insertedAt,
      toValidDeepSeekDate(insertedAt)
    )
    sessions.push({
      sourceId: normalized.id,
      title: (normalized.title ?? '').trim(),
      pinned: Boolean(normalized.pinned),
      messageCount: normalized.messages.length,
      insertedAt,
      updatedAt,
      hasThinking: features.hasThinking,
      hasSearch: features.hasSearch,
      imageCount: features.imageCount
    })
  }

  return finalizeScanResult({
    format: 'legacy',
    exportFormatVersion: null,
    payloadDir,
    sessions,
    warnings
  })
}

function finalizeScanResult(params: {
  format: 'v3' | 'legacy'
  exportFormatVersion: number | null
  payloadDir: string
  sessions: DeepSeekSessionPreview[]
  warnings: string[]
}): DeepSeekArchiveScanResult {
  const { format, exportFormatVersion, payloadDir, sessions, warnings } = params
  if (sessions.length === 0) {
    throw new DeepSeekImportError('EMPTY_ARCHIVE', '该导出包中没有找到可导入的对话记录')
  }

  sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

  let totalMessages = 0
  let earliestMs = Number.POSITIVE_INFINITY
  let latestMs = Number.NEGATIVE_INFINITY
  for (const s of sessions) {
    totalMessages += s.messageCount
    const ins = new Date(s.insertedAt).getTime()
    const upd = new Date(s.updatedAt).getTime()
    if (Number.isFinite(ins) && ins < earliestMs) earliestMs = ins
    if (Number.isFinite(upd) && upd > latestMs) latestMs = upd
  }

  return {
    format,
    exportFormatVersion,
    payloadDir,
    sessions,
    totalMessages,
    earliestAt: Number.isFinite(earliestMs) ? new Date(earliestMs).toISOString() : null,
    latestAt: Number.isFinite(latestMs) ? new Date(latestMs).toISOString() : null,
    warnings
  }
}

/**
 * 扫描已解压的 DeepSeek 导出目录，自动识别 v3（`manifest.json` + `chat_sessions/`）
 * 以及旧版（`conversations.json`），返回会话预览清单。
 */
export async function scanDeepSeekExtractedArchive(
  fileSystem: IFileSystem,
  extractDir: string
): Promise<DeepSeekArchiveScanResult> {
  const payloadDir = await resolveDeepSeekPayloadRoot(fileSystem, extractDir)
  const manifestPath = path.join(payloadDir, 'manifest.json')
  const conversationsPath = path.join(payloadDir, 'conversations.json')

  if (await fileSystem.exists(manifestPath)) {
    const manifest = await readJsonFile<DeepSeekManifest>(fileSystem, manifestPath)
    if (manifest && typeof manifest === 'object' && 'export_format_version' in manifest) {
      return scanV3Archive(fileSystem, payloadDir, manifest)
    }
  }

  if (await fileSystem.exists(conversationsPath)) {
    return scanLegacyArchive(fileSystem, payloadDir, conversationsPath)
  }

  throw new DeepSeekImportError(
    'UNRECOGNIZED_ARCHIVE',
    '未识别到 DeepSeek 数据导出文件，请确认选择的是从 DeepSeek 导出的 ZIP 压缩包'
  )
}

/** 读取已扫描目录中的单条完整会话数据 */
export async function loadDeepSeekSessionFile(
  fileSystem: IFileSystem,
  scanResult: DeepSeekArchiveScanResult,
  preview: DeepSeekSessionPreview,
  legacyCache?: Map<string, DeepSeekSessionFile>
): Promise<DeepSeekSessionFile> {
  if (scanResult.format === 'v3') {
    const relPath = preview.sessionFilePath ?? `chat_sessions/${preview.sourceId}.json`
    const fullPath = path.join(scanResult.payloadDir, relPath)
    return readJsonFile<DeepSeekSessionFile>(fileSystem, fullPath)
  }

  if (legacyCache?.has(preview.sourceId)) {
    return legacyCache.get(preview.sourceId)!
  }

  const conversationsPath = path.join(scanResult.payloadDir, 'conversations.json')
  const raw = await readJsonFile<unknown>(fileSystem, conversationsPath)
  if (Array.isArray(raw)) {
    for (let i = 0; i < raw.length; i++) {
      const normalized = convertLegacyConversationToSessionFile(raw[i] as LegacyConversation, i)
      if (!normalized) continue
      legacyCache?.set(normalized.id, normalized)
    }
  }

  const found = legacyCache?.get(preview.sourceId)
  if (!found) {
    throw new DeepSeekImportError(
      'INVALID_JSON',
      `未在 conversations.json 中找到会话 ${preview.sourceId}`
    )
  }
  return found
}
