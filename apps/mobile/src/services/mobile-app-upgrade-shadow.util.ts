import AsyncStorage from '@react-native-async-storage/async-storage'
import { APP_VERSION_NUMBER } from '../app-version'

const STORAGE_KEY = 'baishou_last_shadow_resync_app_version'

/**
 * 检测应用版本是否相对上次启动发生变化。
 * 升级后返回 true，并写入当前版本（每版本仅触发一次强制影子 resync）。
 */
export async function consumeAppUpgradeShadowResync(): Promise<boolean> {
  const current = APP_VERSION_NUMBER
  const last = await AsyncStorage.getItem(STORAGE_KEY)
  if (last === current) return false
  await AsyncStorage.setItem(STORAGE_KEY, current)
  return last != null
}
