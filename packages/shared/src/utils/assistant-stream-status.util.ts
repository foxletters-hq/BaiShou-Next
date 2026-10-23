import { normalizePartData } from './message-attachment.util'

export const ASSISTANT_STREAM_STATUS_IN_PROGRESS = 'in_progress'

export function readAssistantStreamStatus(
  parts: ReadonlyArray<{ type?: string; data?: unknown }> | undefined
): typeof ASSISTANT_STREAM_STATUS_IN_PROGRESS | undefined {
  if (!parts?.length) return undefined
  for (const part of parts) {
    const status = normalizePartData(part.data).streamStatus
    if (status === ASSISTANT_STREAM_STATUS_IN_PROGRESS) {
      return ASSISTANT_STREAM_STATUS_IN_PROGRESS
    }
  }
  return undefined
}
