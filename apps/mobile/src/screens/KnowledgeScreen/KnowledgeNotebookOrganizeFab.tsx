import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react-native'
import { settingsIcons, mobileTypography } from '@baishou/ui/theme/tokens'
import { useNativeTheme } from '@baishou/ui/native'
import type { NotebookOrganizeFabKind } from './knowledge-organize-fab.util'

export function KnowledgeNotebookOrganizeFab(props: {
  disabled?: boolean
  bottom: number
  kind?: NotebookOrganizeFabKind
  pendingCount?: number
  onPress: () => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const pendingCount = props.pendingCount ?? 0
  const kind = props.kind ?? (pendingCount <= 0 ? 'idle' : 'pending')
  const startLabel = t('graph.start_organize', '开始整理')
  const organizingLabel = t('knowledge.organize_title', '正在整理')
  const doneLabel = t('knowledge.organize_all_done', '已全部整理')
  const pendingLabel = t('memory.organize_pending_count', '待整理 {{count}} 篇', {
    count: pendingCount
  })
  const accessibilityLabel =
    kind === 'idle'
      ? doneLabel
      : kind === 'running'
        ? organizingLabel
        : kind === 'pending'
          ? `${startLabel} ${pendingLabel}`
          : startLabel

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
          opacity: props.disabled ? 0.6 : 1,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 5
        }
      ]}
    >
      {kind === 'idle' ? (
        <Text style={[styles.label, { color: colors.textOnPrimary }]}>{doneLabel}</Text>
      ) : kind === 'running' ? (
        <Text style={[styles.label, { color: colors.textOnPrimary }]}>{organizingLabel}</Text>
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
    justifyContent: 'center',
    zIndex: 10
  },
  label: {
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: mobileTypography.primary.fontWeight
  }
})
