import {
  fileToChatAttachment,
  type InputBarAttachment
} from './input-bar-attachment.util'

export type InputBarAttachmentIntake = 'companion' | 'workspace'

/** 与工作台文件树拖放约定一致，仅工作台输入框接受该类型。 */
export const INPUT_BAR_WORKSPACE_EXPLORER_DROP_MIME = 'application/x-baishou-explorer-entry'

export function listDataTransferTypes(dataTransfer: DataTransfer | null): string[] {
  if (!dataTransfer) return []
  return Array.from(dataTransfer.types || [])
}

export function shouldAcceptAttachmentDrag(
  dataTransfer: DataTransfer | null,
  intake: InputBarAttachmentIntake = 'companion'
): boolean {
  const types = listDataTransferTypes(dataTransfer)
  if (types.includes('Files')) return true
  return intake === 'workspace' && types.includes(INPUT_BAR_WORKSPACE_EXPLORER_DROP_MIME)
}

export function collectDroppedFiles(dataTransfer: DataTransfer | null): File[] {
  if (!dataTransfer?.files) return []
  return Array.from(dataTransfer.files)
}

export async function ingestDroppedAttachments(params: {
  dataTransfer: DataTransfer
  intake: InputBarAttachmentIntake
  resolveDropAttachments?: (dataTransfer: DataTransfer) => Promise<InputBarAttachment[] | null>
  fileToAttachment?: (file: File) => Promise<InputBarAttachment>
}): Promise<InputBarAttachment[]> {
  if (params.intake === 'workspace' && params.resolveDropAttachments) {
    const resolved = await params.resolveDropAttachments(params.dataTransfer)
    if (resolved) return resolved
  }
  const files = collectDroppedFiles(params.dataTransfer)
  const toAttachment = params.fileToAttachment ?? fileToChatAttachment
  return Promise.all(files.map((file) => toAttachment(file)))
}
