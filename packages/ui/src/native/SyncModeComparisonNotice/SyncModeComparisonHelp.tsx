import React, { useState } from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Archive, Info, RefreshCw } from 'lucide-react-native'
import { Modal } from '../Modal/Modal'
import { useNativeTheme } from '../theme'
import { SettingsHelpIconButton } from '../Tooltip/SettingsHelpIconButton'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

export type SyncModeComparisonHelpProps = {
  context?: 'incremental' | 'fullBackup'
  size?: number
}

function SyncModeComparisonBody({ context }: { context?: 'incremental' | 'fullBackup' }) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()

  const renderCard = (mode: 'incremental' | 'fullBackup', titleKey: string, descKey: string) => {
    const active = context === mode
    const Icon = mode === 'incremental' ? RefreshCw : Archive
    return (
      <View
        key={mode}
        style={[
          styles.card,
          {
            borderColor: active ? colors.primary : colors.borderSubtle,
            backgroundColor: colors.bgSurface,
            borderRadius: tokens.radius.lg
          }
        ]}
      >
        <View style={styles.cardHeader}>
          <View
            style={[
              styles.cardIconBox,
              {
                backgroundColor: colors.primaryContainer
              }
            ]}
          >
            <Icon
              size={16}
              color={active ? colors.primary : colors.textSecondary}
              strokeWidth={2}
            />
          </View>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{t(titleKey)}</Text>
          {active && (
            <View style={[styles.activeBadge, { backgroundColor: colors.primaryContainer }]}>
              <Text style={[styles.activeBadgeText, { color: colors.primary }]}>
                {t('data_sync.sync_mode_current', '当前模块')}
              </Text>
            </View>
          )}
        </View>
        <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>{t(descKey)}</Text>
      </View>
    )
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
      {renderCard(
        'incremental',
        'data_sync.sync_mode_comparison_row_incremental',
        'data_sync.sync_mode_comparison_incremental_desc'
      )}
      {renderCard(
        'fullBackup',
        'data_sync.sync_mode_comparison_row_full',
        'data_sync.sync_mode_comparison_full_desc'
      )}
      <View
        style={[
          styles.hintCard,
          {
            backgroundColor: colors.primaryContainer,
            borderLeftColor: colors.primary,
            borderLeftWidth: 3,
            borderRadius: tokens.radius.md
          }
        ]}
      >
        <Info size={14} color={colors.primary} strokeWidth={2} style={styles.hintIcon} />
        <Text style={[styles.hint, { color: colors.textPrimary }]}>
          {t('data_sync.sync_mode_comparison_hint')}
        </Text>
      </View>
    </ScrollView>
  )
}

export const SyncModeComparisonHelp: React.FC<SyncModeComparisonHelpProps> = ({
  context,
  size: _size
}) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <>
      <SettingsHelpIconButton
        onPress={() => setOpen(true)}
        accessibilityLabel={t(
          'data_sync.sync_mode_comparison_help_aria',
          '增量同步与全量备份的区别'
        )}
      />
      <Modal
        visible={open}
        title={t('data_sync.sync_mode_comparison_title')}
        onClose={() => setOpen(false)}
      >
        <SyncModeComparisonBody context={context} />
      </Modal>
    </>
  )
}

/** @deprecated 使用 SyncModeComparisonHelp */
export const SyncModeComparisonNotice: React.FC<{
  context: 'incremental' | 'fullBackup'
}> = ({ context }) => <SyncModeComparisonHelp context={context} />

const styles = StyleSheet.create({
  scrollContent: {
    paddingVertical: sharedTokens.spacing.xsPlus,
    gap: sharedTokens.spacing.smPlus
  },
  card: {
    padding: sharedTokens.spacing.md,
    borderWidth: 1,
    gap: sharedTokens.spacing.sm
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.sm
  },
  cardIconBox: {
    width: 28,
    height: 28,
    borderRadius: sharedTokens.radius.xsPlus,
    alignItems: 'center',
    justifyContent: 'center'
  },
  cardTitle: {
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: '600',
    flex: 1
  },
  activeBadge: {
    paddingHorizontal: sharedTokens.spacing.xsPlus,
    paddingVertical: 2,
    borderRadius: sharedTokens.radius.xs
  },
  activeBadgeText: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '600'
  },
  cardDesc: {
    fontSize: mobileTypography.secondary.fontSize,
    lineHeight: 20
  },
  hintCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: sharedTokens.spacing.xsPlus,
    paddingHorizontal: sharedTokens.spacing.mdTight,
    paddingVertical: sharedTokens.spacing.smPlus
  },
  hintIcon: {
    marginTop: 2
  },
  hint: {
    flex: 1,
    fontSize: mobileTypography.caption.fontSize,
    lineHeight: 18
  }
})
