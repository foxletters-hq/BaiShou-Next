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

export function isPathUnderAllowedRoots(
  resolvedPath: string,
  roots: AttachmentAllowedRoots
): boolean {
  return (
    resolvedPath.startsWith(roots.attachmentsBase) || resolvedPath.startsWith(roots.journalsBase)
  )
}
