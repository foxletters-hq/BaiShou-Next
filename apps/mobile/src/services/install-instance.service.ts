import AsyncStorage from '@react-native-async-storage/async-storage'
import { resolveInstallInstanceId } from '@baishou/shared'
import { getAppDocumentDirectory } from './mobile-app-paths'
import * as SandboxFS from './mobile-sandbox-fs'

const INSTALL_INSTANCE_KEY = '@baishou/install_instance_id'

let cachedInstallInstanceId: string | null = null

export async function getMobileInstallInstanceId(): Promise<string> {
  if (cachedInstallInstanceId) return cachedInstallInstanceId

  try {
    const stored = await AsyncStorage.getItem(INSTALL_INSTANCE_KEY)
    if (stored?.trim()) {
      cachedInstallInstanceId = stored.trim()
      return cachedInstallInstanceId
    }
  } catch {
    // fall through to file-backed id
  }

  const baseDir = `${getAppDocumentDirectory()}.baishou_app`
  cachedInstallInstanceId = await resolveInstallInstanceId('mobile', baseDir, {
    exists: async (p) => (await SandboxFS.getInfoAsync(p)).exists,
    read: (p) => SandboxFS.readAsStringAsync(p),
    write: (p, content) => SandboxFS.writeAsStringAsync(p, content),
    mkdir: (p) => SandboxFS.makeDirectoryAsync(p, { intermediates: true })
  })

  try {
    await AsyncStorage.setItem(INSTALL_INSTANCE_KEY, cachedInstallInstanceId)
  } catch {
    // ignore
  }

  return cachedInstallInstanceId
}
