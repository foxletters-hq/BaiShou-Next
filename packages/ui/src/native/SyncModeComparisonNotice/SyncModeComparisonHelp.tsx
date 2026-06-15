import React, { useState } from 'react'
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { Modal } from '../Modal/Modal'
import { useNativeTheme } from '../theme'

export type SyncModeComparisonHelpProps = {
  context?: 'incremental' | 'fullBackup'
  size?: number
}

function SyncModeComparisonBody({ context }: { context?: 'incremental' | 'fullBackup' }) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()

  const renderCard = (mode: 'incremental' | 'fullBackup', titleKey: string, descKey: string) => {
    const active = context === mode
    return (
      <View
        key={mode}
        style={[
          styles.card,
          {
            borderColor: active ? colors.primary : colors.borderSubtle,
            backgroundColor: colors.bgSurface,
            borderRadius: tokens.radius.md
          }
        ]}
      >
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{t(titleKey)}</Text>
        <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>{t(descKey)}</Text>
      </View>
    )
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
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
      <Text style={[styles.hint, { color: colors.textTertiary }]}>
        {t('data_sync.sync_mode_comparison_hint')}
      </Text>
    </ScrollView>
  )
}

export const SyncModeComparisonHelp: React.FC<SyncModeComparisonHelpProps> = ({
  context,
  size = 18
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t(
          'data_sync.sync_mode_comparison_help_aria',
          '增量同步与全量备份的区别'
        )}
        style={styles.helpBtn}
      >
        <MaterialIcons name="help-outline" size={size} color={colors.textTertiary} />
      </Pressable>
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
  helpBtn: {
    padding: 2
  },
  card: {
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
    gap: 4
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600'
  },
  cardDesc: {
    fontSize: 13,
    lineHeight: 19
  },
  hint: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4
  }
})
