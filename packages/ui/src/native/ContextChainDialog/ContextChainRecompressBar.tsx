import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'

export interface ContextChainRecompressBarProps {
  busy: boolean
  error?: string | null
  onRecompress: () => void
  onDismissError?: () => void
}

export const ContextChainRecompressBar: React.FC<ContextChainRecompressBarProps> = ({
  busy,
  error,
  onRecompress,
  onDismissError
}) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onRecompress}
        disabled={busy}
        style={({ pressed }) => [
          styles.trigger,
          {
            backgroundColor: colors.primaryContainer,
            borderColor: colors.borderSubtle,
            opacity: busy ? 0.55 : pressed ? 0.85 : 1
          }
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('agent.chat.recompress_btn', '重新压缩')}
      >
        <Text style={[styles.triggerText, { color: colors.onPrimaryContainer }]}>
          {busy
            ? t('agent.chat.recompress_running', '压缩中…')
            : t('agent.chat.recompress_btn', '重新压缩')}
        </Text>
      </Pressable>
      {error ? (
        <View style={styles.errorRow}>
          <Text style={[styles.errorText, { color: colors.error ?? colors.textSecondary }]}>
            {error}
          </Text>
          {onDismissError ? (
            <Pressable onPress={onDismissError} hitSlop={8} style={{ marginLeft: tokens.spacing.sm }}>
              <Text style={{ fontSize: 13, color: colors.primary }}>
                {t('common.dismiss', '关闭')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
    marginBottom: 8
  },
  trigger: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth
  },
  triggerText: {
    fontSize: 13,
    fontWeight: '600'
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap'
  },
  errorText: {
    fontSize: 12,
    lineHeight: 18,
    flex: 1
  }
})
