import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { CheckCircle2 } from 'lucide-react-native'
import type { DeepSeekImportResult } from '@baishou/core-mobile'
import { Button, useNativeTheme } from '@baishou/ui/native'
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'

export interface DeepSeekImportResultCardProps {
  result: DeepSeekImportResult
  onOpenAssistant: () => void
  onImportAnother: () => void
}

export const DeepSeekImportResultCard: React.FC<DeepSeekImportResultCardProps> = ({
  result,
  onOpenAssistant,
  onImportAnother
}) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.bgSurface,
          borderColor: colors.borderSubtle,
          borderRadius: tokens.radius.lg
        }
      ]}
    >
      <View style={styles.header}>
        <CheckCircle2 size={28} color={colors.success} strokeWidth={2} />
        <View style={styles.headerMeta}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {t('deepseek_import.result_title')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {result.createdNewAssistant
              ? t('deepseek_import.result_target_new', { name: result.assistantName })
              : t('deepseek_import.result_target_existing', { name: result.assistantName })}
          </Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View
          style={[
            styles.statCell,
            { backgroundColor: colors.bgSurfaceNormal, borderRadius: tokens.radius.md }
          ]}
        >
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>
            {result.importedSessions}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            {t('deepseek_import.result_stat_imported')}
          </Text>
        </View>

        <View
          style={[
            styles.statCell,
            { backgroundColor: colors.bgSurfaceNormal, borderRadius: tokens.radius.md }
          ]}
        >
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>
            {result.importedMessages}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            {t('deepseek_import.result_stat_messages')}
          </Text>
        </View>

        <View
          style={[
            styles.statCell,
            { backgroundColor: colors.bgSurfaceNormal, borderRadius: tokens.radius.md }
          ]}
        >
          <Text style={[styles.statValue, { color: colors.textSecondary }]}>
            {result.skippedSessions}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            {t('deepseek_import.result_stat_skipped')}
          </Text>
        </View>

        <View
          style={[
            styles.statCell,
            { backgroundColor: colors.bgSurfaceNormal, borderRadius: tokens.radius.md }
          ]}
        >
          <Text
            style={[
              styles.statValue,
              { color: result.failedSessions > 0 ? colors.error : colors.textSecondary }
            ]}
          >
            {result.failedSessions}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            {t('deepseek_import.result_stat_failed')}
          </Text>
        </View>
      </View>

      {result.importedAttachments > 0 ? (
        <Text style={[styles.noteText, { color: colors.textSecondary }]}>
          {t('deepseek_import.result_attachments_note', { count: result.importedAttachments })}
        </Text>
      ) : null}

      {result.failureSamples.length > 0 ? (
        <View
          style={[
            styles.failuresBox,
            { backgroundColor: colors.bgSurfaceNormal, borderRadius: tokens.radius.sm }
          ]}
        >
          <Text style={[styles.failuresTitle, { color: colors.error }]}>
            {t('deepseek_import.result_failures_title')}
          </Text>
          {result.failureSamples.map((sample, idx) => (
            <Text key={idx} style={[styles.failureItem, { color: colors.textSecondary }]}>
              • {sample}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button variant="primary" onPress={onOpenAssistant}>
          {t('deepseek_import.open_assistant_button')}
        </Button>
        <Button variant="outlined" onPress={onImportAnother}>
          {t('deepseek_import.import_another_button')}
        </Button>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: sharedTokens.spacing.mdSnug,
    gap: sharedTokens.spacing.md
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.mdTight
  },
  headerMeta: {
    flex: 1,
    gap: sharedTokens.spacing.xxs
  },
  title: {
    fontSize: mobileTypography.title.fontSize,
    fontWeight: '600'
  },
  subtitle: {
    fontSize: mobileTypography.secondary.fontSize,
    lineHeight: 20
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sharedTokens.spacing.sm
  },
  statCell: {
    flexBasis: '47%',
    flexGrow: 1,
    padding: sharedTokens.spacing.mdTight,
    gap: sharedTokens.spacing.xs
  },
  statValue: {
    fontSize: mobileTypography.title.fontSize,
    fontWeight: '600'
  },
  statLabel: {
    fontSize: mobileTypography.caption.fontSize
  },
  noteText: {
    fontSize: mobileTypography.secondary.fontSize
  },
  failuresBox: {
    padding: sharedTokens.spacing.smPlus,
    gap: sharedTokens.spacing.xs
  },
  failuresTitle: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  },
  failureItem: {
    fontSize: mobileTypography.caption.fontSize,
    lineHeight: 18
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sharedTokens.spacing.sm
  }
})
