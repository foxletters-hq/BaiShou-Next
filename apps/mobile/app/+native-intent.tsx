import { resolveDevLanTransferSystemPath } from '@/src/navigation/dev-lan-transfer-deeplink.util'

/**
 * 在 expo-router 解析初始 URL 之前拦截局域网传输入深链回放（开发环境）。
 * @see https://docs.expo.dev/router/advanced/native-intent/
 */
export function redirectSystemPath({
  path,
  initial
}: {
  path: string
  initial: boolean
}): string | null | Promise<string | null> {
  if (!__DEV__) {
    return path
  }
  return resolveDevLanTransferSystemPath(path, initial)
}
