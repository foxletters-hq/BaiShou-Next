import AsyncStorage from '@react-native-async-storage/async-storage'
import { MEMORY_ONBOARDING_DISMISSED_KEY } from '@baishou/shared'

export async function readMemoryOnboardingDismissed(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(MEMORY_ONBOARDING_DISMISSED_KEY)
    return raw === '1' || raw === 'true'
  } catch {
    return false
  }
}

export async function writeMemoryOnboardingDismissed(): Promise<void> {
  await AsyncStorage.setItem(MEMORY_ONBOARDING_DISMISSED_KEY, '1')
}
