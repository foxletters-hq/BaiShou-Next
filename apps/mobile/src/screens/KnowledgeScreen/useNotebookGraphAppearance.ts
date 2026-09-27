import { useCallback, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  GRAPH_APPEARANCE_STORAGE_KEY,
  GRAPH_FORCE_STORAGE_KEY,
  clampGraphAppearanceSettings,
  clampGraphForceSettings,
  loadGraphAppearanceSettings,
  loadGraphForceSettings,
  saveGraphAppearanceSettings,
  saveGraphForceSettings,
  type GraphAppearanceSettings,
  type GraphForceSettings
} from '@baishou/shared'

export function useNotebookGraphAppearance() {
  const [appearanceSettings, setAppearanceSettings] = useState<GraphAppearanceSettings>(() =>
    clampGraphAppearanceSettings(loadGraphAppearanceSettings())
  )
  const [forceSettings, setForceSettings] = useState<GraphForceSettings>(() =>
    clampGraphForceSettings(loadGraphForceSettings())
  )

  const onAppearanceChange = useCallback((patch: Partial<GraphAppearanceSettings>) => {
    setAppearanceSettings((prev) => {
      const next = clampGraphAppearanceSettings({ ...prev, ...patch })
      saveGraphAppearanceSettings(next)
      void AsyncStorage.setItem(GRAPH_APPEARANCE_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const onForceChange = useCallback((patch: Partial<GraphForceSettings>) => {
    setForceSettings((prev) => {
      const next = clampGraphForceSettings({ ...prev, ...patch })
      saveGraphForceSettings(next)
      void AsyncStorage.setItem(GRAPH_FORCE_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return { appearanceSettings, forceSettings, onAppearanceChange, onForceChange }
}
