import type { IAttachmentManager } from '@baishou/core-mobile'

const chatBackgroundDisplayCache = new Map<string, string>()

export function invalidateChatBackgroundDisplayCache(backgroundPath?: string): void {
  if (backgroundPath) {
    chatBackgroundDisplayCache.delete(backgroundPath)
    return
  }
  chatBackgroundDisplayCache.clear()
}

export function peekChatBackgroundDisplayCache(
  backgroundPath?: string | null
): string | undefined {
  if (!backgroundPath?.startsWith('backgrounds/')) return undefined
  return chatBackgroundDisplayCache.get(backgroundPath)
}

export async function resolveChatBackgroundForMobileUi(
  backgroundPath: string,
  attachmentManager: IAttachmentManager
): Promise<string | null> {
  if (!backgroundPath?.startsWith('backgrounds/')) return null

  const cached = chatBackgroundDisplayCache.get(backgroundPath)
  if (cached) return cached

  try {
    const resolved = await attachmentManager.resolveBackgroundPath(backgroundPath)
    if (resolved) {
      chatBackgroundDisplayCache.set(backgroundPath, resolved)
    }
    return resolved ?? null
  } catch {
    return null
  }
}
