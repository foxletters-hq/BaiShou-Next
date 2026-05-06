import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { 
  ChatBubble, 
  StreamingBubble, 
  InputBar, 
  TokenBadge,
  ModelSwitcherPopup,
  ChatCostDialog,
  ContextChainDialog,
  AssistantPickerSheet,
  PromptShortcutSheet,
  ShortcutManagerDialog,
  RecallDialog,
  Modal,
  AgentToolsView,
  useDialog,
  toast
} from '@baishou/ui';
import type { InputBarRef } from '@baishou/ui';
import { useSettingsStore, useAssistantStore, usePromptShortcutStore, useUserProfileStore, useAgentStore } from '@baishou/store';
import styles from './AgentScreen.module.css';
import { useAgentStream } from './hooks/useAgentStream';
import { useChatMessages } from './hooks/useChatMessages';
import { useSessionManager } from './hooks/useSessionManager';
import { useModelSelection } from './hooks/useModelSelection';
import { useTokenUsage } from './hooks/useTokenUsage';
import { useChatScroll } from './hooks/useChatScroll';
import { useStreamError } from './hooks/useStreamError';
import { useRecallSearch } from './hooks/useRecallSearch';
import { useAssistantResolver } from './hooks/useAssistantResolver';
import { useTranslation } from 'react-i18next';

export const AgentScreen: React.FC = () => {
  const { t } = useTranslation();
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const dialog = useDialog();
  const { sessions, loadSessions } = useOutletContext<{ sessions: any[], loadSessions?: (reset: boolean) => void }>() || { sessions: [] };

  // ── 1. 流式通道 ──
  const stream = useAgentStream();

  // ── 2. 助手解析 ──
  const { currentAssistant } = useAssistantResolver({ sessionId, sessions });

  // ── 3. 会话管理 ──
  const { createAndNavigate } = useSessionManager({
    currentAssistantId: currentAssistant?.id,
    loadSessions,
  });

  // ── 4. 模型选择 ──
  const model = useModelSelection({ sessionId, currentAssistant });

  // ── 5. 消息管理（竞态修复在此 hook 内部）──
  const chat = useChatMessages({
    sessionId,
    isStreaming: stream.isStreaming,
    streamingText: stream.text,
    streamingReasoning: stream.reasoning,
  });

  // ── 6. Token 统计 ──
  const tokens = useTokenUsage(sessionId, stream.isStreaming);

  // ── 7. 滚动管理 ──
  const scroll = useChatScroll({
    messages: chat.messages,
    streamingText: stream.text,
    streamingReasoning: stream.reasoning,
    isStreaming: stream.isStreaming,
    activeTool: stream.activeTool,
  });

  // ── 8. 错误处理 ──
  useStreamError(stream.error, stream.isStreaming);

  // ── 9. 回忆搜索 ──
  const recall = useRecallSearch();

  // ── 10. Store 订阅 ──
  const settings = useSettingsStore();
  const toolConfig = settings.toolManagementConfig || { disabledToolIds: [], customConfigs: {} };
  const providers = settings?.providers || [];
  const { assistants, fetchAssistants } = useAssistantStore();
  const { shortcuts, loadShortcuts, addShortcut, updateShortcut, removeShortcut } = usePromptShortcutStore();
  const { profile: userProfile } = useUserProfileStore();
  const searchMode = useAgentStore(s => s.searchMode);
  const setSearchMode = useAgentStore(s => s.setSearchMode);
  const toggleSearchMode = useAgentStore(s => s.toggleSearchMode);

  // ── UI 状态 ──
  const [showModelSwitcher, setShowModelSwitcher] = useState(false);
  const [showCostDialog, setShowCostDialog] = useState(false);
  const [showAssistantPicker, setShowAssistantPicker] = useState(false);
  const [showShortcutSheet, setShowShortcutSheet] = useState(false);
  const [showRecallSheet, setShowRecallSheet] = useState(false);
  const [showShortcutManager, setShowShortcutManager] = useState(false);
  const [showToolManager, setShowToolManager] = useState(false);
  const [contextDialogState, setContextDialogState] = useState<{ isOpen: boolean, message?: any, contextMessages?: any[] }>({ isOpen: false });
  const [pricingLastUpdated, setPricingLastUpdated] = useState<Date | null>(null);
  const inputBarRef = useRef<InputBarRef>(null);

  // ── 获取价格表更新时间 ──
  const fetchPricingLastUpdated = useCallback(async () => {
    if (typeof window !== 'undefined' && window.electron) {
      try {
        const isoString = await window.electron.ipcRenderer.invoke('pricing:get-last-updated');
        if (isoString) {
          setPricingLastUpdated(new Date(isoString));
        }
      } catch (e) {
        console.error('Failed to get pricing last updated:', e);
      }
    }
  }, []);

  // ── 刷新价格表 ──
  const handleRefreshPricing = useCallback(async () => {
    if (typeof window !== 'undefined' && window.electron) {
      try {
        const result = await window.electron.ipcRenderer.invoke('pricing:refresh');
        if (result.success && result.lastUpdated) {
          setPricingLastUpdated(new Date(result.lastUpdated));
        }
      } catch (e) {
        console.error('Failed to refresh pricing:', e);
      }
    }
  }, []);

  // ── 初始化加载价格表时间 ──
  useEffect(() => {
    fetchPricingLastUpdated();
  }, [fetchPricingLastUpdated]);

  // ── 初始化加载 ──
  useEffect(() => {
    fetchAssistants();
    loadShortcuts();
  }, [fetchAssistants, loadShortcuts]);

  // ── 搜索模式持久化 ──
  const searchModeLoadedRef = useRef(false);
  useEffect(() => {
    const api = (window as any).api;
    if (api?.settings?.getSearchModeEnabled) {
      api.settings.getSearchModeEnabled().then((enabled: boolean) => {
        setSearchMode(!!enabled);
        searchModeLoadedRef.current = true;
      }).catch(() => {
        searchModeLoadedRef.current = true;
      });
    } else {
      searchModeLoadedRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!searchModeLoadedRef.current) return;
    const api = (window as any).api;
    if (api?.settings?.setSearchModeEnabled) {
      api.settings.setSearchModeEnabled(searchMode);
    }
  }, [searchMode]);

  // ── 流结束时刷新侧边栏 ──
  const prevIsStreamingRef = useRef(stream.isStreaming);
  useEffect(() => {
    if (prevIsStreamingRef.current === true && stream.isStreaming === false) {
      if (loadSessions) loadSessions(true);
    }
    prevIsStreamingRef.current = stream.isStreaming;
  }, [stream.isStreaming, sessionId, loadSessions]);

  // ── 发送消息 ──
  const handleSend = async (text: string, attachments?: any[], searchMode?: boolean) => {
    let targetSessionId = sessionId;
    setSearchMode(searchMode ?? false);

    if (!targetSessionId) {
      targetSessionId = await createAndNavigate(text);
      if (!targetSessionId) return;
      chat.markOptimisticSession(targetSessionId);
    }

    const optimisticId = chat.optimisticAdd(text, attachments);
    try {
      chat.setStreamSessionId(targetSessionId);
      await stream.startChat(targetSessionId, text, model.currentProviderId, model.currentModelId, attachments, searchMode);
    } catch (e: any) {
      console.error('[AgentScreen] startChat failed:', e);
      chat.optimisticRemove(optimisticId);
      toast.showError(t('agent.error.send_failed', '发送消息失败: {{msg}}', { msg: e?.message || '未知错误' }));
    }
  };

  // ── 停止生成 ──
  const handleStop = () => {
    if (typeof window !== 'undefined' && window.electron) {
      window.electron.ipcRenderer.invoke('agent:stop-stream').catch(console.error);
    }
  };

  return (
    <div className={styles.screen}>
      {/* 顶部控制区 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '16px 24px', gap: 12 }}>
        <div 
          style={{ padding: '4px 10px', fontSize: '12px', background: 'var(--bg-surface-highlight, rgba(148, 163, 184, 0.1))', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}
          onClick={() => setShowModelSwitcher(true)}
        >
          {model.currentModelId === 'unknown' ? t('agent.no_model_selected', '暂未选择模型') : model.currentModelId} <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.6 }}>▼</span>
        </div>
        <TokenBadge 
          inputTokens={tokens.totalInputTokens}
          outputTokens={tokens.totalOutputTokens}
          costMicros={tokens.estimatedCost * 1000000}
          onClick={() => setShowCostDialog(true)}
        />
      </div>

      {/* 对话框 */}
      <ChatCostDialog 
        isOpen={showCostDialog}
        onClose={() => setShowCostDialog(false)}
        details={{
          modelName: model.currentModelId === 'unknown' ? t('agent.no_model_selected', '暂未选择模型') : model.currentModelId,
          promptTokens: tokens.totalInputTokens,
          completionTokens: tokens.totalOutputTokens,
          totalTokens: tokens.totalInputTokens + tokens.totalOutputTokens,
          estimatedCost: `$${tokens.estimatedCost.toFixed(6)}`,
        }}
        pricingLastUpdated={pricingLastUpdated}
        onRefreshPricing={handleRefreshPricing}
      />

      <AssistantPickerSheet
        isOpen={showAssistantPicker}
        onClose={() => setShowAssistantPicker(false)}
        assistants={(assistants || []).map(a => ({ ...a, emoji: a.emoji || '✨', systemPrompt: a.systemPrompt || '' }))}
        pinnedIds={new Set(assistants.filter((a: any) => a.isPinned).map(a => String(a.id)))}
        onTogglePin={async (id, isPinned) => {
          if (typeof window !== 'undefined' && window.electron) {
            await window.electron.ipcRenderer.invoke('agent:pin-assistant', id, isPinned);
            await fetchAssistants();
          }
        }}
        onSelect={(ast) => {
          setShowAssistantPicker(false);
          if (typeof window !== 'undefined' && window.electron) {
            window.electron.ipcRenderer.invoke('agent:list-sessions-by-assistant', ast.id)
              .then((sessionsList: any[]) => {
                if (sessionsList && sessionsList.length > 0) {
                  const sorted = sessionsList.sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
                  navigate(`/chat/${sorted[0].id}`);
                } else {
                  navigate(`/chat?assistantId=${ast.id}`);
                }
              })
              .catch(console.error);
          }
        }}
      />

      <PromptShortcutSheet
        isOpen={showShortcutSheet}
        shortcuts={shortcuts as any}
        selectedIndex={0}
        onSelect={(shortcut) => {
          setShowShortcutSheet(false);
          inputBarRef.current?.insertText(shortcut.content);
        }}
      />
      
      <ShortcutManagerDialog 
        isOpen={showShortcutManager}
        onClose={() => setShowShortcutManager(false)}
        shortcuts={shortcuts as any}
        onAdd={addShortcut}
        onUpdate={updateShortcut}
        onDelete={removeShortcut}
        onSelect={(shortcut) => {
          setShowShortcutManager(false);
          inputBarRef.current?.insertText(shortcut.content);
        }}
      />
      
      <RecallDialog
        isOpen={showRecallSheet}
        onClose={() => setShowRecallSheet(false)}
        items={recall.recallItems}
        isSearching={recall.isSearchingRecall}
        onSearch={recall.handleRecallSearch}
        onInject={(items) => {
          setShowRecallSheet(false);
          if (items.length > 0) {
            const merged = items.map(i => `<memory date="${i.date}" source="${i.title}">\n${i.snippet}\n</memory>`).join('\n\n');
            inputBarRef.current?.insertText(merged);
          }
        }}
      />

      {showModelSwitcher && (
        <ModelSwitcherPopup 
          onClose={() => setShowModelSwitcher(false)}
          providers={providers.map(p => ({
            id: p.providerId,
            name: p.name || p.providerId,
            type: p.type || 'custom',
            models: p.models || [],
            enabledModels: p.enabledModels || [],
          }))}
          currentProviderId={model.currentProviderId}
          currentModelId={model.currentModelId}
          onSelect={(pid, mid) => {
            model.setCurrentProviderId(pid);
            model.setCurrentModelId(mid);
            model.userManuallySetModelRef.current = true;
            setShowModelSwitcher(false);
          }}
        />
      )}

      <Modal 
        isOpen={showToolManager} 
        onClose={() => setShowToolManager(false)}
        closeOnOverlayClick={true}
      >
        <AgentToolsView 
          config={toolConfig}
          onChange={(cfg) => {
            (window as any).api?.settings?.setToolManagementConfig(cfg);
          }}
        />
      </Modal>

      {/* 消息列表 */}
      <div className={styles.messageList} ref={scroll.scrollRef}>
        <div className={styles.messageContent}>
          {/* 分页加载 */}
          {chat.hasMore && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
              <button 
                onClick={chat.loadMore}
                style={{ 
                  background: 'transparent', border: 'none', 
                  color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, 
                  cursor: 'pointer', opacity: 0.8, textDecoration: 'underline' 
                }}
              >
                {t('common.load_more', '点击加载更多记录')}
              </button>
            </div>
          )}

          {/* 历史消息 */}
          {[...chat.messages].map((msg, index, arr) => {
            let decodedContext: any[] | undefined;
            if (msg.role === 'assistant' && index > 0) {
              const prevMsg = arr[index - 1];
              if (prevMsg.role === 'user' && prevMsg.parts) {
                const ctxPart = prevMsg.parts.find((p: any) => p.type === 'context_snapshot');
                if (ctxPart && ctxPart.data?.snapshots) {
                  decodedContext = ctxPart.data.snapshots.map((s: any) => ({
                    role: 'system',
                    content: `${s.title ? '[' + s.title + '] ' : ''}${s.content}`,
                    timestamp: msg.createdAt || new Date(),
                  }));
                }
              }
            }

            return (
              <ChatBubble 
                key={msg.id}
                message={{
                  id: msg.id,
                  sessionId: sessionId || 'default-session',
                  role: msg.role === 'user' ? 'user' : 'assistant',
                  content: msg.content,
                  reasoning: msg.reasoning,
                  timestamp: msg.createdAt || new Date(),
                  toolInvocations: msg.toolInvocations,
                  attachments: msg.attachments,
                  inputTokens: msg.inputTokens,
                  outputTokens: msg.outputTokens,
                  isReasoning: msg.isReasoning,
                  costMicros: msg.costMicros,
                  contextMessages: decodedContext,
                }}
                userProfile={{ nickname: userProfile?.nickname || 'User', avatarPath: userProfile?.avatarPath }}
                aiProfile={{ name: currentAssistant?.name || 'AI', avatarPath: currentAssistant?.avatarPath, emoji: currentAssistant?.emoji }}
                onShowContext={(m) => {
                  setContextDialogState({ isOpen: true, message: m, contextMessages: m.contextMessages || [] });
                }}
                onRegenerate={() => {
                  if (typeof window !== 'undefined' && window.electron) {
                    window.electron.ipcRenderer.invoke('agent:regenerate', sessionId, msg.id, searchMode).then(() => chat.refreshMessages());
                  }
                }}
                onEdit={() => {}}
                onSaveEdit={async (newContent: string) => {
                  if (!sessionId || !newContent.trim()) return;
                  if (typeof window !== 'undefined' && window.electron) {
                    await window.electron.ipcRenderer.invoke('agent:edit-message', sessionId, msg.id, newContent, model.currentProviderId, model.currentModelId, undefined, searchMode);
                    await chat.refreshMessages();
                  }
                }}
                onResendEdit={async (newContent: string) => {
                  if (!sessionId || !newContent.trim()) return;
                  const msgIndex = chat.messages.findIndex(m => m.id === msg.id);
                  if (msgIndex !== -1) {
                    chat.setMessages(prev => prev.slice(0, msgIndex + 1));
                  }
                  if (typeof window !== 'undefined' && window.electron) {
                    await window.electron.ipcRenderer.invoke('agent:edit-message', sessionId, msg.id, newContent, model.currentProviderId, model.currentModelId, undefined, searchMode);
                  }
                }}
                onResend={() => {
                  if (msg.role === 'user' && sessionId) {
                    const msgIndex = chat.messages.findIndex(m => m.id === msg.id);
                    if (msgIndex !== -1) {
                      chat.setMessages(prev => prev.slice(0, msgIndex + 1));
                    }
                    chat.setStreamSessionId(sessionId);
                    stream.resendChat(sessionId, msg.id, searchMode);
                  }
                }}
                onDelete={async () => {
                  const ok = await dialog.confirm(t('agent.chat.delete_msg_confirm', '您确定要删除这条消息历史吗？此操作不可逆。'), t('common.confirm_delete', '确认删除'));
                  if (!ok) return;
                  if (typeof window !== 'undefined' && window.electron) {
                    window.electron.ipcRenderer.invoke('agent:delete-message', sessionId, msg.id).then(() => chat.refreshMessages());
                  }
                }}
              />
            );
          })}

          {/* 流式气泡 */}
          {stream.isStreaming && (
            <StreamingBubble
              text={stream.text}
              reasoning={stream.reasoning}
              isReasoning={Boolean(stream.reasoning && !stream.text)}
              activeToolName={stream.activeTool?.name}
              completedTools={stream.completedTools}
              aiProfile={{ name: currentAssistant?.name || 'AI', avatarPath: currentAssistant?.avatarPath, emoji: currentAssistant?.emoji }}
            />
          )}

          {/* 流式结束过渡态 */}
          {chat.pendingAssistantMsg && (
            <ChatBubble
              key={chat.pendingAssistantMsg.id}
              message={{
                id: chat.pendingAssistantMsg.id,
                sessionId: sessionId || 'default-session',
                role: 'assistant',
                content: chat.pendingAssistantMsg.content,
                reasoning: chat.pendingAssistantMsg.reasoning,
                timestamp: new Date(),
                isReasoning: Boolean(chat.pendingAssistantMsg.reasoning && !chat.pendingAssistantMsg.content),
              }}
              aiProfile={{ name: currentAssistant?.name || 'AI', avatarPath: currentAssistant?.avatarPath, emoji: currentAssistant?.emoji }}
            />
          )}

          {/* 空状态 */}
          {chat.messages.length === 0 && !stream.isStreaming && (
            <div style={{ flex: 1, padding: '24px 32px' }}>
              {(() => {
                const title = sessions.find((s: any) => s.id === sessionId)?.title || '';
                if (!title || title === t('agent.sessions.newChat', '新对话') || title === t('agent.sessions.new_session', '新会话')) return null;
                return (
                  <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: 'var(--text-primary)', opacity: 0.9 }}>
                    {title}
                  </h2>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* 回到底部按钮 */}
      {scroll.showScrollButton && (
        <div 
          onClick={() => scroll.scrollToBottom(true)}
          style={{
            position: 'absolute',
            bottom: '100px',
            right: '32px',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: 'var(--bg-surface, #FFFFFF)',
            border: '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 100,
            color: 'var(--text-secondary, #64748b)',
            transition: 'all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
          }}
          title={t('agent.chat.scroll_to_bottom', '回到最新消息')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <polyline points="19 12 12 19 5 12"></polyline>
          </svg>
        </div>
      )}

      {contextDialogState.message && (
        <ContextChainDialog 
          isOpen={contextDialogState.isOpen}
          onClose={() => setContextDialogState(prev => ({ ...prev, isOpen: false }))}
          message={contextDialogState.message}
          contextMessages={contextDialogState.contextMessages || []}
        />
      )}

      {/* 输入框 */}
      <div className={styles.inputContainer}>
        <InputBar 
          ref={inputBarRef}
          isLoading={stream.isStreaming}
          onSend={handleSend}
          onStop={handleStop}
          assistantName={currentAssistant?.name || 'BaiShou'}
          onAssistantTap={() => setShowAssistantPicker(true)}
          onTriggerShortcut={() => setShowShortcutSheet(true)}
          onManageShortcuts={() => setShowShortcutManager(true)}
          onRecall={() => setShowRecallSheet(true)}
          onOpenTools={() => setShowToolManager(true)}
          searchMode={searchMode}
          onToggleSearchMode={toggleSearchMode}
        />
      </div>
    </div>
  );
};
