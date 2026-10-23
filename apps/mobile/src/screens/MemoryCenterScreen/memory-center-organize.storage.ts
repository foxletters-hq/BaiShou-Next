import AsyncStorage from '@react-native-async-storage/async-storage'

export const MEMORY_ORGANIZE_INTERRUPTED_KEY = 'baishou_memory_organize_interrupted'

let cachedMemoryOrganizeInterrupted = false
const listeners = new Set<(interrupted: boolean) => void>()

function emit(value: boolean): void {
  for (const listener of listeners) {
    listener(value)
  }
}

export function getCachedMemoryOrganizeInterrupted(): boolean {
  return cachedMemoryOrganizeInterrupted
}

export async function readMemoryOrganizeInterrupted(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(MEMORY_ORGANIZE_INTERRUPTED_KEY)
    const val = raw === '1' || raw === 'true'
    if (cachedMemoryOrganizeInterrupted !== val) {
      cachedMemoryOrganizeInterrupted = val
      emit(val)
    }
    return val
  } catch {
    return cachedMemoryOrganizeInterrupted
  }
}

export async function writeMemoryOrganizeInterrupted(interrupted: boolean): Promise<void> {
  cachedMemoryOrganizeInterrupted = interrupted
  emit(interrupted)
  try {
    if (interrupted) {
      await AsyncStorage.setItem(MEMORY_ORGANIZE_INTERRUPTED_KEY, '1')
    } else {
      await AsyncStorage.removeItem(MEMORY_ORGANIZE_INTERRUPTED_KEY)
    }
  } catch {
    // 忽略存储写入失败
  }
}

export function subscribeMemoryOrganizeInterrupted(
  listener: (interrupted: boolean) => void
): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** @internal 仅供测试使用 */
export function resetMemoryOrganizeInterruptedForTests(): void {
  cachedMemoryOrganizeInterrupted = false
  listeners.clear()
}
