import React from 'react'
import { View, Text, Pressable, ScrollView, SafeAreaView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import type { MockChatMessage } from './context-chain-dialog.types'
import { getRoleColor, getRoleLabel } from './context-chain-dialog.utils'

interface ContextChainMessageDetailProps {
  message: MockChatMessage
  index: number
  onClose: () => void
}

export const ContextChainMessageDetail: React.FC<ContextChainMessageDetailProps> = ({
  message,
  index,
  onClose
}) => {
  const { t } = useTranslation()
  const { colors, tokens, maxModalWidth } = useNativeTheme()

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: colors.overlay,
        justifyContent: 'center',
        alignItems: 'center'
      }}
    >
      <SafeAreaView style={{ width: '100%', alignItems: 'center' }}>
        <View
          style={{
            width: '90%',
            maxWidth: maxModalWidth,
            maxHeight: '80%',
            backgroundColor: colors.bgSurface,
            borderRadius: tokens.radius.xl,
            padding: tokens.spacing.lg
          }}
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
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: tokens.radius.full,
                  backgroundColor: getRoleColor(message.role, colors) + '20'
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    color: getRoleColor(message.role, colors),
                    fontWeight: '600'
                  }}
                >
                  {getRoleLabel(message.role, t)}
                </Text>
              </View>
              <Text style={{ fontSize: 14, color: colors.textSecondary }}>#{index + 1}</Text>
            </View>
            <Pressable onPress={onClose}>
              <Text style={{ fontSize: 20, color: colors.textSecondary }}>×</Text>
            </Pressable>
          </View>

          <ScrollView>
            <Text style={{ fontSize: 16, color: colors.textPrimary, lineHeight: 24 }}>
              {message.content || t('agent.chat.no_content', '[无内容]')}
            </Text>
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
  )
}
