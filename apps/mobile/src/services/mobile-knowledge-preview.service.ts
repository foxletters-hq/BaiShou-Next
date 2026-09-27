import {
  classifyKnowledgeSourceFile,
  knowledgeSourceFileExt,
  type KnowledgeSourceFileKind
} from '@baishou/shared'
import i18n from 'i18next'
import {
  extractEpubPageTexts,
  loadExtractedKnowledgeWindows,
  probePdfPageTexts,
  recommendVisionExtract
} from '@baishou/core-mobile'
import { toFileUri } from './android-external-fs'
import { createMobileFileSystem } from './create-mobile-file-system'
import { getMobileNotebookRawManager } from './mobile-raw-data-source.runtime'
import { resolveMobileKnowledgeExtractConfig } from './mobile-knowledge-extract-config'
import { requireMobileKnowledgeRepo } from './mobile-knowledge-repo'

export type MobileKnowledgeSourceFilePreview = {
  kind: KnowledgeSourceFileKind
  fileName: string
  localUrl: string | null
  textContent: string | null
  pages?: string[] | null
  originUrl: string | null
}

function requireRepo() {
  return requireMobileKnowledgeRepo()
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function emptyPreview(input: {
  kind: KnowledgeSourceFileKind
  fileName: string
  localUrl?: string | null
  originUrl?: string | null
}): MobileKnowledgeSourceFilePreview {
  return {
    kind: input.kind,
    fileName: input.fileName,
    localUrl: input.localUrl ?? null,
    textContent: null,
    originUrl: input.originUrl ?? null
  }
}

export async function mobileGetSourceFile(input: {
  sourceId: string
}): Promise<MobileKnowledgeSourceFilePreview> {
  const sourceId = input.sourceId.trim()
  if (!sourceId) throw new Error('sourceId required')
  const source = await requireRepo().getSource(sourceId)
  if (!source) throw new Error(`source not found: ${sourceId}`)

  const fileNameFromPath = source.relativePath
    ? source.relativePath.split(/[/\\]/).pop() || source.title
    : source.title
  const ext = knowledgeSourceFileExt(fileNameFromPath || '')
  const kind = classifyKnowledgeSourceFile({
    hasRelativePath: Boolean(source.relativePath),
    sourceKind: source.sourceKind,
    ext
  })

  if (!source.relativePath) {
    return emptyPreview({
      kind: 'unsupported',
      fileName: source.title,
      originUrl: source.originUrl ?? null
    })
  }

  const manager = getMobileNotebookRawManager()
  if (!manager) throw new Error('notebook manager unavailable')
  const abs = await manager.absolutePath(source.relativePath)
  const localUrl = toFileUri(abs)
  const fileName = fileNameFromPath || source.title

  if (kind === 'pdf') {
    return emptyPreview({ kind: 'pdf', fileName, localUrl, originUrl: source.originUrl ?? null })
  }

  const fileSystem = createMobileFileSystem()
  if (kind === 'epub') {
    const encoded = await fileSystem.readFile(abs, 'base64')
    let pages: string[]
    try {
      pages = extractEpubPageTexts(base64ToUint8Array(encoded))
    } catch {
      throw new Error(i18n.t('knowledge.epub_preview_failed', '这份 EPUB 暂时无法预览'))
    }
    return {
      kind: 'epub',
      fileName,
      localUrl,
      textContent: null,
      pages,
      originUrl: source.originUrl ?? null
    }
  }

  if (kind === 'text' || kind === 'url') {
    const textContent = await fileSystem.readFile(abs, 'utf8')
    return {
      kind,
      fileName,
      localUrl,
      textContent,
      originUrl: source.originUrl ?? null
    }
  }

  return emptyPreview({
    kind: 'unsupported',
    fileName,
    localUrl,
    originUrl: source.originUrl ?? null
  })
}

export async function mobileGetExtractedWindows(input: {
  notebookId: string
  windows: Array<{ sourceId: string; windowIndex: number }>
}) {
  const notebookId = input.notebookId.trim()
  if (!notebookId) throw new Error('notebookId required')
  const repo = requireRepo()
  const manager = getMobileNotebookRawManager()
  if (!manager) throw new Error('notebook manager unavailable')
  const items = await loadExtractedKnowledgeWindows({
    notebookId,
    windows: Array.isArray(input.windows) ? input.windows : [],
    readExtractedText: (nb, sourceId) => manager.readExtractedText(nb, sourceId),
    readPagesJson: (nb, sourceId) => manager.readPagesJson(nb, sourceId),
    getSource: async (sourceId) => {
      const source = await repo.getSource(sourceId)
      return source ? { notebookId: source.notebookId, title: source.title } : null
    }
  })
  return { items }
}

export async function mobileProbeExtractHint(input: { absolutePath?: string; sourceId?: string }) {
  let filePath = String(input.absolutePath || '').trim()
  let fileName = filePath ? filePath.split(/[/\\]/).pop() || '' : ''
  if (!filePath && input?.sourceId) {
    const source = await requireRepo().getSource(String(input.sourceId))
    if (!source?.relativePath) throw new Error('source file not found')
    const manager = getMobileNotebookRawManager()
    if (!manager) throw new Error('notebook manager unavailable')
    filePath = await manager.absolutePath(source.relativePath)
    fileName = source.title || filePath.split(/[/\\]/).pop() || ''
  }
  if (!filePath) throw new Error('absolutePath or sourceId required')
  const vision = await resolveMobileKnowledgeExtractConfig()
  const ext = knowledgeSourceFileExt(filePath)
  if (ext !== '.pdf') {
    return {
      recommendVision: false,
      reason: null,
      sampledPages: 0,
      usableTextPages: 0,
      garbledPages: 0,
      emptyPages: 0,
      fileName,
      visionConfigured: vision.visionModelConfigured,
      visionModelId: vision.visionModelId
    }
  }
  const pages = await probePdfPageTexts(filePath, 12)
  const hint = recommendVisionExtract(pages)
  return {
    ...hint,
    fileName,
    visionConfigured: vision.visionModelConfigured,
    visionModelId: vision.visionModelId
  }
}
