import React from 'react'
import { View, Text, Pressable, Modal, SafeAreaView, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'

export interface ChatCostDialogProps {
  visible: boolean
  onClose: () => void
  totalTokens: number
  totalCost: number
  sessionTokens: number
  sessionCost: number
}

export const ChatCostDialog: React.FC<ChatCostDialogProps> = ({
  visible,
  onClose,
  totalTokens,
  totalCost,
  sessionTokens,
  sessionCost
}) => {
  const { t } = useTranslation()
  const { colors, tokens, maxModalWidth } = useNativeTheme()

  if (!visible) return null

  const formatTokens = (tokens: number) => {
    if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
    if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`
    return tokens.toString()
  }

  const formatCost = (cost: number) => `$${cost.toFixed(4)}`

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={[styles.overlay, { backgroundColor: colors.overlay }]}
        onPress={onClose}
      >
        <SafeAreaView style={styles.safeArea}>
          <Pressable
            style={[
              styles.modalContent,
              {
                width: '90%',
                maxWidth: maxModalWidth,
                backgroundColor: colors.bgSurface,
                borderRadius: tokens.radius.xl,
                padding: tokens.spacing.lg
              }
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.header}>
              <View style={[styles.headerTitleRow, { gap: tokens.spacing.sm }]}>
                <Text style={styles.headerIcon}>💰</Text>
                <Text style={[styles.headerText, { color: colors.textPrimary }]}>
                  {t('cost.dialogTitle', '费用明细')}
                </Text>
              </View>
              <Pressable onPress={onClose}>
                <Text style={[styles.closeIcon, { color: colors.textSecondary }]}>×</Text>
              </Pressable>
            </View>

            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.bgSurfaceNormal,
                  borderRadius: tokens.radius.md,
                  padding: tokens.spacing.md
                }
              ]}
            >
              {/* Session Stats */}
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                {t('cost.currentSession', '本次会话')}
              </Text>
              <View style={styles.row}>
                <Text style={[styles.label, { color: colors.textTertiary }]}>
                  {t('cost.tokens', 'Token 用量')}
                </Text>
                <Text style={[styles.value, { color: colors.textPrimary }]}>
                  {formatTokens(sessionTokens)}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={[styles.label, { color: colors.textTertiary }]}>
                  {t('cost.cost', '费用')}
                </Text>
                <Text style={[styles.value, { color: colors.primary, fontWeight: '700' }]}>
                  {formatCost(sessionCost)}
                </Text>
              </View>

              <View
                style={[styles.divider, { backgroundColor: colors.borderSubtle }]}
              />

              {/* Total Stats */}
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                {t('cost.total', '累计统计')}
              </Text>
              <View style={styles.row}>
                <Text style={[styles.label, { color: colors.textTertiary }]}>
                  {t('cost.tokens', 'Token 用量')}
                </Text>
                <Text style={[styles.value, { color: colors.textPrimary }]}>
                  {formatTokens(totalTokens)}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={[styles.label, { color: colors.textTertiary }]}>
                  {t('cost.cost', '费用')}
                </Text>
                <Text style={[styles.value, { color: colors.primary, fontWeight: '700' }]}>
                  {formatCost(totalCost)}
                </Text>
              </View>
            </View>
          </Pressable>
        </SafeAreaView>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  safeArea: {
    width: '100%',
    alignItems: 'center'
  },
  modalContent: {},
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  headerIcon: {
    fontSize: 20
  },
  headerText: {
    fontSize: 18,
    fontWeight: '600'
  },
  closeIcon: {
    fontSize: 24
  },
  card: {},
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6
  },
  label: {
    fontSize: 15
  },
  value: {
    fontSize: 15,
    fontWeight: '600'
  },
  divider: {
    height: 1,
    marginVertical: 14
  }
})
