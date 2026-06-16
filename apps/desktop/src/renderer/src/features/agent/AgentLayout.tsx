import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AgentSidebar } from './components/AgentSidebar'
import type { AgentAssistant } from './components/AgentSidebar'
import { useAssistantStore, useSettingsStore, useUserProfileStore } from '@baishou/store'
import { useToast, AssistantPickerSheet, Modal, AssistantEditPage, useDialog } from '@baishou/ui'
import styles from './AgentLayout.module.css'
import { LATTE_ASSISTANT_DESCRIPTION, LATTE_ASSISTANT_NAME } from '@baishou/shared'
import { useAgentSessions } from './hooks/useAgentSessions'
import i18n from 'i18next'

export const AgentLayout: React.FC = () => {
  const navigate = useNavigate()
  const { sessionId } = useParams()
  const [searchParams] = useSearchParams()

  const { assistants, fetchAssistants, isLoading: isAssistantsLoading } = useAssistantStore()
  const { agentBehavior, loadConfig } = useSettingsStore()
  const { loadProfile } = useUserProfileStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [isCreateAssistantOpen, setIsCreateAssistantOpen] = useState(false)
  const [standaloneSessionDoc, setStandaloneSessionDoc] = useState<any>(null)
  const resolvedAssistantIdRef = useRef<string | undefined>(undefined)

  const sanitizeAssistantId = (raw: unknown): string | undefined => {
    if (typeof raw === 'string' && raw.length > 0) return raw
    if (typeof raw === 'number') return String(raw)
    return undefined
  }

  const urlAssistantId = sanitizeAssistantId(searchParams.get('assistantId'))
  const defaultAssistantId = assistants.find((a) => a.isDefault)?.id ?? assistants[0]?.id
  const resolvedAssistantId =
    urlAssistantId ||
    (sessionId && standaloneSessionDoc?.id === sessionId
      ? sanitizeAssistantId(standaloneSessionDoc.assistantId)
      : undefined) ||
    resolvedAssistantIdRef.current ||
    (defaultAssistantId != null ? String(defaultAssistantId) : undefined)

  const toast = useToast()
  const dialog = useDialog()
  const { t } = useTranslation()

  const {
    sessions,
    hasMoreSessions,
    isLoadingMoreSessions,
    sidebarScrollKey,
    loadSessions,
    renameTarget,
    renameInputRef,
    setRenameTarget,
    handleRenameSession,
    commitRename
  } = useAgentSessions(resolvedAssistantId, searchQuery)

  // 加载独立会话文档（通过 URL 直接访问时使用）
  useEffect(() => {
    if (sessionId) {
      if (typeof window !== 'undefined' && window.electron) {
        window.electron.ipcRenderer.invoke('agent:get-session', sessionId).then((doc) => {
          if (doc) setStandaloneSessionDoc(doc)
        })
      }
    } else {
      setStandaloneSessionDoc(null)
    }
  }, [sessionId])

  // 初始化：加载助手列表，由 bootstrap 确保 Latte 存在
  useEffect(() => {
    void fetchAssistants().then(async () => {
      const store = useAssistantStore.getState()
      if (store.assistants.length === 0 && typeof window !== 'undefined' && window.api) {
        try {
          await window.api.ensureDefaultLatteAssistant(i18n.language)
          await fetchAssistants()
        } catch (error) {
          console.error('Failed to ensure default Latte assistant', error)
        }
      }
      const refreshed = useAssistantStore.getState()
      const ast = refreshed.assistants.find((a: any) => a.isDefault) || refreshed.assistants[0]
      if (ast) {
        resolvedAssistantIdRef.current = String(ast.id)
      }
    })
    loadConfig()
    loadProfile()
  }, [fetchAssistants, loadConfig, loadProfile])

  // Vault 切换后的后台 resync 完成时，刷新当前工作区的伙伴与会话列表
  useEffect(() => {
    if (typeof window === 'undefined' || !window.electron) return undefined

    const onVaultResyncComplete = (event: { type?: string }) => {
      if (event?.type !== 'vault-resync-complete') return
      resolvedAssistantIdRef.current = undefined
      void fetchAssistants().then(() => {
        const store = useAssistantStore.getState()
        const ast = store.assistants.find((a: any) => a.isDefault) || store.assistants[0]
        const astId = ast?.id != null ? String(ast.id) : undefined
        if (astId) {
          resolvedAssistantIdRef.current = astId
          void loadSessions(true, astId)
        } else {
          void loadSessions(true)
        }
      })
    }

    const removeDiaryListener = window.electron.ipcRenderer.on(
      'diary:sync-event',
      onVaultResyncComplete
    )

    return () => {
      removeDiaryListener()
    }
  }, [fetchAssistants, loadSessions])

  const currentAssistant = resolvedAssistantId
    ? assistants.find((a) => String(a.id) === String(resolvedAssistantId)) ||
      assistants.find((a) => a.isDefault)
    : assistants.find((a) => a.isDefault) || (assistants.length > 0 ? assistants[0] : undefined)

  const mappedAssistant = currentAssistant
    ? {
        id: String(currentAssistant.id),
        name: currentAssistant.name,
        description: currentAssistant.description || LATTE_ASSISTANT_DESCRIPTION,
        emoji: currentAssistant.emoji,
        avatarPath: (currentAssistant as any).avatarPath,
        assistantKind: (currentAssistant as any).assistantKind
      }
    : !isAssistantsLoading
      ? {
          id: 'default',
          name: LATTE_ASSISTANT_NAME,
          description: LATTE_ASSISTANT_DESCRIPTION,
          emoji: undefined
        }
      : undefined

  useEffect(() => {
    if (mappedAssistant?.id) {
      resolvedAssistantIdRef.current = mappedAssistant.id
    }
  }, [mappedAssistant?.id])

  const pinnedIds = assistants.filter((a: any) => a.isPinned).map((a) => String(a.id))
  const pinnedAssistants: AgentAssistant[] = pinnedIds
    .map((id) => assistants.find((a) => String(a.id) === id))
    .filter(Boolean)
    .map((a) => ({
      id: String(a!.id),
      name: a!.name,
      emoji: a!.emoji,
      avatarPath: (a as any).avatarPath,
      assistantKind: (a as any).assistantKind
    }))

  const handleNewChat = async (targetAssistantId?: string) => {
    const urlAstId = sanitizeAssistantId(searchParams.get('assistantId'))
    let astId = targetAssistantId || urlAstId || currentAssistant?.id
    if (!astId) {
      const store = useAssistantStore.getState()
      const defaultAst = store.assistants.find((a) => a.isDefault) || store.assistants[0]
      astId = defaultAst?.id || 'default'
    }
    navigate(`/chat?assistantId=${astId}`)
  }

  const handleAssistantSwitched = async (assistant: AgentAssistant) => {
    const astId = String(assistant.id)
    resolvedAssistantIdRef.current = astId
    void loadSessions(true, astId)

    if (typeof window !== 'undefined' && window.electron) {
      try {
        const sessionsList = await window.electron.ipcRenderer.invoke(
          'agent:list-sessions-by-assistant',
          assistant.id
        )
        if (sessionsList && sessionsList.length > 0) {
          const sorted = sessionsList.sort(
            (a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          )
          navigate(`/chat/${sorted[0].id}?assistantId=${assistant.id}`)
          return
        }
      } catch (e) {
        console.error('[AgentLayout] Failed to switch to existing session', e)
      }
    }
    handleNewChat(assistant.id)
  }

  const handleDelete = async (id: string) => {
    const ok = await dialog.confirm(
      t('agent.delete_session_confirm', '您确定要永久删除这篇对话吗？此操作不可逆转。'),
      t('common.confirm_delete', '确认删除')
    )
    if (!ok) return
    if (typeof window !== 'undefined' && window.electron) {
      await window.electron.ipcRenderer.invoke('agent:delete-sessions', [id])
      loadSessions(true)
      if (sessionId === id)
        navigate(currentAssistant?.id ? `/chat?assistantId=${currentAssistant.id}` : '/chat')
    }
  }

  const handleBatchDelete = async (ids: string[]) => {
    const ok = await dialog.confirm(
      t('agent.batch_delete_confirm', '您确定要删除选中的 {{count}} 篇对话吗？此操作不可逆转。', {
        count: ids.length
      }),
      t('common.confirm_delete', '确认删除')
    )
    if (!ok) return
    if (typeof window !== 'undefined' && window.electron) {
      await window.electron.ipcRenderer.invoke('agent:delete-sessions', ids)
      loadSessions(true)
      if (sessionId && ids.includes(sessionId))
        navigate(currentAssistant?.id ? `/chat?assistantId=${currentAssistant.id}` : '/chat')
    }
  }

  return (
    <div className={styles.layoutContainer}>
      <AgentSidebar
        currentAssistant={mappedAssistant}
        sessions={sessions}
        hasMore={hasMoreSessions}
        isLoadingMore={isLoadingMoreSessions}
        scrollKey={sidebarScrollKey}
        onLoadMore={() => void loadSessions(false)}
        selectedSessionId={sessionId}
        searchQuery={searchQuery}
        pinnedAssistants={pinnedAssistants}
        onSearchQueryChanged={setSearchQuery}
        onSessionSelected={(id) =>
          navigate(
            currentAssistant?.id ? `/chat/${id}?assistantId=${currentAssistant.id}` : `/chat/${id}`
          )
        }
        onNewSession={handleNewChat}
        onAssistantSwitched={handleAssistantSwitched}
        onPinSession={async (id) => {
          const s = sessions.find((s) => s.id === id)
          if (s && window.electron) {
            await window.electron.ipcRenderer.invoke('agent:pin-session', id, !s.isPinned)
            loadSessions(true)
          }
        }}
        onDeleteSession={handleDelete}
        onRenameSession={(id) => handleRenameSession(id, sessions)}
        onBatchDelete={handleBatchDelete}
        isCollapsed={isSidebarCollapsed}
        onCollapse={() => setIsSidebarCollapsed(true)}
        onExpand={() => setIsSidebarCollapsed(false)}
        onShowPicker={() => setIsPickerOpen(true)}
      />

      <div className={styles.chatArea}>
        <Outlet
          context={{ sessions, loadSessions, onAssistantSwitched: handleAssistantSwitched }}
        />
      </div>

      {/* ─── 内联重命名 Modal ─── */}
      {renameTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.3)'
          }}
          onClick={() => setRenameTarget(null)}
        >
          <div
            style={{
              background: 'var(--bg-surface, #fff)',
              borderRadius: 16,
              padding: '24px 24px 16px',
              width: 320,
              boxShadow: '0 12px 40px rgba(0,0,0,0.15)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: 15,
                marginBottom: 12,
                color: 'var(--text-primary, #1e293b)'
              }}
            >
              {t('agent.rename_session', '重命名对话')}
            </div>
            <input
              ref={renameInputRef}
              autoFocus
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid rgba(148,163,184,0.4)',
                fontSize: 14,
                outline: 'none',
                background: 'var(--bg-surface-highlight, #f8fafc)',
                color: 'var(--text-primary, #1e293b)',
                boxSizing: 'border-box'
              }}
              value={renameTarget.title}
              onChange={(e) => setRenameTarget({ ...renameTarget, title: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter')
                  commitRename((title) =>
                    toast.showSuccess(
                      t('agent.renamed_toast', '已重命名为「{{title}}」', { title })
                    )
                  )
                if (e.key === 'Escape') setRenameTarget(null)
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: 14,
                  color: 'var(--text-secondary)'
                }}
                onClick={() => setRenameTarget(null)}
              >
                {t('common.cancel', '取消')}
              </button>
              <button
                style={{
                  padding: '8px 20px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--color-primary, #5BA8F5)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600
                }}
                onClick={() =>
                  commitRename((title) =>
                    toast.showSuccess(
                      t('agent.renamed_toast', '已重命名为「{{title}}」', { title })
                    )
                  )
                }
              >
                {t('common.confirm', '确定')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Assistant Picker Sheet ─── */}
      <AssistantPickerSheet
        isOpen={isPickerOpen}
        assistants={
          assistants.map((a) => ({
            ...a,
            id: String(a.id),
            compressSystemPrompt: a.compressSystemPrompt ?? null
          })) as any
        }
        currentAssistantId={mappedAssistant?.id}
        onSelect={(ast) => {
          setIsPickerOpen(false)
          handleAssistantSwitched(ast as any)
        }}
        onClose={() => setIsPickerOpen(false)}
        onRefreshAssistants={() => fetchAssistants()}
        pinnedIds={new Set(pinnedIds)}
        onTogglePin={async (id, isPinned) => {
          if (window.electron) {
            await window.electron.ipcRenderer.invoke('agent:pin-assistant', id, isPinned)
            await fetchAssistants()
          }
        }}
        onCreateNew={() => {
          setIsPickerOpen(false)
          setIsCreateAssistantOpen(true)
        }}
      />

      {/* ─── Assistant Create Modal ─── */}
      <Modal
        isOpen={isCreateAssistantOpen}
        onClose={() => {
          setIsCreateAssistantOpen(false)
          setIsPickerOpen(true)
        }}
        closeOnOverlayClick={false}
        style={{ padding: 0 }}
      >
        <div style={{ width: '80vw', maxWidth: '800px', height: '85vh', overflow: 'hidden' }}>
          <AssistantEditPage
            assistant={null}
            isLastAssistant={assistants.length <= 1}
            onSave={async (data) => {
              if (window.electron) {
                await window.electron.ipcRenderer.invoke('agent:create-assistant', data)
                await fetchAssistants()
                setIsCreateAssistantOpen(false)
              }
            }}
            onBack={() => {
              setIsCreateAssistantOpen(false)
              setIsPickerOpen(true)
            }}
          />
        </div>
      </Modal>
    </div>
  )
}
