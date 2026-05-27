import React, { useState } from 'react'
import { View, Text, Pressable, Modal, SafeAreaView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
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
