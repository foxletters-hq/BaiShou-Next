import React, { useState } from 'react'
import { View, Text, Pressable, Modal, SafeAreaView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { HelpTooltip } from '../Tooltip/HelpTooltip'
import type { NativeContextChainDialogProps, ContextChainTab } from './context-chain-dialog.types'
import { buildContextChainTabs } from './context-chain-dialog.utils'
import { ContextChainStatsBar } from './ContextChainStatsBar'
import { ContextChainTabBar } from './ContextChainTabBar'
import { ContextChainList, ContextChainTextContent } from './ContextChainList'
import { ContextChainMessageDetail } from './ContextChainMessageDetail'

export type { MockChatMessage, NativeContextChainDialogProps } from './context-chain-dialog.types'

export const ContextChainDialog: React.FC<NativeContextChainDialogProps> = ({
  isOpen,
  onClose,
  message,
  contextMessages,
  compressedContent,
  originalContent,
  systemPrompt
}) => {
  const { t } = useTranslation()
  const { colors, tokens, maxModalWidth } = useNativeTheme()
  const [selectedMsgIndex, setSelectedMsgIndex] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<ContextChainTab>('context')

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

  const tabs = buildContextChainTabs(t, compressedContent, originalContent, systemPrompt)

  const renderContent = () => {
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
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: 'center',
          alignItems: 'center'
        }}
        onPress={onClose}
      >
        <SafeAreaView style={{ width: '100%', alignItems: 'center' }}>
          <Pressable
            style={{
              width: '90%',
              maxWidth: maxModalWidth,
              maxHeight: '85%',
              backgroundColor: colors.bgSurface,
              borderRadius: tokens.radius.xl,
              padding: tokens.spacing.lg
            }}
            onPress={(e) => e.stopPropagation()}
          >
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
                  gap: tokens.spacing.sm
                }}
              >
                <Text style={{ fontSize: 20 }}>🌿</Text>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: '600',
                    color: colors.textPrimary
                  }}
                >
                  {t('agent.chat.context_chain', '上下文调用链')}
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
                    {contextMessages.length}
                  </Text>
                </View>
              </View>
              <Pressable onPress={onClose}>
                <Text style={{ fontSize: 24, color: colors.textSecondary }}>×</Text>
              </Pressable>
            </View>

            <ContextChainStatsBar message={message} />
            <ContextChainTabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

            <View
              style={{
                height: 1,
                backgroundColor: colors.borderSubtle,
                marginBottom: tokens.spacing.sm
              }}
            />

            {renderContent()}
          </Pressable>
        </SafeAreaView>

        {selectedMsgIndex !== null && (
          <ContextChainMessageDetail
            message={contextMessages[selectedMsgIndex]}
            index={selectedMsgIndex}
            onClose={() => setSelectedMsgIndex(null)}
          />
        )}
      </Pressable>
    </Modal>
  )
}
