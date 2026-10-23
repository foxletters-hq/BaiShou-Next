import React, { useEffect, useState } from 'react'
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

export interface ContextChainRecompressProgressProps {
  startedAt?: number
}

export const ContextChainRecompressProgress: React.FC<ContextChainRecompressProgressProps> = ({
  startedAt
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [elapsed, setElapsed] = useState(() =>
    startedAt ? Math.max(0, Math.round((Date.now() - startedAt) / 1000)) : 0
  )

  useEffect(() => {
    if (!startedAt) return
    const tick = () => setElapsed(Math.max(0, Math.round((Date.now() - startedAt) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startedAt])

  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      <View style={styles.head}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {t('agent.chat.recompress_running', '压缩中…')}
        </Text>
        {startedAt != null ? (
          <Text style={[styles.elapsed, { color: colors.textSecondary }]}>{elapsed}s</Text>
        ) : null}
      </View>
      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        {t(
          'agent.chat.recompress_banner_hint',
          '正在重新生成对话摘要，可切换条目或切换页面，完成后会自动更新'
        )}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: sharedTokens.spacing.sm,
    marginBottom: sharedTokens.spacing.mdTight
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.sm
  },
  title: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  },
  elapsed: {
    fontSize: mobileTypography.secondary.fontSize,
    marginLeft: 'auto'
  },
  hint: {
    fontSize: mobileTypography.caption.fontSize,
    lineHeight: 18
  }
})
