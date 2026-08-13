import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { AssistantManagementPage, AssistantEditPage, useToast } from '@baishou/ui'
import { useAssistantStore } from '@baishou/store'
import { isSystemLatteAssistantId, SYSTEM_LATTE_ASSISTANT_CANNOT_DELETE } from '@baishou/shared'
import { motion, AnimatePresence } from 'framer-motion'

const pageTransition = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.15, ease: 'easeOut' as any }
}

/** 管理页本地列表 + 聊天侧伙伴 store 一并刷新，避免选择器仍显示旧提示词 */
async function refreshAssistantsAfterMutation(loadAssistants: () => Promise<void>): Promise<void> {
  await loadAssistants()
  await useAssistantStore.getState().fetchAssistants()
}

type DeleteAssistantResult =
  | { success: true }
  | { success: false; errorCode?: string }
  | undefined

export const AssistantManagementScreen: React.FC = () => {
  const { t } = useTranslation()
  const toast = useToast()
  const [assistants, setAssistants] = useState<any[]>([])
  const [editingAssistantId, setEditingAssistantId] = useState<string | null>(null)
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const loadAssistants = useCallback(async () => {
    if (typeof window !== 'undefined' && window.electron) {
      const data = await window.electron.ipcRenderer.invoke('agent:get-assistants')
      setAssistants(data || [])
    }
  }, [])

  const notifyDeleteFailure = useCallback(
    (result?: DeleteAssistantResult) => {
      if (result?.success === false && result.errorCode === SYSTEM_LATTE_ASSISTANT_CANNOT_DELETE) {
        toast.showError(
          t('agent.assistant.system_latte_cannot_delete', '官方 Latte 为系统伙伴，无法删除')
        )
        return
      }
      toast.showError(t('common.errors.delete_failed', '删除失败'))
    },
    [t, toast]
  )

  const deleteAssistant = useCallback(
    async (id: string): Promise<boolean> => {
      if (isSystemLatteAssistantId(id)) {
        toast.showError(
          t('agent.assistant.system_latte_cannot_delete', '官方 Latte 为系统伙伴，无法删除')
        )
        return false
      }
      if (typeof window === 'undefined' || !window.electron) return false
      const result = (await window.electron.ipcRenderer.invoke(
        'agent:delete-assistant',
        id
      )) as DeleteAssistantResult
      if (result && result.success === false) {
        notifyDeleteFailure(result)
        return false
      }
      await refreshAssistantsAfterMutation(loadAssistants)
      return true
    },
    [loadAssistants, notifyDeleteFailure, t, toast]
  )

  useEffect(() => {
    void loadAssistants()
  }, [loadAssistants])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.electron) return undefined

    const onVaultResyncComplete = (event: { type?: string }) => {
      if (event?.type !== 'vault-resync-complete') return
      void refreshAssistantsAfterMutation(loadAssistants)
    }

    const removeListener = window.electron.ipcRenderer.on('diary:sync-event', onVaultResyncComplete)

    return () => {
      removeListener()
    }
  }, [loadAssistants])

  return (
    <div style={{ flex: 1, height: '100%', position: 'relative', overflow: 'hidden' }}>
      <AnimatePresence mode="wait">
        {isCreatingNew ? (
          <motion.div key="create" style={{ height: '100%' }} {...pageTransition}>
            <AssistantEditPage
              assistant={null}
              onSave={async (data) => {
                if (typeof window !== 'undefined' && window.electron) {
                  const newId = `ast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
                  await window.electron.ipcRenderer.invoke('agent:create-assistant', {
                    ...data,
                    id: newId
                  })
                  await refreshAssistantsAfterMutation(loadAssistants)
                }
                setIsCreatingNew(false)
              }}
              onBack={() => setIsCreatingNew(false)}
            />
          </motion.div>
        ) : editingAssistantId ? (
          <motion.div
            key={`edit-${editingAssistantId}`}
            style={{ height: '100%' }}
            {...pageTransition}
          >
            {(() => {
              const target = assistants.find((a) => a.id === editingAssistantId)
              if (target) {
                return (
                  <AssistantEditPage
                    assistant={target}
                    onPatchSave={async (assistantId, patch) => {
                      if (typeof window !== 'undefined' && window.electron) {
                        await window.electron.ipcRenderer.invoke(
                          'agent:update-assistant',
                          assistantId,
                          patch
                        )
                        // 只合并 patch，避免整表重载把未保存的系统提示词打回旧值
                        setAssistants((prev) =>
                          prev.map((a) => (a.id === assistantId ? { ...a, ...patch } : a))
                        )
                        await useAssistantStore.getState().fetchAssistants()
                      }
                    }}
                    onSave={async (data) => {
                      if (typeof window !== 'undefined' && window.electron) {
                        await window.electron.ipcRenderer.invoke(
                          'agent:update-assistant',
                          target.id,
                          data
                        )
                        await refreshAssistantsAfterMutation(loadAssistants)
                      }
                      setEditingAssistantId(null)
                    }}
                    onBack={() => setEditingAssistantId(null)}
                    onDelete={
                      isSystemLatteAssistantId(target.id)
                        ? undefined
                        : async () => {
                            const ok = await deleteAssistant(target.id)
                            if (ok) setEditingAssistantId(null)
                          }
                    }
                  />
                )
              }
              return null
            })()}
          </motion.div>
        ) : (
          <motion.div key="list" style={{ height: '100%' }} {...pageTransition}>
            <AssistantManagementPage
              assistants={assistants}
              onCreate={() => setIsCreatingNew(true)}
              onEdit={(assistant) => setEditingAssistantId(assistant.id)}
              onDelete={async (id) => {
                await deleteAssistant(id)
              }}
              pinnedIds={new Set()}
              onTogglePin={async (id) => {
                if (typeof window !== 'undefined' && window.electron) {
                  await window.electron.ipcRenderer.invoke('agent:pin-assistant', id, true)
                  await refreshAssistantsAfterMutation(loadAssistants)
                }
              }}
              onReorder={async (orderedIds) => {
                if (typeof window !== 'undefined' && window.electron) {
                  await window.electron.ipcRenderer.invoke('agent:reorder-assistants', orderedIds)
                  await refreshAssistantsAfterMutation(loadAssistants)
                }
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
