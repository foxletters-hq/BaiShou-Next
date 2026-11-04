import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native'
import {
  FloatingModal,
  Button,
  Checkbox,
  Switch,
  AssistantAvatar,
  AssistantKindBadge,
  useNativeTheme,
  useNativeToast
} from '@baishou/ui/native'
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'
import { useTranslation } from 'react-i18next'
import { useBaishou } from '../providers/BaishouProvider'
import type { ImportableAssistantItem } from '@baishou/core-mobile'
import { MessageSquare, Sparkles } from 'lucide-react-native'

export interface AssistantImportModalProps {
  visible: boolean
  onClose: () => void
  onImportSuccess?: () => void
}

export const AssistantImportModal: React.FC<AssistantImportModalProps> = ({
  visible,
  onClose,
  onImportSuccess
}) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const toast = useNativeToast()
  const { services, dbReady } = useBaishou()

  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [items, setItems] = useState<ImportableAssistantItem[]>([])
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [includeSessions, setIncludeSessions] = useState(true)

  const activeVault = useMemo(() => {
    return services?.vaultService.getActiveVault() ?? null
  }, [services])

  const allVaults = useMemo(() => {
    return (
      services?.vaultService.getAllVaults().map((v) => ({
        id: v.id,
        name: v.name
      })) ?? []
    )
  }, [services])

  const loadCandidates = useCallback(async () => {
    if (!services || !dbReady) return
    setLoading(true)
    try {
      const candidates = await services.assistantManager.listImportableAssistantsAcrossVaults({
        currentVaultId: activeVault?.id,
        allVaults
      })
      setItems(candidates)
      // 默认全选
      setSelectedKeys(new Set(candidates.map((c) => `${c.sourceVaultId}__${c.id}`)))
    } catch (e) {
      console.error('[AssistantImportModal] 加载候选伙伴失败:', e)
      toast.showError(t('common.load_failed', '加载失败'))
    } finally {
      setLoading(false)
    }
  }, [activeVault?.id, allVaults, dbReady, services, t, toast])

  useEffect(() => {
    if (visible) {
      void loadCandidates()
    } else {
      setSelectedKeys(new Set())
    }
  }, [visible, loadCandidates])

  const toggleSelect = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    if (selectedKeys.size === items.length) {
      setSelectedKeys(new Set())
    } else {
      setSelectedKeys(new Set(items.map((c) => `${c.sourceVaultId}__${c.id}`)))
    }
  }, [items, selectedKeys.size])

  const handleImport = useCallback(async () => {
    if (!services || selectedKeys.size === 0) return
    setImporting(true)

    const selectedItems = items
      .filter((item) => selectedKeys.has(`${item.sourceVaultId}__${item.id}`))
      .map((item) => ({
        assistantId: item.id,
        sourceVaultId: item.sourceVaultId,
        sourceVaultName: item.sourceVaultName
      }))

    try {
      const result = await services.assistantManager.importAssistantsFromOtherVaults({
        targetVaultId: activeVault?.id,
        targetVaultName: activeVault?.name,
        selected: selectedItems,
        includeSessions,
        sessionRepo: services.sessionRepo
      })

      if (includeSessions && result.importedSessionsCount > 0) {
        toast.showSuccess(
          t('agent.assistant.import_success_with_sessions', {
            assistants: result.importedAssistantsCount,
            sessions: result.importedSessionsCount,
            defaultValue: `成功迁入 ${result.importedAssistantsCount} 位伙伴，并迁移了 ${result.importedSessionsCount} 条历史会话`
          })
        )
      } else {
        toast.showSuccess(
          t('agent.assistant.import_success', {
            assistants: result.importedAssistantsCount,
            defaultValue: `成功迁入 ${result.importedAssistantsCount} 位伙伴`
          })
        )
      }

      onImportSuccess?.()
      onClose()
    } catch (e) {
      console.error('[AssistantImportModal] 迁入伙伴失败:', e)
      toast.showError(t('common.operate_failed', '操作失败，请重试'))
    } finally {
      setImporting(false)
    }
  }, [
    activeVault?.id,
    activeVault?.name,
    includeSessions,
    items,
    onClose,
    onImportSuccess,
    selectedKeys,
    services,
    t,
    toast
  ])

  // 按源小窝分组
  const groupedItems = useMemo(() => {
    const groups = new Map<string, ImportableAssistantItem[]>()
    for (const item of items) {
      const groupName = item.sourceVaultName || item.sourceVaultId
      const list = groups.get(groupName) ?? []
      list.push(item)
      groups.set(groupName, list)
    }
    return Array.from(groups.entries())
  }, [items])

  const allSelected = items.length > 0 && selectedKeys.size === items.length
  const isIndeterminate = selectedKeys.size > 0 && selectedKeys.size < items.length

  return (
    <FloatingModal visible={visible} onClose={onClose} maxWidth={440}>
      <View style={styles.container}>
        {/* 头部 */}
        <View style={[styles.header, { borderBottomColor: colors.borderSubtle }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {t('agent.assistant.import_modal_title', '迁入其他小窝伙伴')}
          </Text>
          {items.length > 0 && (
            <TouchableOpacity onPress={handleSelectAll} style={styles.selectAllBtn} hitSlop={8}>
              <Checkbox
                selected={allSelected}
                indeterminate={isIndeterminate}
                onPress={handleSelectAll}
              />
              <Text style={[styles.selectAllText, { color: colors.primary }]}>
                {allSelected
                  ? t('agent.assistant.import_deselect_all', '取消全选')
                  : t('agent.assistant.import_select_all', '全选')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 内容区 */}
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              {t('common.loading', '加载中...')}
            </Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.centered}>
            <Sparkles size={40} color={colors.primary} style={{ opacity: 0.6 }} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {t('agent.assistant.import_modal_empty', '当前没有在其他小窝中发现可迁入的心智伙伴')}
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollList}
            contentContainerStyle={styles.scrollListContent}
            showsVerticalScrollIndicator={false}
          >
            {groupedItems.map(([vaultName, groupList]) => (
              <View key={vaultName} style={styles.groupSection}>
                <View style={styles.groupHeader}>
                  <Text style={[styles.groupTitle, { color: colors.textSecondary }]}>
                    {t('agent.assistant.import_source_vault', {
                      vault: vaultName,
                      defaultValue: `源小窝：${vaultName}`
                    })}
                  </Text>
                </View>

                {groupList.map((item) => {
                  const key = `${item.sourceVaultId}__${item.id}`
                  const isChecked = selectedKeys.has(key)

                  return (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.assistantRow,
                        {
                          backgroundColor: isChecked ? colors.bgSurfaceRaised : colors.bgSurface,
                          borderColor: isChecked ? colors.primary : colors.borderSubtle,
                          borderRadius: tokens.radius.md
                        }
                      ]}
                      onPress={() => toggleSelect(key)}
                      activeOpacity={0.7}
                    >
                      <Checkbox selected={isChecked} onPress={() => toggleSelect(key)} />
                      <AssistantAvatar
                        emoji={item.emoji}
                        avatarPath={item.avatarPath ?? undefined}
                        size={36}
                      />
                      <View style={styles.metaCol}>
                        <View style={styles.nameRow}>
                          <Text
                            style={[styles.assistantName, { color: colors.textPrimary }]}
                            numberOfLines={1}
                          >
                            {item.name}
                          </Text>
                          <AssistantKindBadge kind={item.assistantKind ?? undefined} compact />
                        </View>
                        {item.sessionCount > 0 ? (
                          <View style={styles.sessionCountRow}>
                            <MessageSquare size={12} color={colors.textSecondary} />
                            <Text
                              style={[styles.sessionCountText, { color: colors.textSecondary }]}
                            >
                              {t('agent.assistant.import_sessions_count', {
                                count: item.sessionCount,
                                defaultValue: `${item.sessionCount} 条对话`
                              })}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  )
                })}
              </View>
            ))}
          </ScrollView>
        )}

        {/* 底部配置与操作区 */}
        {items.length > 0 && (
          <View style={[styles.footer, { borderTopColor: colors.borderSubtle }]}>
            <View style={styles.switchRow}>
              <View style={styles.switchMeta}>
                <Text style={[styles.switchLabel, { color: colors.textPrimary }]}>
                  {t('agent.assistant.import_include_sessions', '同时迁移该伙伴的历史对话记录')}
                </Text>
                <Text style={[styles.switchDesc, { color: colors.textSecondary }]}>
                  {t(
                    'agent.assistant.import_include_sessions_desc',
                    '将该伙伴在源小窝中的全部历史会话安全拷贝至当前小窝'
                  )}
                </Text>
              </View>
              <Switch value={includeSessions} onValueChange={setIncludeSessions} />
            </View>

            <View style={styles.btnRow}>
              <Button variant="outlined" onPress={onClose} disabled={importing}>
                {t('common.cancel', '取消')}
              </Button>
              <Button
                variant="primary"
                onPress={handleImport}
                disabled={selectedKeys.size === 0 || importing}
                isLoading={importing}
              >
                {t('agent.assistant.import_confirm_count', {
                  count: selectedKeys.size,
                  defaultValue: `确认迁入 (${selectedKeys.size})`
                })}
              </Button>
            </View>
          </View>
        )}
      </View>
    </FloatingModal>
  )
}

const styles = StyleSheet.create({
  container: {
    maxHeight: 560
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sharedTokens.spacing.mdPlus,
    paddingVertical: sharedTokens.spacing.md,
    borderBottomWidth: 1
  },
  title: {
    fontSize: mobileTypography.title.fontSize,
    fontWeight: '600'
  },
  selectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xs,
    paddingHorizontal: sharedTokens.spacing.xsPlus,
    paddingVertical: sharedTokens.spacing.xs
  },
  selectAllText: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '500'
  },
  centered: {
    padding: sharedTokens.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: sharedTokens.spacing.sm
  },
  loadingText: {
    fontSize: mobileTypography.body.fontSize
  },
  emptyText: {
    fontSize: mobileTypography.body.fontSize,
    textAlign: 'center',
    lineHeight: 20
  },
  scrollList: {
    maxHeight: 320
  },
  scrollListContent: {
    padding: sharedTokens.spacing.mdPlus,
    gap: sharedTokens.spacing.md
  },
  groupSection: {
    gap: sharedTokens.spacing.sm
  },
  groupHeader: {
    paddingHorizontal: sharedTokens.spacing.xs
  },
  groupTitle: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '600'
  },
  assistantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: sharedTokens.spacing.smPlus,
    gap: sharedTokens.spacing.smPlus,
    borderWidth: 1
  },
  metaCol: {
    flex: 1,
    gap: sharedTokens.spacing.xxs
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xsPlus
  },
  assistantName: {
    fontSize: mobileTypography.body.fontSize,
    fontWeight: '500'
  },
  sessionCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xxs
  },
  sessionCountText: {
    fontSize: mobileTypography.caption.fontSize
  },
  footer: {
    padding: sharedTokens.spacing.mdPlus,
    borderTopWidth: 1,
    gap: sharedTokens.spacing.md
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sharedTokens.spacing.md
  },
  switchMeta: {
    flex: 1
  },
  switchLabel: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '500'
  },
  switchDesc: {
    fontSize: mobileTypography.caption.fontSize,
    marginTop: 2
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: sharedTokens.spacing.smPlus
  }
})
