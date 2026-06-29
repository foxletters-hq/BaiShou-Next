import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  useWindowDimensions
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { HelpTooltip } from '../Tooltip/HelpTooltip'
import { AgentMarkdownRenderer } from '../AgentMarkdown'
import type { NativeContextChainDialogProps, ContextChainTab } from './context-chain-dialog.types'
import { buildContextChainTabs } from './context-chain-dialog.utils'
import { ContextChainStatsBar } from './ContextChainStatsBar'
import { ContextChainTabBar } from './ContextChainTabBar'
import { ContextChainList, ContextChainTextContent } from './ContextChainList'
import { ContextChainFlatList } from './ContextChainFlatList'
import { ContextChainMessageDetail } from './ContextChainMessageDetail'
import { ContextChainDetailPage } from './ContextChainDetailPage'
import { ContextChainFooter } from './ContextChainFooter'
import { useContextChainView } from './useContextChainView'
import { ContextChainRecompressBar } from './ContextChainRecompressBar'
import { ContextChainRecompressProgress } from './ContextChainRecompressProgress'
import { CompressionActivityBar } from '../CompressionActivityBar'

const chainScrollProps = {
  showsVerticalScrollIndicator: false,
  showsHorizontalScrollIndicator: false,
  keyboardShouldPersistTaps: 'handled' as const,
  nestedScrollEnabled: false,
  overScrollMode: 'never' as const
}

export type { MockChatMessage, NativeContextChainDialogProps } from './context-chain-dialog.types'
export type { CallChainFlatEntry, CallChainPanelMeta } from './context-chain-panel.types'

export const ContextChainDialog: React.FC<NativeContextChainDialogProps> = ({
  isOpen,
  onClose,
  message,
  contextMessages = [],
  flatEntries = [],
  meta,
  compressedContent,
  originalContent,
  systemPrompt,
  sessionId,
  recompressBusy = false,
  recompressStartedAt,
  recompressStreamText = '',
  recompressStreamReasoning = '',
  recompressError = null,
  onRecompress,
  onRecompressDismissError
}) => {
  const { t } = useTranslation()
  const { colors, tokens, maxModalWidth } = useNativeTheme()
  const { height: windowHeight } = useWindowDimensions()

  const modalMaxHeight = Math.floor(windowHeight * 0.88)
  const [selectedMsgIndex, setSelectedMsgIndex] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<ContextChainTab>('context')
  const [detailKey, setDetailKey] = useState<string | null>(null)

  const useFlatChain = flatEntries.length > 0
  const view = useContextChainView({
    message,
    flatEntries,
    meta,
    compressedContent,
    systemPrompt,
    isOpen: isOpen && useFlatChain
  })

  useEffect(() => {
    if (isOpen) {
      setSelectedMsgIndex(null)
      setActiveTab('context')
      setDetailKey(null)
    }
  }, [isOpen, message.id])

  const handleRequestClose = () => {
    if (useFlatChain && detailKey) {
      setDetailKey(null)
      return
    }
    onClose()
  }

  const compressionHelpContent = (
    <View style={{ gap: 12 }}>
      <Text style={{ fontSize: 14, color: colors.textPrimary, lineHeight: 20 }}>
        {t(
          'agent.chat.compression_help_intro',
          '当对话上下文超过伙伴设置的 Token 阈值时，系统会把更早的对话合并为一条「对话压缩」摘要，再与近期完整轮次一起发给模型。'
        )}
      </Text>
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
          {t('agent.chat.compression_help_trigger_title', '何时触发')}
        </Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>
          {t(
            'agent.chat.compression_help_trigger_body',
            '在伙伴设置中开启「自动压缩」并设定阈值（0 表示关闭）。每次发送前与回复落盘后都会检测；超过阈值则调用模型生成/更新摘要，并剪枝过长的工具输出。'
          )}
        </Text>
      </View>
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
          {t('agent.chat.compression_help_chain_title', '调用链展示顺序')}
        </Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>
          • {t('agent.chat.compression_help_chain_1', '系统提示词（独立一块）')}
          {'\n'}• {t('agent.chat.compression_help_chain_2', '对话压缩（独立一块，介于轮次之间）')}
          {'\n'}•{' '}
          {t(
            'agent.chat.compression_help_chain_3',
            '第 1、2… 轮：仅压缩点之后的对话，从第 1 轮重新计数'
          )}
        </Text>
      </View>
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
          {t('agent.chat.compression_help_footer_title', '底部指标含义')}
        </Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>
          •{' '}
          {t(
            'agent.chat.compression_help_footer_tokens',
            '上下文 tokens：系统提示词 + 压缩摘要 + 当前窗口内消息的粗估总量'
          )}
          {'\n'}•{' '}
          {t(
            'agent.chat.compression_help_footer_rounds',
            '上下文轮数：压缩后计入窗口的用户轮数 / 伙伴配置的携带轮数上限（不限表示不按轮截断）'
          )}
        </Text>
      </View>
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
          {t('agent.chat.compression_help_keep_title', '保留轮数')}
        </Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>
          {t(
            'agent.chat.compression_help_keep_body',
            '压缩时始终保留最近 N 轮用户消息的完整原文（含该轮 AI 回复与工具调用）；更早内容进入摘要。N 在伙伴设置中配置。'
          )}
        </Text>
      </View>
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
          {t('agent.chat.compression_help_branch_title', '分支与回到更早位置')}
        </Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>
          {t(
            'agent.chat.compression_help_branch_body',
            '创建分支会复制消息与仍有效的压缩快照。在某条较早消息上重发/编辑重发时，若锚点消息被删除，将回退为完整原文上下文而非摘要。'
          )}
        </Text>
      </View>
    </View>
  )

  if (!isOpen) return null

  const legacyTabs = buildContextChainTabs(t, compressedContent, originalContent, systemPrompt)
  const tabs = useFlatChain ? view.tabs : legacyTabs
  const messageCount = useFlatChain
    ? flatEntries.filter((e) => e.kind === 'message' || e.kind === 'system-prompt').length
    : contextMessages.length

  const renderLegacyContent = () => {
    if (activeTab === 'context') {
      return (
        <ContextChainList contextMessages={contextMessages} onSelectMessage={setSelectedMsgIndex} />
      )
    }

    const content =
      activeTab === 'compressed'
        ? compressedContent
        : activeTab === 'original'
          ? originalContent
          : systemPrompt

    if (!content) return null
    return <ContextChainTextContent content={content} />
  }

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={handleRequestClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" />

        <SafeAreaView style={{ width: '100%', alignItems: 'center' }} pointerEvents="box-none">
          <View
            style={{
              width: '92%',
              maxWidth: maxModalWidth,
              height: modalMaxHeight,
              maxHeight: modalMaxHeight,
              backgroundColor: colors.bgSurface,
              borderRadius: tokens.radius.xl,
              padding: tokens.spacing.lg,
              overflow: 'hidden'
            }}
          >
            {useFlatChain && detailKey ? (
              <View style={{ flex: 1, minHeight: 0 }}>
                <ContextChainDetailPage
                  view={view}
                  detailKey={detailKey}
                  onBack={() => setDetailKey(null)}
                  onClose={onClose}
                  sessionId={sessionId}
                  recompressBusy={recompressBusy}
                  recompressStartedAt={recompressStartedAt}
                  recompressStreamText={recompressStreamText}
                  recompressStreamReasoning={recompressStreamReasoning}
                  recompressError={recompressError}
                  onRecompress={onRecompress}
                  onRecompressDismissError={onRecompressDismissError}
                />
              </View>
            ) : (
              <View style={{ flex: 1, minHeight: 0 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: tokens.spacing.md
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: tokens.spacing.sm,
                      flex: 1
                    }}
                  >
                    <Text style={{ fontSize: 20 }}>🌿</Text>
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: '600',
                        color: colors.textPrimary
                      }}
                      numberOfLines={1}
                    >
                      {t('agent.chat.full_call_chain', '完整调用链')}
                    </Text>
                    <HelpTooltip content={compressionHelpContent} />
                    <View
                      style={{
                        backgroundColor: colors.primaryContainer,
                        borderRadius: tokens.radius.full,
                        paddingHorizontal: 8,
                        paddingVertical: 2
                      }}
                    >
                      <Text style={{ fontSize: 12, color: colors.onPrimaryContainer }}>
                        {messageCount}
                      </Text>
                    </View>
                  </View>
                  <Pressable onPress={onClose}>
                    <Text style={{ fontSize: 24, color: colors.textSecondary }}>×</Text>
                  </Pressable>
                </View>

                {!useFlatChain ? <ContextChainStatsBar message={message} /> : null}

                <ContextChainTabBar
                  tabs={tabs}
                  activeTab={useFlatChain ? view.activeTab : activeTab}
                  onTabChange={(tab) => {
                    if (useFlatChain) {
                      if (tab === 'context' || tab === 'compressed' || tab === 'prompt') {
                        view.setActiveTab(tab)
                      }
                      return
                    }
                    setActiveTab(tab)
                  }}
                />

                <View
                  style={{
                    height: 1,
                    backgroundColor: colors.borderSubtle,
                    marginVertical: tokens.spacing.sm
                  }}
                />

                <ScrollView
                  style={{ flex: 1, minHeight: 0 }}
                  contentContainerStyle={{ paddingBottom: tokens.spacing.sm }}
                  {...chainScrollProps}
                >
                  {useFlatChain ? (
                    view.activeTab === 'context' ? (
                      <ContextChainFlatList view={view} onOpenDetail={setDetailKey} />
                    ) : view.activeTab === 'compressed' && view.compressedContent ? (
                      <>
                        {sessionId && onRecompress ? (
                          <ContextChainRecompressBar
                            busy={recompressBusy}
                            error={recompressError}
                            onRecompress={onRecompress}
                            onDismissError={onRecompressDismissError}
                          />
                        ) : null}
                        {recompressBusy ? (
                          <>
                            <ContextChainRecompressProgress startedAt={recompressStartedAt} />
                            <CompressionActivityBar
                              phase="manual"
                              summary={recompressStreamText}
                              reasoning={recompressStreamReasoning}
                              isActive
                            />
                          </>
                        ) : (
                          <AgentMarkdownRenderer content={view.compressedContent} variant="ancillary" />
                        )}
                      </>
                    ) : view.activeTab === 'prompt' && view.systemPrompt ? (
                      <AgentMarkdownRenderer content={view.systemPrompt} plainText />
                    ) : null
                  ) : (
                    renderLegacyContent()
                  )}

                  {useFlatChain ? <ContextChainFooter view={view} /> : null}
                </ScrollView>
              </View>
            )}
          </View>
        </SafeAreaView>

        {!useFlatChain && selectedMsgIndex !== null ? (
          <ContextChainMessageDetail
            message={contextMessages[selectedMsgIndex]}
            index={selectedMsgIndex}
            onClose={() => setSelectedMsgIndex(null)}
          />
        ) : null}
      </View>
    </Modal>
  )
}
