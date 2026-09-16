import { classifyPromptAttachmentKind, type MockChatAttachment } from '@baishou/shared'
import {
  parseExplorerDndPayload,
  type WorkbenchExplorerDndPayload
} from '../workbench/workbench-file-explorer-dnd.util'
import {
  isSafeWorkspaceRelativePath,
  normalizeRelativePath,
  parentRelativePath
} from '../workbench/workbench-path.util'

export function joinWorkspaceAbsolutePath(folderRoot: string, relativePath: string): string {
  const base = folderRoot.replace(/[/\\]+$/, '')
  const rel = normalizeRelativePath(relativePath)
  if (!rel || !isSafeWorkspaceRelativePath(rel)) return ''
  const sep = folderRoot.includes('\\') ? '\\' : '/'
  return `${base}${sep}${rel.split('/').join(sep)}`
}

export function classifyComposerDropFile(fileName: string): {
  isImage: boolean
  isPdf: boolean
  isText: boolean
} {
  return classifyPromptAttachmentKind(fileName)
}

export function attachmentFromWorkspaceFilePath(params: {
  absolutePath: string
  fileName: string
  relativePath?: string
}): MockChatAttachment {
  const flags = classifyComposerDropFile(params.fileName)
  return {
    id: Math.random().toString(36).substring(7),
    fileName: params.fileName,
    filePath: params.absolutePath,
    isImage: flags.isImage,
    isPdf: flags.isPdf,
    isText: flags.isText,
    relativePath: params.relativePath,
    origin: 'explorer-drop'
  }
}

export function collectWorkspaceExplorerRelativePaths(
  dataTransfer: DataTransfer
): string[] | null {
  const payload: WorkbenchExplorerDndPayload | null = parseExplorerDndPayload(dataTransfer)
  if (!payload) return null
  return payload.relativePaths
}

async function resolveDroppedPathIsDirectory(params: {
  relativePath: string
  markedDirectory?: boolean
  folderRoot: string
  listDir?: (
    rootPath: string,
    relativePath?: string
  ) => Promise<Array<{ relativePath: string; name: string; isDirectory: boolean }>>
}): Promise<boolean> {
  if (params.markedDirectory === true) return true
  if (params.markedDirectory === false) return false
  if (!params.listDir) return false
  const parent = parentRelativePath(params.relativePath)
  try {
    const entries = await params.listDir(params.folderRoot, parent || undefined)
    const entry = entries.find(
      (item) => item.relativePath === params.relativePath || item.name === params.relativePath.split('/').pop()
    )
    if (!entry) return true
    return entry.isDirectory
  } catch {
    return true
  }
}

export async function resolveWorkspaceComposerDrop(params: {
  dataTransfer: DataTransfer
  folderRoot: string | null
  listDir?: (
    rootPath: string,
    relativePath?: string
  ) => Promise<Array<{ relativePath: string; name: string; isDirectory: boolean }>>
}): Promise<MockChatAttachment[] | null> {
  const payload = parseExplorerDndPayload(params.dataTransfer)
  if (!payload) return null
  if (!params.folderRoot) return []

  const markedByPath = new Map(
    (payload.entries ?? []).map((entry) => [entry.relativePath, entry.isDirectory])
  )
  const attachments: MockChatAttachment[] = []
  for (const relativePath of payload.relativePaths) {
    const rel = normalizeRelativePath(relativePath)
    if (!rel || !isSafeWorkspaceRelativePath(rel)) continue
    const isDirectory = await resolveDroppedPathIsDirectory({
      relativePath: rel,
      markedDirectory: markedByPath.get(rel),
      folderRoot: params.folderRoot,
      listDir: params.listDir
    })
    const fileName = rel.split('/').pop() || rel
    const absolutePath = joinWorkspaceAbsolutePath(params.folderRoot, rel)
    if (isDirectory) {
      attachments.push({
        id: Math.random().toString(36).substring(7),
        fileName,
        filePath: absolutePath,
        relativePath: rel,
        isImage: false,
        isPdf: false,
        isText: false,
        isDirectory: true,
        origin: 'explorer-drop'
      })
      continue
    }
    attachments.push(
      attachmentFromWorkspaceFilePath({
        absolutePath,
        fileName,
        relativePath: rel
      })
    )
  }
  return attachments
}

export function createWorkspaceComposerDropResolver(folderRoot: string | null) {
  return (dataTransfer: DataTransfer) =>
    resolveWorkspaceComposerDrop({
      dataTransfer,
      folderRoot,
      listDir: (rootPath, relativePath) =>
        window.api.agentWorkspace.listDir(rootPath, relativePath)
    })
}
