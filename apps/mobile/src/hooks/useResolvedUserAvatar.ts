import { useEffect, useRef, useState } from 'react'
import { useBaishou } from '../providers/BaishouProvider'
import { isCustomUserAvatar } from '@baishou/shared'
import {
  peekUserAvatarDisplayCache,
  resolveUserAvatarForMobileUi
} from '../lib/user-avatar-display.util'

export type ResolvedUserAvatarState = {
  uri: string | null
  /** 自定义头像正在解析为可展示 URI */
  resolving: boolean
}

/** 将 settings 中的用户头像路径解析为可展示的本地 URI */
export function useResolvedUserAvatar(avatarPath?: string | null): ResolvedUserAvatarState {
  const { services, dbReady, vaultRevision } = useBaishou()
  const [uri, setUri] = useState<string | null>(
    () => peekUserAvatarDisplayCache(avatarPath) ?? null
  )
  const [resolving, setResolving] = useState(false)
  const avatarPathRef = useRef(avatarPath)

  useEffect(() => {
    const pathChanged = avatarPathRef.current !== avatarPath
    avatarPathRef.current = avatarPath

    if (!avatarPath || !isCustomUserAvatar(avatarPath)) {
      setUri(null)
      setResolving(false)
      return
    }

    const cached = peekUserAvatarDisplayCache(avatarPath)
    if (cached) {
      setUri(cached)
      setResolving(false)
      return
    }

    if (!dbReady || !services) {
      setResolving(false)
      if (pathChanged) setUri(null)
      return
    }

    if (pathChanged) {
      setUri(null)
    }

    let cancelled = false
    setResolving(true)
    void resolveUserAvatarForMobileUi(
      avatarPath,
      services.attachmentManager,
      services.fileSystem
    )
      .then((resolved) => {
        if (!cancelled) {
          setUri(resolved ?? null)
          setResolving(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUri(null)
          setResolving(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [avatarPath, dbReady, services, vaultRevision])

  return { uri, resolving }
}
