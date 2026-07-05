import { useCallback, useEffect, useRef } from 'react'
import type { ComposerDraftPayload, ComposerDraftStorage } from './composer-draft.types'

const SAVE_DEBOUNCE_MS = 400

function parseDraft(raw: string | null): ComposerDraftPayload | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as ComposerDraftPayload
    if (typeof parsed?.text !== 'string') return null
    return { text: parsed.text }
  } catch {
    return null
  }
}

export function useComposerDraft(options: {
  draftKey?: string
  draftStorage?: ComposerDraftStorage
  text: string
  setText: (value: string | ((prev: string) => string)) => void
  /** 发送进行中时暂停草稿同步，避免 sessionId 中途变更清空输入 */
  draftSyncSuspended?: boolean
}) {
  const { draftKey, draftStorage, text, setText, draftSyncSuspended = false } = options
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadedKeyRef = useRef<string | null>(null)
  const appliedKeyRef = useRef<string | null>(null)

  const clearDraft = useCallback(async () => {
    if (!draftKey || !draftStorage) return
    try {
      await draftStorage.removeItem(draftKey)
    } catch {
      /* ignore */
    }
  }, [draftKey, draftStorage])

  useEffect(() => {
    if (!draftKey || !draftStorage) {
      loadedKeyRef.current = null
      appliedKeyRef.current = null
      return
    }

    if (draftSyncSuspended) return

    if (appliedKeyRef.current === draftKey && loadedKeyRef.current === draftKey) {
      return
    }

    let cancelled = false
    loadedKeyRef.current = null
    appliedKeyRef.current = draftKey
    setText('')

    void (async () => {
      try {
        const raw = await draftStorage.getItem(draftKey)
        if (cancelled) return
        const draft = parseDraft(raw)
        loadedKeyRef.current = draftKey
        setText(draft?.text ?? '')
      } catch {
        if (!cancelled) loadedKeyRef.current = draftKey
      }
    })()

    return () => {
      cancelled = true
    }
  }, [draftKey, draftStorage, draftSyncSuspended, setText])

  useEffect(() => {
    if (!draftKey || !draftStorage) return
    if (loadedKeyRef.current !== draftKey) return

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      void (async () => {
        try {
          const trimmed = text.trim()
          if (!trimmed) {
            await draftStorage.removeItem(draftKey)
            return
          }
          const payload: ComposerDraftPayload = { text }
          await draftStorage.setItem(draftKey, JSON.stringify(payload))
        } catch {
          /* ignore */
        }
      })()
    }, SAVE_DEBOUNCE_MS)

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [draftKey, draftStorage, text])

  return { clearDraft }
}
