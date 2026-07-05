import AsyncStorage from '@react-native-async-storage/async-storage'

const DEV_LAST_PATHNAME_KEY = '@baishou/dev/last_pathname'

export const FALLBACK_PATH = '/(tabs)/settings'

export function isLanTransferDeepLink(pathOrUrl: string | null | undefined): boolean {
  return Boolean(pathOrUrl?.includes('lan-transfer'))
}

function resolveRestorePath(stored: string | null): string {
  if (!stored || isLanTransferDeepLink(stored)) {
    return FALLBACK_PATH
  }
  return stored
}

async function resolveLanTransferReplay(path: string): Promise<string> {
  const lastPath = await AsyncStorage.getItem(DEV_LAST_PATHNAME_KEY)
  if (lastPath && !isLanTransferDeepLink(lastPath)) {
    return resolveRestorePath(lastPath)
  }
  return path
}

/**
 * 开发环境：Android Reload 后可能回放 `lan-transfer` 深链。
 * 若热重载前用户不在该页，则恢复到上次路径。
 */
export async function resolveDevLanTransferSystemPath(
  path: string,
  initial: boolean
): Promise<string | null> {
  if (!__DEV__) return path

  if (!isLanTransferDeepLink(path)) {
    if (initial) {
      // 正常冷启动：清掉上次路径，避免误用旧会话数据
      await AsyncStorage.removeItem(DEV_LAST_PATHNAME_KEY)
    }
    return path
  }

  return resolveLanTransferReplay(path)
}

export async function persistDevPathname(pathname: string): Promise<void> {
  if (!__DEV__) return
  await AsyncStorage.setItem(DEV_LAST_PATHNAME_KEY, pathname)
}

export { DEV_LAST_PATHNAME_KEY }
