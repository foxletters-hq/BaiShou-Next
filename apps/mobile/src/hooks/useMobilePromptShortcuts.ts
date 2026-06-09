import { useCallback, useEffect, useRef, useState } from 'react'
import type { PromptShortcut } from '@baishou/shared'
import { logger, SHORTCUT_TRACE_CHAIN, traceCall } from '@baishou/shared'
import { useTranslation } from 'react-i18next'
import { useNativeToast } from '@baishou/ui/native'
import { useBaishou } from '../providers/BaishouProvider'

const PROMPT_SHORTCUTS_KEY = 'prompt_shortcuts_v2'

export function useMobilePromptShortcuts(showSheet: boolean) {
  const { t } = useTranslation()
  const toast = useNativeToast()
  const { services, dbReady } = useBaishou()
  const [shortcuts, setShortcuts] = useState<PromptShortcut[]>([])
  const shortcutsRef = useRef<PromptShortcut[]>([])
  const loadGenRef = useRef(0)
  shortcutsRef.current = shortcuts

  const loadShortcuts = useCallback(async () => {
    if (!dbReady || !services) {
      logger.warn(`[${SHORTCUT_TRACE_CHAIN}] MobileHook.load.skip`, {
        dbReady,
        hasServices: Boolean(services)
      })
      return
    }

    const gen = ++loadGenRef.current

    try {
      const items = await traceCall(
        SHORTCUT_TRACE_CHAIN,
        'MobileHook.load',
        async () => {
          let loaded =
            (await services.settingsManager.get<PromptShortcut[]>(PROMPT_SHORTCUTS_KEY)) ?? []
          if (!Array.isArray(loaded)) {
            loaded = []
          }
          if (!loaded.length) {
            const legacy =
              (await services.settingsManager.get<PromptShortcut[]>('prompt_shortcuts')) ?? []
            if (Array.isArray(legacy) && legacy.length) {
              loaded = legacy
              await services.settingsManager.set(PROMPT_SHORTCUTS_KEY, legacy)
            }
          }
          return loaded
        },
        { key: PROMPT_SHORTCUTS_KEY, gen }
      )
      if (gen !== loadGenRef.current) {
        logger.info(`[${SHORTCUT_TRACE_CHAIN}] MobileHook.load.stale`, {
          gen,
          current: loadGenRef.current
        })
        return
      }
      shortcutsRef.current = items
      setShortcuts(items)
    } catch (error) {
      if (gen !== loadGenRef.current) return
      console.warn('[useMobilePromptShortcuts] load failed', error)
      shortcutsRef.current = []
      setShortcuts([])
    }
  }, [dbReady, services])

  useEffect(() => {
    if (!showSheet) return
    void loadShortcuts()
  }, [showSheet, loadShortcuts])

  const persistShortcuts = useCallback(
    async (updater: (prev: PromptShortcut[]) => PromptShortcut[]) => {
      if (!dbReady || !services) {
        await traceCall(SHORTCUT_TRACE_CHAIN, 'MobileHook.persist.skip', async () => {
          throw new Error(`dbReady=${dbReady}, services=${Boolean(services)}`)
        })
        toast.showError(t('common.errors.save_failed', '保存失败'))
        throw new Error('Database not ready')
      }

      const prev = shortcutsRef.current
      const next = updater(prev)

      // 作废进行中的 load，避免迟到的 load 用旧数据覆盖刚保存的列表
      loadGenRef.current += 1

      await traceCall(
        SHORTCUT_TRACE_CHAIN,
        'MobileHook.persist.optimistic',
        async () => {
          shortcutsRef.current = next
          setShortcuts(next)
          return next
        },
        { beforeCount: prev.length, afterCount: next.length, payload: next }
      )

      try {
        await traceCall(
          SHORTCUT_TRACE_CHAIN,
          'MobileHook.persist.write',
          async () => {
            await services.settingsManager.set(PROMPT_SHORTCUTS_KEY, next)
            const saved =
              (await services.settingsManager.get<PromptShortcut[]>(PROMPT_SHORTCUTS_KEY)) ?? []
            if (!Array.isArray(saved)) {
              throw new Error('Invalid shortcuts payload after save')
            }
            if (saved.length !== next.length) {
              throw new Error(
                `Shortcuts save verification failed: expected ${next.length}, got ${saved.length}`
              )
            }
            return saved
          },
          { key: PROMPT_SHORTCUTS_KEY, payload: next }
        )
      } catch (error) {
        await traceCall(
          SHORTCUT_TRACE_CHAIN,
          'MobileHook.persist.rollback',
          async () => {
            shortcutsRef.current = prev
            setShortcuts(prev)
          },
          { rollbackCount: prev.length }
        )
        toast.showError(t('common.errors.save_failed', '保存失败'))
        throw error
      }
    },
    [dbReady, services, t, toast]
  )

  const addShortcut = useCallback(
    async (shortcut: PromptShortcut) => {
      await traceCall(
        SHORTCUT_TRACE_CHAIN,
        'MobileHook.add',
        () => persistShortcuts((prev) => [...prev, shortcut]),
        { payload: shortcut }
      )
    },
    [persistShortcuts]
  )

  const updateShortcut = useCallback(
    async (shortcut: PromptShortcut) => {
      await traceCall(
        SHORTCUT_TRACE_CHAIN,
        'MobileHook.update',
        () =>
          persistShortcuts((prev) =>
            prev.map((item) => (item.id === shortcut.id ? shortcut : item))
          ),
        { payload: shortcut }
      )
    },
    [persistShortcuts]
  )

  const deleteShortcut = useCallback(
    async (id: string) => {
      await traceCall(
        SHORTCUT_TRACE_CHAIN,
        'MobileHook.delete',
        () => persistShortcuts((prev) => prev.filter((item) => item.id !== id)),
        { id }
      )
    },
    [persistShortcuts]
  )

  const reorderShortcuts = useCallback(
    async (next: PromptShortcut[]) => {
      await traceCall(
        SHORTCUT_TRACE_CHAIN,
        'MobileHook.reorder',
        () => persistShortcuts(() => next),
        { payload: next }
      )
    },
    [persistShortcuts]
  )

  return {
    shortcuts,
    addShortcut,
    updateShortcut,
    deleteShortcut,
    reorderShortcuts
  }
}
