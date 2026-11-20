import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { DeepSeekSessionPreview } from '@baishou/core-mobile'
import { Button, Checkbox, useNativeTheme } from '@baishou/ui/native'
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'

export interface DeepSeekImportSessionListCardProps {
  sessions: DeepSeekSessionPreview[]
  selectedSessionIds: Set<string>
  onToggleSession: (sourceId: string) => void
  onToggleSelectAll: () => void
  onStartImport: () => void
  canStartImport: boolean
  importing?: boolean
  disabled?: boolean
}

function formatShortDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export const DeepSeekImportSessionListCard: React.FC<DeepSeekImportSessionListCardProps> = ({
  sessions,
  selectedSessionIds,
  onToggleSession,
  onToggleSelectAll,
  onStartImport,
  canStartImport,
  importing = false,
  disabled = false
}) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()

  const selectedCount = selectedSessionIds.size
  const allSelected = sessions.length > 0 && selectedCount === sessions.length
  const isIndeterminate = selectedCount > 0 && selectedCount < sessions.length

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
      <View style={styles.headerBlock}>
        <View style={styles.titleRow}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            {t('deepseek_import.sessions_section_title')}
          </Text>
          <Text style={[styles.countText, { color: colors.textSecondary }]}>
            {t('deepseek_import.selected_count', {
              selected: selectedCount,
              total: sessions.length
            })}
          </Text>
        </View>

        <View
          style={[
            styles.actionBar,
            {
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.borderSubtle
            }
          ]}
        >
          <TouchableOpacity
            style={styles.selectAllBtn}
            disabled={disabled}
            onPress={onToggleSelectAll}
            hitSlop={8}
          >
            <Checkbox
              selected={allSelected}
              indeterminate={isIndeterminate}
              disabled={disabled}
              onPress={onToggleSelectAll}
            />
            <Text style={[styles.selectAllLabel, { color: colors.primary }]}>
              {allSelected ? t('deepseek_import.deselect_all') : t('deepseek_import.select_all')}
            </Text>
          </TouchableOpacity>

          <Button
            variant="primary"
            onPress={onStartImport}
            disabled={!canStartImport}
            isLoading={importing}
          >
            {t('deepseek_import.start_import_button', { count: selectedCount })}
          </Button>
        </View>
      </View>

      <View style={styles.list}>
        {sessions.map((session, index) => {
          const checked = selectedSessionIds.has(session.sourceId)
          const isLast = index === sessions.length - 1
          return (
            <TouchableOpacity
              key={session.sourceId}
              disabled={disabled}
              activeOpacity={0.7}
              onPress={() => onToggleSession(session.sourceId)}
              style={[
                styles.sessionRow,
                !isLast && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.borderSubtle
                }
              ]}
            >
              <Checkbox
                selected={checked}
                disabled={disabled}
                onPress={() => onToggleSession(session.sourceId)}
              />
              <View style={styles.sessionBody}>
                <Text
                  style={[styles.sessionTitle, { color: colors.textPrimary }]}
                  numberOfLines={2}
                >
                  {session.title || t('deepseek_import.untitled_session')}
                </Text>
                <View style={styles.metaRow}>
                  <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                    {t('deepseek_import.session_messages_count', { count: session.messageCount })}
                  </Text>
                  <Text style={[styles.metaText, { color: colors.textTertiary }]}>·</Text>
                  <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                    {formatShortDate(session.updatedAt)}
                  </Text>
                  {session.hasThinking ? (
                    <View
                      style={[
                        styles.tagChip,
                        { backgroundColor: colors.bgSurfaceNormal, borderRadius: tokens.radius.xs }
                      ]}
                    >
                      <Text style={[styles.tagText, { color: colors.textSecondary }]}>
                        {t('deepseek_import.tag_thinking')}
                      </Text>
                    </View>
                  ) : null}
                  {session.hasSearch ? (
                    <View
                      style={[
                        styles.tagChip,
                        { backgroundColor: colors.bgSurfaceNormal, borderRadius: tokens.radius.xs }
                      ]}
                    >
                      <Text style={[styles.tagText, { color: colors.textSecondary }]}>
                        {t('deepseek_import.tag_search')}
                      </Text>
                    </View>
                  ) : null}
                  {session.imageCount > 0 ? (
                    <View
                      style={[
                        styles.tagChip,
                        { backgroundColor: colors.bgSurfaceNormal, borderRadius: tokens.radius.xs }
                      ]}
                    >
                      <Text style={[styles.tagText, { color: colors.textSecondary }]}>
                        {t('deepseek_import.tag_images', { count: session.imageCount })}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: sharedTokens.spacing.mdSnug,
    gap: sharedTokens.spacing.smPlus
  },
  headerBlock: {
    gap: sharedTokens.spacing.sm
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: sharedTokens.spacing.sm
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: sharedTokens.spacing.sm,
    paddingBottom: sharedTokens.spacing.smPlus
  },
  sectionTitle: {
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: '600'
  },
  countText: {
    fontSize: mobileTypography.caption.fontSize
  },
  selectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xs,
    paddingVertical: sharedTokens.spacing.xs
  },
  selectAllLabel: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '500'
  },
  list: {
    gap: 0
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: sharedTokens.spacing.smPlus,
    gap: sharedTokens.spacing.smPlus
  },
  sessionBody: {
    flex: 1,
    gap: sharedTokens.spacing.xs
  },
  sessionTitle: {
    fontSize: mobileTypography.body.fontSize,
    fontWeight: '500',
    lineHeight: 21
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: sharedTokens.spacing.xsPlus
  },
  metaText: {
    fontSize: mobileTypography.caption.fontSize
  },
  tagChip: {
    paddingHorizontal: sharedTokens.spacing.xsPlus,
    paddingVertical: sharedTokens.spacing.xxs
  },
  tagText: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '500'
  }
})
