import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { ChevronRight } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import type { MockChatMessage } from './context-chain-dialog.types'
import { getRoleColor, getRoleLabel } from './context-chain-dialog.utils'
import { iconSizes, mobileTypography, sharedTokens } from '../../theme/tokens'

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
    <View>
      {contextMessages.map((msg, idx) => (
        <Pressable
          key={idx}
          onPress={() => onSelectMessage(idx)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: sharedTokens.spacing.smPlus,
            paddingHorizontal: sharedTokens.spacing.xs,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.borderSubtle,
            gap: tokens.spacing.sm
          }}
        >
          <Text
            style={{
              fontSize: mobileTypography.caption.fontSize,
              fontWeight: '600',
              color: colors.textTertiary,
              width: 24
            }}
          >
            {idx + 1}
          </Text>
          <View
            style={{
              paddingHorizontal: sharedTokens.spacing.sm,
              paddingVertical: sharedTokens.spacing.xxs,
              borderRadius: sharedTokens.radius.xs,
              backgroundColor: getRoleColor(msg.role, colors) + '20'
            }}
          >
            <Text
              style={{
                fontSize: mobileTypography.caption.fontSize,
                lineHeight: 16,
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
              fontSize: mobileTypography.secondary.fontSize,
              lineHeight: 20,
              color: colors.textSecondary
            }}
            numberOfLines={1}
          >
            {msg.content ||
              (msg.toolInvocations
                ? t(
                    'auto.packages.ui.src.native.ContextChainDialog.ContextChainList.L72',
                    '→ 工具交互'
                  )
                : t('agent.chat.empty_content', '[空文本]'))}
          </Text>
          <ChevronRight
            size={iconSizes.sm}
            color={colors.textTertiary}
            strokeWidth={DEFAULT_STROKE_WIDTH}
          />
        </Pressable>
      ))}
    </View>
  )
}

interface ContextChainTextContentProps {
  content: string
}

export const ContextChainTextContent: React.FC<ContextChainTextContentProps> = ({ content }) => {
  const { colors, tokens } = useNativeTheme()

  return (
    <Text
      style={{
        fontSize: mobileTypography.secondary.fontSize,
        color: colors.textPrimary,
        lineHeight: 22,
        padding: tokens.spacing.sm,
        fontFamily: 'monospace'
      }}
    >
      {content}
    </Text>
  )
}
