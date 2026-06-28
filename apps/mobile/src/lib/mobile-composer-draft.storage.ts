import AsyncStorage from '@react-native-async-storage/async-storage'
import type { ComposerDraftStorage } from '@baishou/ui/shared/composer-draft'

export const mobileComposerDraftStorage: ComposerDraftStorage = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key)
}
