import { normalizeRelativePath, parentRelativePath } from './workbench-path.util'

export const WORKBENCH_EXPLORER_DND_MIME = 'application/x-baishou-explorer-entry'

export interface WorkbenchExplorerDndPayload {
  relativePaths: string[]
}

export function isCopyDragModifier(event: { ctrlKey: boolean; altKey: boolean; metaKey: boolean }): boolean {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
  return isMac ? event.altKey : event.ctrlKey
}

export function parseExplorerDndPayload(dataTransfer: DataTransfer | null): WorkbenchExplorerDndPayload | null {
  if (!dataTransfer) return null
  const raw = dataTransfer.getData(WORKBENCH_EXPLORER_DND_MIME)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as WorkbenchExplorerDndPayload
    if (!Array.isArray(parsed.relativePaths)) return null
    return {
      relativePaths: parsed.relativePaths
        .filter((p): p is string => typeof p === 'string')
        .map(normalizeRelativePath)
        .filter(Boolean)
    }
  } catch {
    return null
  }
}

export function writeExplorerDndPayload(
  dataTransfer: DataTransfer,
  payload: WorkbenchExplorerDndPayload
): void {
  dataTransfer.setData(WORKBENCH_EXPLORER_DND_MIME, JSON.stringify(payload))
  dataTransfer.effectAllowed = 'copyMove'
}

/** 拖到文件上时落到其父目录；拖到目录上落到该目录。 */
export function resolveDropTargetDir(params: {
  relativePath: string | null
  isDirectory: boolean
}): string {
  if (params.relativePath == null) return ''
  const path = normalizeRelativePath(params.relativePath)
  if (params.isDirectory) return path
  return parentRelativePath(path)
}

export function canDropExplorerEntries(params: {
  sourcePaths: string[]
  targetDir: string
  isCopy: boolean
}): boolean {
  const targetDir = normalizeRelativePath(params.targetDir)
  if (params.sourcePaths.length === 0) return false

  return params.sourcePaths.every((sourceRaw) => {
    const source = normalizeRelativePath(sourceRaw)
    if (!source) return false
    // 不能拖进自身或其子目录
    if (targetDir === source || targetDir.startsWith(`${source}/`)) return false
    // 非复制时不能拖到当前父目录
    if (!params.isCopy && parentRelativePath(source) === targetDir) return false
    return true
  })
}

export function hasExternalFiles(dataTransfer: DataTransfer | null): boolean {
  if (!dataTransfer) return false
  if (dataTransfer.files && dataTransfer.files.length > 0) return true
  return Array.from(dataTransfer.types || []).includes('Files')
}

export function collectExternalAbsolutePaths(dataTransfer: DataTransfer): string[] {
  const paths: string[] = []
  const files = dataTransfer.files
  for (let i = 0; i < files.length; i += 1) {
    const file = files.item(i)
    if (!file) continue
    try {
      const absolute = window.api.agentWorkspace.getPathForFile(file)
      if (absolute?.trim()) paths.push(absolute)
    } catch {
      // ignore unreadable entries
    }
  }
  return paths
}
