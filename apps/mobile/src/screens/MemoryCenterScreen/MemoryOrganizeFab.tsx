import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react-native'
import { settingsIcons, mobileTypography } from '@baishou/ui/theme/tokens'
import { useNativeTheme } from '@baishou/ui/native'
import type { MemoryOrganizeFabKind } from './memory-center-organize.util'

export function MemoryOrganizeFab(props: {
  disabled?: boolean
  bottom: number
  kind?: MemoryOrganizeFabKind
  pendingCount?: number
  onPress: () => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const pendingCount = props.pendingCount ?? 0
  const kind = props.kind ?? (pendingCount <= 0 ? 'idle' : 'pending')
  const startLabel = t('memory.start_organize', '开始整理记忆')
  const doneLabel = t('memory.organize_all_done', '记忆已整理完毕')
  const pendingLabel = t('memory.organize_pending_count', '待整理 {{count}} 篇', {
    count: pendingCount
  })
  const accessibilityLabel =
    kind === 'idle' ? doneLabel : kind === 'pending' ? `${startLabel} ${pendingLabel}` : startLabel
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={props.disabled}
      onPress={props.onPress}
      style={[
        styles.fab,
        {
          right: tokens.spacing.lg,
          bottom: props.bottom,
          backgroundColor: colors.primary,
          borderRadius: tokens.radius.full,
          paddingHorizontal: tokens.spacing.lg,
          paddingVertical: tokens.spacing.sm,
          minHeight: tokens.spacing.xl + tokens.spacing.md,
          gap: tokens.spacing.sm,
          opacity: props.disabled ? 0.6 : 1
        }
      ]}
    >
      {kind === 'idle' ? (
        <Text style={[styles.label, { color: colors.textOnPrimary }]}>{doneLabel}</Text>
      ) : kind === 'pending' ? (
        <>
          <Text style={[styles.label, { color: colors.textOnPrimary }]}>{startLabel}</Text>
          <View
            style={{
              width: StyleSheet.hairlineWidth,
              height: mobileTypography.primary.fontSize,
              backgroundColor: colors.textOnPrimary,
              opacity: 0.45
            }}
          />
          <Text style={[styles.label, { color: colors.textOnPrimary }]}>{pendingLabel}</Text>
        </>
      ) : (
        <Text style={[styles.label, { color: colors.textOnPrimary }]}>{startLabel}</Text>
      )}
      <Sparkles size={settingsIcons.leading} color={colors.textOnPrimary} strokeWidth={2} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  label: {
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: mobileTypography.primary.fontWeight
  }
})
