import { Image } from 'react-native'
import type { IAttachmentManager } from '@baishou/core-mobile'
import { loadChatBackgroundLuminance } from './chat-background-luminance.util'

const chatBackgroundDisplayCache = new Map<string, string>()
const prefetchedChatBackgroundUris = new Set<string>()

function prefetchChatBackgroundUri(uri: string): void {
  if (!uri || prefetchedChatBackgroundUris.has(uri)) return
  prefetchedChatBackgroundUris.add(uri)
  try {
    if (typeof Image?.prefetch === 'function') {
      void Image.prefetch(uri).catch(() => undefined)
    }
  } catch {
    // ignore prefetch failures in non-native test environments
  }
  void loadChatBackgroundLuminance(uri).catch(() => undefined)
}

export function invalidateChatBackgroundDisplayCache(backgroundPath?: string): void {
  if (backgroundPath) {
    const existing = chatBackgroundDisplayCache.get(backgroundPath)
    if (existing) prefetchedChatBackgroundUris.delete(existing)
    chatBackgroundDisplayCache.delete(backgroundPath)
    return
  }
  chatBackgroundDisplayCache.clear()
  prefetchedChatBackgroundUris.clear()
}

export function peekChatBackgroundDisplayCache(backgroundPath?: string | null): string | undefined {
  if (!backgroundPath?.startsWith('backgrounds/')) return undefined
  return chatBackgroundDisplayCache.get(backgroundPath)
}

export async function resolveChatBackgroundForMobileUi(
  backgroundPath: string,
  attachmentManager: IAttachmentManager
): Promise<string | null> {
  if (!backgroundPath?.startsWith('backgrounds/')) return null

  const cached = chatBackgroundDisplayCache.get(backgroundPath)
  if (cached) {
    prefetchChatBackgroundUri(cached)
    return cached
  }

  try {
    const resolved = await attachmentManager.resolveBackgroundPath(backgroundPath)
    if (resolved) {
      chatBackgroundDisplayCache.set(backgroundPath, resolved)
      prefetchChatBackgroundUri(resolved)
    }
    return resolved ?? null
  } catch {
    return null
  }
}
