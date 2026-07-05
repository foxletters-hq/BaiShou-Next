import { useEffect, useRef } from 'react'
import * as Linking from 'expo-linking'
import { usePathname, useRouter, type Href } from 'expo-router'
import {
  DEV_LAST_PATHNAME_KEY,
  FALLBACK_PATH,
  isLanTransferDeepLink,
  persistDevPathname,
  resolveDevLanTransferSystemPath
} from './dev-lan-transfer-deeplink.util'
import AsyncStorage from '@react-native-async-storage/async-storage'

let devLanReplayRedirectIssued = false

function resolveRestoreHref(stored: string | null): Href {
  if (!stored || isLanTransferDeepLink(stored)) {
    return FALLBACK_PATH as Href
  }
  return stored as Href
}

async function redirectAwayFromLanTransferReplay(
  router: ReturnType<typeof useRouter>
): Promise<void> {
  if (devLanReplayRedirectIssued) return

  const lastPath = await AsyncStorage.getItem(DEV_LAST_PATHNAME_KEY)
  if (!lastPath || isLanTransferDeepLink(lastPath)) return

  devLanReplayRedirectIssued = true
  router.replace(resolveRestoreHref(lastPath))
}

/**
 * 开发环境：记录当前路径；在 +native-intent 未拦住时兜底拦截局域网传输入深链回放。
 */
export function useDevLanTransferDeepLinkReplayGuard() {
  const router = useRouter()
  const pathname = usePathname()
  const pathnameRef = useRef(pathname)
  pathnameRef.current = pathname

  useEffect(() => {
    if (!__DEV__) return
    void persistDevPathname(pathname)
  }, [pathname])

  useEffect(() => {
    if (!__DEV__) return

    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (!isLanTransferDeepLink(url)) return
      void (async () => {
        const path = await resolveDevLanTransferSystemPath(url, false)
        if (path && !isLanTransferDeepLink(path) && !devLanReplayRedirectIssued) {
          devLanReplayRedirectIssued = true
          router.replace(path as Href)
        }
      })()
    })

    return () => subscription.remove()
  }, [router])

  useEffect(() => {
    if (!__DEV__ || !isLanTransferDeepLink(pathname)) return
    void redirectAwayFromLanTransferReplay(router)
  }, [pathname, router])
}
