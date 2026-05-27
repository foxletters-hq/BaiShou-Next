import React from 'react'
import { View, Text, Pressable, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import type { MockChatMessage } from './context-chain-dialog.types'
import { getRoleColor, getRoleLabel } from './context-chain-dialog.utils'

interface ContextChainListProps {
  contextMessages: MockChatMessage[]
  onSelectMessage: (index: number) => void
}

export const ContextChainList: React.FC<ContextChainListProps> = ({
  contextMessages,
  onSelectMessage
}) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()

  return (
    <ScrollView style={{ maxHeight: 400 }}>
      {contextMessages.map((msg, idx) => (
        <Pressable
          key={idx}
          onPress={() => onSelectMessage(idx)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: tokens.spacing.sm,
            borderBottomWidth: 1,
            borderBottomColor: colors.borderSubtle,
            gap: tokens.spacing.sm
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: '600',
              color: colors.textSecondary,
              width: 30
            }}
          >
            {idx + 1}
          </Text>
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: tokens.radius.full,
              backgroundColor: getRoleColor(msg.role, colors) + '20'
            }}
          >
            <Text
              style={{
                fontSize: 12,
                color: getRoleColor(msg.role, colors),
                fontWeight: '600'
              }}
            >
              {getRoleLabel(msg.role, t)}
            </Text>
          </View>
          <Text
            style={{
              flex: 1,
              fontSize: 14,
              color: colors.textPrimary
            }}
            numberOfLines={1}
          >
            {msg.content ||
              (msg.toolInvocations ? '→ 工具交互' : t('agent.chat.empty_content', '[空文本]'))}
          </Text>
          <Text style={{ fontSize: 16, color: colors.textSecondary }}>›</Text>
        </Pressable>
      ))}
    </ScrollView>
  )
}

interface ContextChainTextContentProps {
  content: string
}

export const ContextChainTextContent: React.FC<ContextChainTextContentProps> = ({ content }) => {
  const { colors, tokens } = useNativeTheme()

  return (
    <ScrollView style={{ maxHeight: 400 }}>
      <Text
        style={{
          fontSize: 14,
          color: colors.textPrimary,
          lineHeight: 22,
          padding: tokens.spacing.sm,
          fontFamily: 'monospace'
        }}
      >
        {content}
      </Text>
    </ScrollView>
  )
}
