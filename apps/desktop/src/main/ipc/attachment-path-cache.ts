import path from 'node:path'
import type { DesktopStoragePathService } from '../services/path.service'

export type AttachmentAllowedRoots = {
  attachmentsBase: string
  journalsBase: string
}

let allowedRootsPromise: Promise<AttachmentAllowedRoots> | null = null

export function getAttachmentAllowedRoots(
  pathService: DesktopStoragePathService
): Promise<AttachmentAllowedRoots> {
  if (!allowedRootsPromise) {
    allowedRootsPromise = Promise.all([
      pathService.getAttachmentsBaseDirectory(),
      pathService.getJournalsBaseDirectory()
    ]).then(([attachmentsBase, journalsBase]) => ({ attachmentsBase, journalsBase }))
  }
  return allowedRootsPromise
}

export function resetAttachmentAllowedRootsCache(): void {
  allowedRootsPromise = null
}

function isPathUnderRoot(targetPath: string, rootPath: string): boolean {
  const root = path.resolve(rootPath)
  const target = path.resolve(targetPath)
  const relative = path.relative(root, target)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

export function isPathUnderAllowedRoots(
  resolvedPath: string,
  roots: AttachmentAllowedRoots
): boolean {
  return (
    isPathUnderRoot(resolvedPath, roots.attachmentsBase) ||
    isPathUnderRoot(resolvedPath, roots.journalsBase)
  )
}
