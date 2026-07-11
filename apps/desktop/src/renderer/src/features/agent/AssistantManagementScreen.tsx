import React, { useState, useEffect, useCallback } from 'react'
import { AssistantManagementPage, AssistantEditPage } from '@baishou/ui'
import { useAssistantStore } from '@baishou/store'
import { motion, AnimatePresence } from 'framer-motion'

const pageTransition = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.15, ease: 'easeOut' as any }
}

/** 管理页本地列表 + 聊天侧伙伴 store 一并刷新，避免选择器仍显示旧提示词 */
async function refreshAssistantsAfterMutation(
  loadAssistants: () => Promise<void>
): Promise<void> {
  await loadAssistants()
  await useAssistantStore.getState().fetchAssistants()
}

export const AssistantManagementScreen: React.FC = () => {
  const [assistants, setAssistants] = useState<any[]>([])
  const [editingAssistantId, setEditingAssistantId] = useState<string | null>(null)
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const loadAssistants = useCallback(async () => {
    if (typeof window !== 'undefined' && window.electron) {
      const data = await window.electron.ipcRenderer.invoke('agent:get-assistants')
      setAssistants(data || [])
    }
  }, [])

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
                    onDelete={async () => {
                      if (typeof window !== 'undefined' && window.electron) {
                        await window.electron.ipcRenderer.invoke(
                          'agent:delete-assistant',
                          target.id
                        )
                        await refreshAssistantsAfterMutation(loadAssistants)
                      }
                      setEditingAssistantId(null)
                    }}
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
                if (typeof window !== 'undefined' && window.electron) {
                  await window.electron.ipcRenderer.invoke('agent:delete-assistant', id)
                  await refreshAssistantsAfterMutation(loadAssistants)
                }
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
