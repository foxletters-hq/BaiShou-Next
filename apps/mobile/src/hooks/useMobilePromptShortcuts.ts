import { useCallback, useEffect, useRef, useState } from 'react'
import type { PromptShortcut } from '@baishou/shared'
import {
  logger,
  SHORTCUT_TRACE_CHAIN,
  traceCall,
  dedupePromptShortcuts,
  findShortcutCommandConflict
} from '@baishou/shared'
import { mobileListSkillShortcuts } from '../services/mobile-agent-skills.service'
import { useTranslation } from 'react-i18next'
import { useNativeToast } from '@baishou/ui/native'
import { useBaishou } from '../providers/BaishouProvider'

const PROMPT_SHORTCUTS_KEY = 'prompt_shortcuts_v2'

function isSkillShortcut(shortcut: PromptShortcut): boolean {
  return shortcut.source === 'software' || shortcut.source === 'workspace'
}

function mergeShortcutLists(skills: PromptShortcut[], user: PromptShortcut[]): PromptShortcut[] {
  return dedupePromptShortcuts([...skills, ...user])
}

export function useMobilePromptShortcuts() {
  const { t } = useTranslation()
  const toast = useNativeToast()
  const { services, dbReady } = useBaishou()
  const [shortcuts, setShortcuts] = useState<PromptShortcut[]>([])
  const userShortcutsRef = useRef<PromptShortcut[]>([])
  const skillShortcutsRef = useRef<PromptShortcut[]>([])
  const shortcutsRef = useRef<PromptShortcut[]>([])
  const loadGenRef = useRef(0)
  shortcutsRef.current = shortcuts

  const publish = (skills: PromptShortcut[], user: PromptShortcut[]) => {
    skillShortcutsRef.current = skills
    userShortcutsRef.current = user
    const next = mergeShortcutLists(skills, user)
    shortcutsRef.current = next
    setShortcuts(next)
    return next
  }

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
          const skills = await mobileListSkillShortcuts().catch(() => [])
          return { skills, user: loaded.filter((item) => !isSkillShortcut(item)) }
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
      publish(items.skills, items.user)
    } catch (error) {
      if (gen !== loadGenRef.current) return
      console.warn('[useMobilePromptShortcuts] load failed', error)
      publish([], [])
    }
  }, [dbReady, services])

  useEffect(() => {
    void loadShortcuts()
  }, [loadShortcuts])

  const persistShortcuts = useCallback(
    async (updater: (prev: PromptShortcut[]) => PromptShortcut[]) => {
      if (!dbReady || !services) {
        await traceCall(SHORTCUT_TRACE_CHAIN, 'MobileHook.persist.skip', async () => {
          throw new Error(`dbReady=${dbReady}, services=${Boolean(services)}`)
        })
        toast.showError(t('common.errors.save_failed', '保存失败'))
        throw new Error('Database not ready')
      }

      const prevUser = userShortcutsRef.current
      const prevAll = shortcutsRef.current
      const nextUser = dedupePromptShortcuts(updater(prevUser).filter((item) => !isSkillShortcut(item)))

      loadGenRef.current += 1
      publish(skillShortcutsRef.current, nextUser)

      try {
        await traceCall(
          SHORTCUT_TRACE_CHAIN,
          'MobileHook.persist.write',
          async () => {
            await services.settingsManager.set(PROMPT_SHORTCUTS_KEY, nextUser)
            const saved =
              (await services.settingsManager.get<PromptShortcut[]>(PROMPT_SHORTCUTS_KEY)) ?? []
            if (!Array.isArray(saved)) {
              throw new Error('Invalid shortcuts payload after save')
            }
            if (saved.length !== nextUser.length) {
              throw new Error(
                `Shortcuts save verification failed: expected ${nextUser.length}, got ${saved.length}`
              )
            }
            return saved
          },
          { key: PROMPT_SHORTCUTS_KEY, payload: nextUser }
        )
      } catch (error) {
        publish(skillShortcutsRef.current, prevUser)
        shortcutsRef.current = prevAll
        toast.showError(t('common.errors.save_failed', '保存失败'))
        throw error
      }
    },
    [dbReady, services, t, toast]
  )

  const addShortcut = useCallback(
    async (shortcut: PromptShortcut) => {
      if (findShortcutCommandConflict(shortcutsRef.current, shortcut)) {
        toast.showError(t('shortcut.duplicate_command', '已存在相同快捷短语的指令，请换一个短语'))
        throw new Error('DUPLICATE_SHORTCUT_COMMAND')
      }
      await persistShortcuts((prev) => [...prev, shortcut])
    },
    [persistShortcuts, t, toast]
  )

  const updateShortcut = useCallback(
    async (shortcut: PromptShortcut) => {
      if (findShortcutCommandConflict(shortcutsRef.current, shortcut, shortcut.id)) {
        toast.showError(t('shortcut.duplicate_command', '已存在相同快捷短语的指令，请换一个短语'))
        throw new Error('DUPLICATE_SHORTCUT_COMMAND')
      }
      await persistShortcuts((prev) =>
        prev.map((item) => (item.id === shortcut.id ? shortcut : item))
      )
    },
    [persistShortcuts, t, toast]
  )

  const deleteShortcut = useCallback(
    async (id: string) => {
      await persistShortcuts((prev) => prev.filter((item) => item.id !== id))
    },
    [persistShortcuts]
  )

  const reorderShortcuts = useCallback(
    async (next: PromptShortcut[]) => {
      await persistShortcuts(() => next.filter((item) => !isSkillShortcut(item)))
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
