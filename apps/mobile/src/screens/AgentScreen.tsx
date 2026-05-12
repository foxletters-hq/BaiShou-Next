import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View, StyleSheet, FlatList, KeyboardAvoidingView,
  Platform, SafeAreaView, StatusBar, TouchableOpacity, Text, Alert
} from 'react-native';
import { ChatBubble, InputBar, TokenBadge } from '@baishou/ui/native';
import { useNativeTheme } from '@baishou/ui/src/native/theme';
import { useAgentStore } from '@baishou/store/src/stores/agent.store';
import { useTranslation } from 'react-i18next';

import { SessionList } from '../components/SessionList';
import { AssistantPicker } from '../components/AssistantPicker';
import { ModelSwitcher } from '../components/ModelSwitcher';
import { StreamingBubble } from '../components/StreamingBubble';
import { ShortcutManager } from '../components/ShortcutManager';
import { TokenUsageDialog } from '../components/TokenUsageDialog';
import { RecallDialog } from '../components/RecallDialog';
import { ToolManagerDialog } from '../components/ToolManagerDialog';
import { ContextChainDialog } from '../components/ContextChainDialog';
import { useAgentSession } from '../hooks/useAgentSession';
import { useAgentStream } from '../hooks/useAgentStream';
import { useAgentModel } from '../hooks/useAgentModel';
import { useAgentUI } from '../hooks/useAgentUI';
import { useTTS } from '../hooks/useTTS';
import { useBranchSession } from '../hooks/useBranchSession';

export const AgentScreen = () => {
  const { t } = useTranslation();
  const { isLoading, searchMode, toggleSearchMode } = useAgentStore();
  const { colors, isDark } = useNativeTheme();
  const flatListRef = useRef<FlatList>(null);

  // 使用会话管理 hook
  const {
    currentSessionId, setCurrentSessionId, hasMore, messages,
    handleLoadMore, handleSelectSession, handleCreateSession,
    handleDeleteSession, handlePinSession,
  } = useAgentSession();

  // 使用模型管理 hook
  const {
    currentAssistant, currentProviderId, currentModelId,
    showAssistantPicker, showModelSwitcher,
    setShowAssistantPicker, setShowModelSwitcher,
    handleSelectAssistant, handleSelectModel,
  } = useAgentModel();

  // 使用流式对话 hook
  const {
    isStreaming, streamingText, tokenUsage,
    handleSend, handleStop, handleRegenerate,
    handleEditMessage, handleDeleteMessage,
  } = useAgentStream(currentSessionId, currentProviderId, currentModelId, currentAssistant, setCurrentSessionId);

  // 使用 UI 状态 hook
  const {
    showSessionList, showCostDialog, showScrollButton,
    showShortcutSheet, showRecallSheet, showToolManager,
    recallItems, isSearchingRecall,
    setShowSessionList, setShowCostDialog, setShowShortcutSheet,
    setShowRecallSheet, setShowToolManager,
    handleScroll, scrollToBottom, handleRecallSearch, handleInjectRecall,
  } = useAgentUI();

  // 使用 TTS hook
  const { ttsPlayingMsgId, handleTtsReadAloud, stopTTS } = useTTS();

  // 使用分支会话 hook
  const { branchSession } = useBranchSession();

  // 上下文链对话框状态
  const [contextDialogState, setContextDialogState] = useState<{
    visible: boolean;
    message: any;
    contextMessages: any[];
    compressedContent?: string;
    originalContent?: string;
    systemPrompt?: string;
  }>({
    visible: false,
    message: {},
    contextMessages: [],
  });

  // 处理分支创建
  const handleBranch = useCallback(async (messageId: string) => {
    if (!currentSessionId) return;
    try {
      const newSessionId = await branchSession(currentSessionId, messageId, currentAssistant?.name);
      if (newSessionId) {
        Alert.alert(t('agent.chat.branch_success', '分支创建成功'), t('agent.chat.branch_success_hint', '已创建新的分支会话'));
        // 刷新会话列表或导航到新会话
      }
    } catch (e: any) {
      Alert.alert(t('agent.chat.branch_failed', '分支创建失败'), e.message || t('common.unknown_error', '未知错误'));
    }
  }, [currentSessionId, branchSession, currentAssistant?.name, t]);

  // 处理显示上下文链
  const handleShowContext = useCallback((message: any) => {
    // 解析上下文消息
    let decodedContext: any[] = [];
    let compressedContent: string | undefined;
    let originalContent: string | undefined;
    let systemPrompt: string | undefined;

    // 查找前一条用户消息中的上下文快照
    const msgIndex = messages.findIndex((m: any) => m.id === message.id);
    if (msgIndex > 0) {
      const prevMsg = messages[msgIndex - 1];
      if (prevMsg.role === 'user' && prevMsg.parts) {
        const ctxPart = prevMsg.parts.find((p: any) => p.type === 'context_snapshot');
        if (ctxPart && ctxPart.data?.snapshots) {
          decodedContext = ctxPart.data.snapshots.map((s: any) => ({
            role: 'system',
            content: `${s.title ? '[' + s.title + '] ' : ''}${s.content}`,
            timestamp: message.createdAt || new Date(),
          }));
        }

        // 获取压缩内容
        const compPart = prevMsg.parts.find((p: any) => p.type === 'compaction');
        if (compPart && compPart.data?.summary) {
          compressedContent = compPart.data.summary;
        }
      }

      // 获取系统提示词
      if (msgIndex === 1 || (msgIndex === 2 && messages[0]?.role === 'system')) {
        const sysMsg = messages.find((m: any) => m.role === 'system');
        if (sysMsg?.content) {
          systemPrompt = sysMsg.content;
        }
      }
    }

    setContextDialogState({
      visible: true,
      message,
      contextMessages: decodedContext,
      compressedContent,
      originalContent: message.content,
      systemPrompt,
    });
  }, [messages]);

  // 自动滚动到底部
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const totalInputTokens = tokenUsage?.inputTokens || 0;
  const totalOutputTokens = tokenUsage?.outputTokens || 0;
  const estimatedCost = (tokenUsage?.totalCostMicros || 0) / 1000000;

  return (
    <>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.bgApp} />
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bgApp }]}>
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* 顶部栏 */}
          <View style={[styles.header, { backgroundColor: colors.bgSurface, borderBottomColor: colors.borderSubtle }]}>
            <View style={styles.headerTitleWrap}>
              <TouchableOpacity style={[styles.avatar, { backgroundColor: colors.bgSurfaceHighest }]} onPress={() => setShowAssistantPicker(true)}>
                <Text style={{ fontSize: 16 }}>{currentAssistant?.emoji || '🤖'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowAssistantPicker(true)}>
                <Text style={[styles.agentName, { color: colors.textPrimary }]}>{currentAssistant?.name || t('agent.default_name', 'BaiShou Core')}</Text>
                <Text style={[styles.agentStatus, { color: colors.accentGreen }]}>🟢 Neural Sync Active</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity style={[styles.modelBtn, { backgroundColor: colors.bgSurfaceHighest }]} onPress={() => setShowModelSwitcher(true)}>
                <Text style={[styles.modelBtnText, { color: colors.textSecondary }]}>{currentModelId || t('agent.no_model_selected', '选择模型')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowCostDialog(true)}>
                <TokenBadge tokenCount={totalInputTokens + totalOutputTokens} costEstimate={estimatedCost} />
              </TouchableOpacity>
            </View>
          </View>

          {/* 会话切换按钮 */}
          <TouchableOpacity style={[styles.sessionToggle, { backgroundColor: colors.bgSurfaceHighest }]} onPress={() => setShowSessionList(true)}>
            <Text style={[styles.sessionToggleText, { color: colors.textSecondary }]}>
              {currentSessionId ? t('agent.sessions.switch', '切换会话') : t('agent.sessions.new_session', '新建会话')}
            </Text>
          </TouchableOpacity>

          {/* 分页加载按钮 */}
          {hasMore && (
            <TouchableOpacity style={styles.loadMore} onPress={handleLoadMore}>
              <Text style={[styles.loadMoreText, { color: colors.textSecondary }]}>{t('agent.load_more', '点击加载更多记录')}</Text>
            </TouchableOpacity>
          )}

          {/* 聊天列表 */}
          <FlatList
            ref={flatListRef}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={({ item }) => {
              // 解析上下文消息
              let decodedContext: any[] | undefined;
              let compressedContent: string | undefined;
              let originalContent: string | undefined;
              let systemPrompt: string | undefined;

              if (item.role === 'assistant') {
                const msgIndex = messages.findIndex((m: any) => m.id === item.id);
                if (msgIndex > 0) {
                  const prevMsg = messages[msgIndex - 1];
                  if (prevMsg.role === 'user' && prevMsg.parts) {
                    const ctxPart = prevMsg.parts.find((p: any) => p.type === 'context_snapshot');
                    if (ctxPart && ctxPart.data?.snapshots) {
                      decodedContext = ctxPart.data.snapshots.map((s: any) => ({
                        role: 'system',
                        content: `${s.title ? '[' + s.title + '] ' : ''}${s.content}`,
                        timestamp: item.createdAt || new Date(),
                      }));
                    }

                    // 获取压缩内容
                    const compPart = prevMsg.parts.find((p: any) => p.type === 'compaction');
                    if (compPart && compPart.data?.summary) {
                      compressedContent = compPart.data.summary;
                    }
                  }

                  // 获取系统提示词
                  if (msgIndex === 1 || (msgIndex === 2 && messages[0]?.role === 'system')) {
                    const sysMsg = messages.find((m: any) => m.role === 'system');
                    if (sysMsg?.content) {
                      systemPrompt = sysMsg.content;
                    }
                  }
                }
              }

              return (
                <View style={styles.bubble}>
                  <ChatBubble
                    message={{
                      role: item.role as any,
                      content: item.content,
                      toolInvocations: item.toolInvocations,
                      attachments: item.attachments,
                      inputTokens: item.inputTokens,
                      outputTokens: item.outputTokens,
                      isReasoning: item.isReasoning,
                      costMicros: item.costMicros,
                      contextMessages: decodedContext,
                    }}
                    onRegenerate={() => handleRegenerate(item.id)}
                    onEdit={() => handleEditMessage(item.id, item.content)}
                    onDelete={() => handleDeleteMessage(item.id)}
                    onReadAloud={item.role === 'assistant' ? (content) => handleTtsReadAloud(content, item.id) : undefined}
                    isTtsPlaying={ttsPlayingMsgId === item.id}
                    onShowContext={item.role === 'assistant' ? handleShowContext : undefined}
                    onBranch={item.role === 'assistant' ? () => handleBranch(item.id) : undefined}
                  />
                </View>
              );
            }}
            ListFooterComponent={isStreaming ? <StreamingBubble text={streamingText} aiProfile={{ name: currentAssistant?.name || 'AI', emoji: currentAssistant?.emoji }} /> : null}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>🌌</Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('agent.empty_title', '神经节完全空白')}</Text>
                <Text style={[styles.emptySub, { color: colors.textSecondary }]}>{t('agent.empty_subtitle', '尝试敲入指令以焕发突触...')}</Text>
              </View>
            }
          />

          {/* 滚动到底部按钮 */}
          {showScrollButton && (
            <TouchableOpacity style={[styles.scrollBtn, { backgroundColor: colors.bgSurface }]} onPress={() => scrollToBottom(flatListRef, true)}>
              <Text style={[styles.scrollBtnText, { color: colors.textSecondary }]}>↓</Text>
            </TouchableOpacity>
          )}

          {/* 底部功能条 */}
          <View style={[styles.actionBar, { backgroundColor: colors.bgSurface, borderTopColor: colors.borderSubtle }]}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.bgSurfaceHighest }]} onPress={() => setShowShortcutSheet(true)}>
              <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>/</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.bgSurfaceHighest }]} onPress={() => setShowRecallSheet(true)}>
              <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>📷</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.bgSurfaceHighest }]} onPress={() => setShowToolManager(true)}>
              <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>📌</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: searchMode ? colors.primary : colors.bgSurfaceHighest }]} onPress={toggleSearchMode}>
              <Text style={[styles.actionBtnText, { color: searchMode ? colors.textOnPrimary : colors.textSecondary }]}>🔍</Text>
            </TouchableOpacity>
          </View>

          {/* 输入框 */}
          <View style={[styles.inputWrap, { backgroundColor: colors.bgSurface }]}>
            <InputBar onSend={handleSend} isLoading={isLoading} onStop={handleStop} assistantName={currentAssistant?.name || t('agent.default_name', 'BaiShou Core')} />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* 会话列表模态框 */}
      {showSessionList && (
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modal, { backgroundColor: colors.bgSurface }]}>
            <SessionList selectedSessionId={currentSessionId || undefined} onSelectSession={handleSelectSession} onCreateSession={handleCreateSession} onDeleteSession={handleDeleteSession} onPinSession={handlePinSession} />
            <TouchableOpacity style={[styles.closeBtn, { backgroundColor: colors.bgSurfaceHighest }]} onPress={() => setShowSessionList(false)}>
              <Text style={[styles.closeBtnText, { color: colors.textSecondary }]}>{t('common.close', '关闭')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 助手选择器 */}
      <AssistantPicker isVisible={showAssistantPicker} onClose={() => setShowAssistantPicker(false)} onSelect={handleSelectAssistant} selectedAssistantId={currentAssistant?.id} />

      {/* 模型切换器 */}
      <ModelSwitcher isVisible={showModelSwitcher} onClose={() => setShowModelSwitcher(false)} onSelect={handleSelectModel} currentProviderId={currentProviderId || undefined} currentModelId={currentModelId || undefined} />

      {/* Token 使用统计对话框 */}
      <TokenUsageDialog visible={showCostDialog} onClose={() => setShowCostDialog(false)} currentModelId={currentModelId} inputTokens={totalInputTokens} outputTokens={totalOutputTokens} estimatedCost={estimatedCost} />

      {/* 快捷方式管理器 */}
      <ShortcutManager isVisible={showShortcutSheet} onClose={() => setShowShortcutSheet(false)} onSelect={() => {}} />

      {/* 记忆召回答框 */}
      <RecallDialog visible={showRecallSheet} onClose={() => setShowRecallSheet(false)} items={recallItems} isSearching={isSearchingRecall} onSearch={handleRecallSearch} onInject={handleInjectRecall} />

      {/* 工具管理器 */}
      <ToolManagerDialog visible={showToolManager} onClose={() => setShowToolManager(false)} />

      {/* 上下文链对话框 */}
      <ContextChainDialog
        visible={contextDialogState.visible}
        onClose={() => setContextDialogState(prev => ({ ...prev, visible: false }))}
        message={contextDialogState.message}
        contextMessages={contextDialogState.contextMessages}
        compressedContent={contextDialogState.compressedContent}
        originalContent={contextDialogState.originalContent}
        systemPrompt={contextDialogState.systemPrompt}
      />
    </>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20, borderBottomWidth: 1 },
  headerTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  agentName: { fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
  agentStatus: { fontSize: 11, fontWeight: '600' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modelBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  modelBtnText: { fontSize: 12, fontWeight: '600' },
  sessionToggle: { paddingHorizontal: 16, paddingVertical: 8, marginHorizontal: 16, marginVertical: 8, borderRadius: 8, alignItems: 'center' },
  sessionToggleText: { fontSize: 14, fontWeight: '600' },
  loadMore: { paddingVertical: 12, alignItems: 'center' },
  loadMoreText: { fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
  list: { flex: 1 },
  listContent: { paddingVertical: 24, paddingHorizontal: 16, flexGrow: 1 },
  bubble: { marginBottom: 20 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: '30%', opacity: 0.5 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySub: { fontSize: 14, fontWeight: '500' },
  scrollBtn: { position: 'absolute', bottom: 100, right: 32, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
  scrollBtnText: { fontSize: 18, fontWeight: '600' },
  actionBar: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 8, gap: 12, borderTopWidth: 1 },
  actionBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { fontSize: 15, fontWeight: '800' },
  inputWrap: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: Platform.OS === 'ios' ? 24 : 16 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  modal: { width: '90%', height: '80%', borderRadius: 24, overflow: 'hidden' },
  closeBtn: { padding: 16, alignItems: 'center', borderTopWidth: 1 },
  closeBtnText: { fontSize: 16, fontWeight: '600' },
});
