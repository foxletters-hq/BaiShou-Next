import { useEffect, useState } from 'react'
import { isAssistantAvatarRelativePath, isDefaultAssistantAvatarPath } from '@baishou/shared'
import { useBaishou } from '../providers/BaishouProvider'
import {
  isResolvableAssistantAvatarDirectUri,
  normalizeAssistantAvatarDisplayUri
} from '../lib/assistant-avatar-uri'

/** 将 settings 中的伙伴头像路径解析为可展示的本地 URI */
export function useResolvedAssistantAvatar(avatarPath?: string | null): string | null {
  const { services, dbReady } = useBaishou()
  const [uri, setUri] = useState<string | null>(null)

  useEffect(() => {
    setUri(null)

    if (isDefaultAssistantAvatarPath(avatarPath)) {
      return
    }
    if (avatarPath && isResolvableAssistantAvatarDirectUri(avatarPath)) {
      setUri(normalizeAssistantAvatarDisplayUri(avatarPath))
      return
    }
    if (!avatarPath || !isAssistantAvatarRelativePath(avatarPath) || !dbReady || !services) {
      return
    }
    let cancelled = false
    services.attachmentManager
      .resolveAvatarPath(avatarPath)
      .then((resolved) => {
        if (!cancelled) setUri(normalizeAssistantAvatarDisplayUri(resolved))
      })
      .catch(() => {
        if (!cancelled) setUri(null)
      })
    return () => {
      cancelled = true
    }
  }, [avatarPath, dbReady, services])

  return uri
}
