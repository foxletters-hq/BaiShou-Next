import { useCallback, useEffect, useRef, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAgentStore } from '@baishou/store'

export function useAgentScreenPreferences() {
  const searchMode = useAgentStore((s) => s.searchMode)
  const setSearchMode = useAgentStore((s) => s.setSearchMode)

  const [ttsMode, setTtsMode] = useState<'manual' | 'always'>(() => 'manual')
  const ttsModeRef = useRef(ttsMode)
  ttsModeRef.current = ttsMode

  const toggleTtsMode = useCallback(() => {
    setTtsMode((prev) => {
      const next = prev === 'manual' ? 'always' : 'manual'
      AsyncStorage.setItem('baishou_tts_mode', next).catch(() => {})
      return next
    })
  }, [])

  useEffect(() => {
    AsyncStorage.getItem('baishou_tts_mode')
      .then((v) => {
        if (v === 'always') {
          setTtsMode('always')
        } else if (v === 'off' || v === 'manual') {
          setTtsMode('manual')
          if (v === 'off') {
            AsyncStorage.setItem('baishou_tts_mode', 'manual').catch(() => {})
          }
        }
      })
      .catch(() => {})
  }, [])

  const searchModeLoadedRef = useRef(false)
  useEffect(() => {
    AsyncStorage.getItem('baishou_search_mode')
      .then((v) => {
        if (v != null) {
          setSearchMode(v === 'true')
        }
        searchModeLoadedRef.current = true
      })
      .catch(() => {
        searchModeLoadedRef.current = true
      })
  }, [setSearchMode])

  useEffect(() => {
    if (!searchModeLoadedRef.current) return
    AsyncStorage.setItem('baishou_search_mode', String(searchMode)).catch(() => {})
  }, [searchMode])

  return { ttsMode, ttsModeRef, toggleTtsMode }
}
