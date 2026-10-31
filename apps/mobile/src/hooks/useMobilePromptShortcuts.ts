import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import type { PromptShortcut } from '@baishou/shared'
import {
  logger,
  SHORTCUT_TRACE_CHAIN,
  traceCall,
  dedupePromptShortcuts,
  findShortcutCommandConflict,
  promptShortcutToSkillInput
} from '@baishou/shared'
import {
  invalidateMobileSkillsCache,
  mobileListSkillShortcuts
} from '../services/mobile-agent-skills.service'
import {
  subscribeMobileSkillsChanged,
  notifyMobileSkillsChanged
} from '../services/mobile-skills-events'
import { writeMobileUserSkill, deleteMobileUserSkill } from '../services/mobile-skills-writer.util'
import { useTranslation } from 'react-i18next'
import { useNativeToast } from '@baishou/ui/native'
import { useBaishou } from '../providers/BaishouProvider'
import { applyShortcutDisplayOrder } from './prompt-shortcut-order.util'

const PROMPT_SHORTCUTS_KEY = 'prompt_shortcuts_v2'
const PROMPT_SHORTCUT_ORDER_KEY = 'prompt_shortcut_order_v1'

function isSkillShortcut(shortcut: PromptShortcut): boolean {
  return shortcut.source === 'software' || shortcut.source === 'workspace'
}

function normalizeShortcutKey(shortcut: Pick<PromptShortcut, 'id' | 'command' | 'name'>): string {
  return (shortcut.command || shortcut.name || shortcut.id || '')
    .trim()
    .replace(/^\/+/, '')
    .toLowerCase()
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
  const orderIdsRef = useRef<string[] | null>(null)
  const loadGenRef = useRef(0)
  shortcutsRef.current = shortcuts

  const publish = (skills: PromptShortcut[], user: PromptShortcut[]) => {
    skillShortcutsRef.current = skills
    userShortcutsRef.current = user
    const next = applyShortcutDisplayOrder(mergeShortcutLists(skills, user), orderIdsRef.current)
    orderIdsRef.current = next.map((item) => item.id)
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
          invalidateMobileSkillsCache()
          const skills = await mobileListSkillShortcuts().catch(() => [])
          const savedOrder =
            (await services.settingsManager.get<string[]>(PROMPT_SHORTCUT_ORDER_KEY)) ?? null
          return {
            skills,
            user: loaded.filter((item) => !isSkillShortcut(item)),
            orderIds: Array.isArray(savedOrder)
              ? savedOrder.filter((id) => typeof id === 'string')
              : null
          }
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
      orderIdsRef.current = items.orderIds
      publish(items.skills, items.user)
    } catch (error) {
      if (gen !== loadGenRef.current) return
      console.warn('[useMobilePromptShortcuts] load failed', error)
      orderIdsRef.current = null
      publish([], [])
    }
  }, [dbReady, services])

  useEffect(() => {
    void loadShortcuts()
  }, [loadShortcuts])

  useEffect(
    () =>
      subscribeMobileSkillsChanged(() => {
        void loadShortcuts()
      }),
    [loadShortcuts]
  )

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void loadShortcuts()
      }
    })
    return () => {
      subscription.remove()
    }
  }, [loadShortcuts])

  const persistShortcuts = useCallback(
    async (updater: (prev: PromptShortcut[]) => PromptShortcut[], nextOrderIds?: string[]) => {
      if (!dbReady || !services) {
        await traceCall(SHORTCUT_TRACE_CHAIN, 'MobileHook.persist.skip', async () => {
          throw new Error(`dbReady=${dbReady}, services=${Boolean(services)}`)
        })
        toast.showError(t('common.errors.save_failed', '保存失败'))
        throw new Error('Database not ready')
      }

      const prevUser = userShortcutsRef.current
      const prevAll = shortcutsRef.current
      const prevOrder = orderIdsRef.current
      const nextUser = dedupePromptShortcuts(
        updater(prevUser).filter((item) => !isSkillShortcut(item))
      )

      if (nextOrderIds) {
        orderIdsRef.current = nextOrderIds
      }

      loadGenRef.current += 1
      const published = publish(skillShortcutsRef.current, nextUser)

      try {
        await traceCall(
          SHORTCUT_TRACE_CHAIN,
          'MobileHook.persist.write',
          async () => {
            await services.settingsManager.set(PROMPT_SHORTCUTS_KEY, nextUser)
            await services.settingsManager.set(
              PROMPT_SHORTCUT_ORDER_KEY,
              published.map((item) => item.id)
            )
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
        orderIdsRef.current = prevOrder
        publish(skillShortcutsRef.current, prevUser)
        shortcutsRef.current = prevAll
        toast.showError(t('common.errors.save_failed', '保存失败'))
        throw error
      }
    },
    [dbReady, services, t, toast]
  )

  const syncSkillToDisk = useCallback(
    async (shortcut: PromptShortcut, previousName?: string) => {
      try {
        if (!services) return
        // 用户技能统一放存储根 .agents/skills，跨端同步与 skill_read 共用同一目录
        const root = await services.pathService.getRootDirectory()
        if (!root) return
        const input = promptShortcutToSkillInput(shortcut)
        try {
          await writeMobileUserSkill(
            root,
            previousName ? { ...input, previousName } : input,
            services.fileSystem
          )
        } catch (error) {
          if (
            previousName &&
            error instanceof Error &&
            error.message.startsWith('Skill not found:')
          ) {
            await writeMobileUserSkill(root, input, services.fileSystem)
          } else {
            throw error
          }
        }
        notifyMobileSkillsChanged()
      } catch (err) {
        logger.warn('[MobilePromptShortcuts] sync skill to disk failed:', err as Error)
      }
    },
    [services]
  )

  const deleteSkillFromDisk = useCallback(
    async (shortcutNameOrId: string) => {
      try {
        if (!services) return
        // 与写盘保持一致：用户技能在存储根 .agents/skills
        const root = await services.pathService.getRootDirectory()
        if (!root) return
        await deleteMobileUserSkill(root, shortcutNameOrId, services.fileSystem)
        notifyMobileSkillsChanged()
      } catch (err) {
        logger.warn('[MobilePromptShortcuts] delete skill from disk failed:', err as Error)
      }
    },
    [services]
  )

  const addShortcut = useCallback(
    async (shortcut: PromptShortcut) => {
      if (findShortcutCommandConflict(shortcutsRef.current, shortcut)) {
        toast.showError(t('shortcut.duplicate_command', '已存在相同快捷短语的指令，请换一个短语'))
        throw new Error('DUPLICATE_SHORTCUT_COMMAND')
      }
      const normalizedId = promptShortcutToSkillInput(shortcut).name
      const nextShortcut =
        shortcut.id.startsWith('custom-') && normalizedId
          ? { ...shortcut, id: normalizedId }
          : shortcut
      await persistShortcuts((prev) => [...prev, nextShortcut])
      await syncSkillToDisk(nextShortcut)
      await loadShortcuts()
    },
    [loadShortcuts, persistShortcuts, syncSkillToDisk, t, toast]
  )

  const updateShortcut = useCallback(
    async (shortcut: PromptShortcut) => {
      if (findShortcutCommandConflict(shortcutsRef.current, shortcut, shortcut.id)) {
        toast.showError(t('shortcut.duplicate_command', '已存在相同快捷短语的指令，请换一个短语'))
        throw new Error('DUPLICATE_SHORTCUT_COMMAND')
      }
      const previousTarget = shortcutsRef.current.find((item) => item.id === shortcut.id)
      const previousKey = normalizeShortcutKey(previousTarget ?? shortcut)
      const previousName = previousTarget?.command || previousTarget?.name || shortcut.id
      const prevSkills = skillShortcutsRef.current
      skillShortcutsRef.current = prevSkills.map((item) =>
        item.id === shortcut.id || (previousKey && normalizeShortcutKey(item) === previousKey)
          ? { ...item, ...shortcut }
          : item
      )
      try {
        await persistShortcuts((prev) =>
          prev.map((item) =>
            item.id === shortcut.id || (previousKey && normalizeShortcutKey(item) === previousKey)
              ? { ...item, ...shortcut, id: item.id }
              : item
          )
        )
      } catch (error) {
        skillShortcutsRef.current = prevSkills
        throw error
      }
      await syncSkillToDisk(shortcut, previousName)
      await loadShortcuts()
    },
    [loadShortcuts, persistShortcuts, syncSkillToDisk, t, toast]
  )

  const deleteShortcut = useCallback(
    async (id: string) => {
      const target = shortcutsRef.current.find((item) => item.id === id)
      const targetKey = target ? normalizeShortcutKey(target) : ''
      const prevSkills = skillShortcutsRef.current
      skillShortcutsRef.current = prevSkills.filter(
        (item) => item.id !== id && (!targetKey || normalizeShortcutKey(item) !== targetKey)
      )
      try {
        await persistShortcuts((prev) =>
          prev.filter(
            (item) => item.id !== id && (!targetKey || normalizeShortcutKey(item) !== targetKey)
          )
        )
      } catch (error) {
        skillShortcutsRef.current = prevSkills
        throw error
      }
      if (target) {
        await deleteSkillFromDisk(target.command || target.name || target.id)
      }
      await loadShortcuts()
    },
    [deleteSkillFromDisk, loadShortcuts, persistShortcuts]
  )

  const reorderShortcuts = useCallback(
    async (next: PromptShortcut[]) => {
      const orderIds = next.map((item) => item.id)
      await persistShortcuts(
        (prev) =>
          applyShortcutDisplayOrder(
            dedupePromptShortcuts([...prev, ...next.filter((item) => !isSkillShortcut(item))]),
            orderIds
          ),
        orderIds
      )
    },
    [persistShortcuts]
  )

  return {
    shortcuts,
    addShortcut,
    updateShortcut,
    deleteShortcut,
    reorderShortcuts,
    reloadShortcuts: loadShortcuts
  }
}
