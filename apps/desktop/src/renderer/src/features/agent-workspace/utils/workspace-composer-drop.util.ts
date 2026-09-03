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

export async function resolveWorkspaceComposerDrop(params: {
  dataTransfer: DataTransfer
  folderRoot: string | null
  listDir?: (
    rootPath: string,
    relativePath?: string
  ) => Promise<Array<{ relativePath: string; name: string; isDirectory: boolean }>>
}): Promise<MockChatAttachment[] | null> {
  const relativePaths = collectWorkspaceExplorerRelativePaths(params.dataTransfer)
  if (!relativePaths) return null
  if (!params.folderRoot) return []

  const attachments: MockChatAttachment[] = []
  for (const relativePath of relativePaths) {
    const rel = normalizeRelativePath(relativePath)
    if (!rel || !isSafeWorkspaceRelativePath(rel)) continue
    if (params.listDir) {
      const parent = parentRelativePath(rel)
      let isDirectory = false
      try {
        const entries = await params.listDir(params.folderRoot, parent || undefined)
        const entry = entries.find((item) => item.relativePath === rel || item.name === rel.split('/').pop())
        if (!entry || entry.isDirectory) {
          isDirectory = true
        }
      } catch {
        isDirectory = true
      }
      if (isDirectory) continue
    }
    const fileName = rel.split('/').pop() || rel
    attachments.push(
      attachmentFromWorkspaceFilePath({
        absolutePath: joinWorkspaceAbsolutePath(params.folderRoot, rel),
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
