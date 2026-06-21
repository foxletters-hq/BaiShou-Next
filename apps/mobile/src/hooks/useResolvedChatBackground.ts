import { useEffect, useRef, useState } from 'react'
import { useBaishou } from '../providers/BaishouProvider'
import {
  peekChatBackgroundDisplayCache,
  resolveChatBackgroundForMobileUi
} from '../lib/chat-background-display.util'

/**
 * 将 settings 中的 chatBackgroundPath 解析为移动端 Image 可展示的 URI。
 * 未设置背景时返回 null。
 */
export function useResolvedChatBackground(backgroundPath?: string | null): string | null {
  const { services, dbReady, vaultRevision } = useBaishou()
  const [uri, setUri] = useState<string | null>(
    () => peekChatBackgroundDisplayCache(backgroundPath) ?? null
  )
  const prevPathRef = useRef(backgroundPath)

  useEffect(() => {
    const pathChanged = prevPathRef.current !== backgroundPath
    prevPathRef.current = backgroundPath

    if (!backgroundPath || !dbReady || !services) {
      if (!backgroundPath) setUri(null)
      return
    }

    const cached = peekChatBackgroundDisplayCache(backgroundPath)
    if (cached) {
      setUri(cached)
      return
    }

    if (pathChanged) {
      setUri(null)
    }

    let cancelled = false
    void resolveChatBackgroundForMobileUi(backgroundPath, services.attachmentManager).then(
      (resolved) => {
        if (!cancelled) setUri(resolved)
      }
    )

    return () => {
      cancelled = true
    }
  }, [backgroundPath, dbReady, services, vaultRevision])

  return uri
}
