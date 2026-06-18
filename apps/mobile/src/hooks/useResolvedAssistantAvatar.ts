import { useEffect, useRef, useState } from 'react'
import { useBaishou } from '../providers/BaishouProvider'
import {
  peekAssistantAvatarDisplayCache,
  resolveAssistantAvatarForMobileUi
} from '../lib/assistant-avatar-display.util'

/** 将 settings 中的伙伴头像路径解析为可展示的本地 URI */
export function useResolvedAssistantAvatar(avatarPath?: string | null): string | null {
  const { services, dbReady, vaultRevision } = useBaishou()
  const [uri, setUri] = useState<string | null>(
    () => peekAssistantAvatarDisplayCache(avatarPath) ?? null
  )
  const avatarPathRef = useRef(avatarPath)

  useEffect(() => {
    const pathChanged = avatarPathRef.current !== avatarPath
    avatarPathRef.current = avatarPath

    if (!avatarPath || !dbReady || !services) {
      if (!avatarPath) setUri(null)
      return
    }

    const cached = peekAssistantAvatarDisplayCache(avatarPath)
    if (cached) {
      setUri(cached)
      return
    }

    if (pathChanged) {
      setUri(null)
    }

    let cancelled = false
    void resolveAssistantAvatarForMobileUi(
      avatarPath,
      services.attachmentManager,
      services.fileSystem
    ).then((resolved) => {
      if (!cancelled) setUri(resolved ?? null)
    })

    return () => {
      cancelled = true
    }
  }, [avatarPath, dbReady, services, vaultRevision])

  return uri
}
