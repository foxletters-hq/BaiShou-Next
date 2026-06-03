import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  scrollIndicatorStyle,
  useNativeTheme,
  useDialog,
  useNativeToast,
  Pagination,
  type VaultInfo
} from '@baishou/ui/native'
import { StackScreenLayout } from '../../components/StackScreenLayout'
import { getStackScreenChrome } from '../../components/stackScreenChrome'
import { useBaishou } from '../../providers/BaishouProvider'

const PAGE_SIZE = 10

function formatLastAccessed(value: Date | string | undefined, fallback: string): string {
  if (!value) return fallback
  try {
    const d = typeof value === 'string' ? new Date(value) : value
    return d.toLocaleString().split('.')[0].replace('T', ' ')
  } catch {
    return fallback
  }
}

function toTimestamp(value: Date | string | undefined): number {
  if (!value) return 0
  try {
    return (typeof value === 'string' ? new Date(value) : value).getTime()
  } catch {
    return 0
  }
}

export const WorkspaceManagementScreen: React.FC = () => {
  const { t } = useTranslation()
  const { colors, isDark, tokens } = useNativeTheme()
  const chrome = getStackScreenChrome(colors)
  const { services, dbReady } = useBaishou()
  const dialog = useDialog()
  const toast = useNativeToast()

  const [vaults, setVaults] = useState<VaultInfo[]>([])
  const [activeVault, setActiveVault] = useState<VaultInfo | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const loadVaults = useCallback(async () => {
    if (!services || !dbReady) return
    try {
      const allVaults = await services.vaultService.getAllVaults()
      const active = await services.vaultService.getActiveVault()
      setVaults(
        allVaults.map((v) => ({
          name: v.name,
          path: v.path,
          createdAt: v.createdAt,
          lastAccessedAt: v.lastAccessedAt
        }))
      )
      setActiveVault(
        active
          ? {
              name: active.name,
              path: active.path,
              createdAt: active.createdAt,
              lastAccessedAt: active.lastAccessedAt
            }
          : null
      )
    } catch (e) {
      console.warn('Load vaults failed', e)
    }
  }, [dbReady, services])

  useEffect(() => {
    void loadVaults()
  }, [loadVaults])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  const filteredVaults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const sorted = [...vaults].sort(
      (a, b) => toTimestamp(b.lastAccessedAt) - toTimestamp(a.lastAccessedAt)
    )
    if (!q) return sorted
    return sorted.filter((v) => v.name.toLowerCase().includes(q))
  }, [vaults, searchQuery])

  const totalPages = Math.max(1, Math.ceil(filteredVaults.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  const pagedVaults = useMemo(() => {
    if (filteredVaults.length <= PAGE_SIZE) return filteredVaults
    const start = (safePage - 1) * PAGE_SIZE
    return filteredVaults.slice(start, start + PAGE_SIZE)
  }, [filteredVaults, safePage])

  const showPagination = filteredVaults.length > PAGE_SIZE

  const handleCreate = async () => {
    const name = await dialog.prompt(t('workspace.new_name', '空间名称'), '')
    if (!name?.trim()) return
    try {
      await services!.vaultService.switchVault(name.trim())
      await loadVaults()
      toast.showSuccess(t('common.save_success'))
    } catch {
      toast.showError(t('workspace.create_failed', '创建失败'))
    }
  }

  const handleSwitch = async (name: string) => {
    if (!services || activeVault?.name === name) return
    try {
      await services.vaultService.switchVault(name)
      await loadVaults()
      toast.showSuccess(t('common.save_success'))
    } catch {
      toast.showError(t('common.errors.save_failed'))
    }
  }

  const handleDelete = async (vaultName: string) => {
    const input = await dialog.prompt(
      t('workspace.delete_confirm_input', '请输入工作区名称 "{{name}}" 以确认删除：', {
        name: vaultName
      })
    )
    if (input === vaultName) {
      try {
        await services!.vaultService.deleteVault(vaultName)
        await loadVaults()
        toast.showSuccess(t('common.save_success'))
      } catch {
        toast.showError(t('common.errors.save_failed'))
      }
    } else if (input !== null) {
      toast.showError(t('workspace.delete_name_mismatch', '名称不匹配，删除已取消。'))
    }
  }

  return (
    <StackScreenLayout title={t('workspace.manage', '管理工作区')} {...chrome} contentStyle={styles.layoutContent}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        indicatorStyle={scrollIndicatorStyle(isDark)}
      >
        <View
          style={[
            styles.card,
            { backgroundColor: colors.bgSurface, borderRadius: tokens.radius.lg }
          ]}
        >
          <View style={[styles.searchWrap, { borderBottomColor: colors.borderSubtle }]}>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('workspace.search_placeholder', '搜索工作空间…')}
              placeholderTextColor={colors.textTertiary}
              style={[
                styles.searchInput,
                {
                  color: colors.textPrimary,
                  backgroundColor: colors.bgSurfaceNormal,
                  borderColor: colors.borderSubtle
                }
              ]}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
          </View>

          {filteredVaults.length === 0 ? (
            <View style={styles.emptyRow}>
              <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                {t('workspace.search_empty', '没有匹配的工作空间')}
              </Text>
            </View>
          ) : null}

          {pagedVaults.map((vault, index) => {
            const isActive = activeVault?.name === vault.name
            const isLast = index === pagedVaults.length - 1 && !showPagination
            return (
              <View
                key={vault.name}
                style={[
                  styles.row,
                  !isLast && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.borderSubtle
                  }
                ]}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{vault.name}</Text>
                  <Text style={[styles.sub, { color: colors.textSecondary }]}>
                    {t('workspace.last_accessed', '上次访问: {{time}}', {
                      time: formatLastAccessed(vault.lastAccessedAt, t('common.unknown_time', '未知时间'))
                    })}
                  </Text>
                </View>
                {isActive ? (
                  <Text style={[styles.badge, { color: colors.primary }]}>
                    {t('workspace.current_short', '当前')}
                  </Text>
                ) : (
                  <View style={styles.actions}>
                    <Pressable onPress={() => void handleSwitch(vault.name)}>
                      <Text style={[styles.action, { color: colors.primary }]}>
                        {t('workspace.switch', '切换')}
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => void handleDelete(vault.name)}>
                      <Text style={[styles.action, { color: '#ef4444' }]}>
                        {t('workspace.delete', '删除')}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )
          })}

          {showPagination ? (
            <View
              style={[
                styles.paginationWrap,
                { borderTopColor: colors.borderSubtle, borderBottomColor: colors.borderSubtle }
              ]}
            >
              <Text style={[styles.pageInfo, { color: colors.textSecondary }]}>
                {t('workspace.page_info', '共 {{total}} 个 · 第 {{page}} / {{pages}} 页', {
                  total: filteredVaults.length,
                  page: safePage,
                  pages: totalPages
                })}
              </Text>
              <Pagination
                current={safePage}
                total={totalPages}
                onChange={setCurrentPage}
                siblingCount={1}
                showFirstLast
              />
            </View>
          ) : null}

          <Pressable
            onPress={() => void handleCreate()}
            style={({ pressed }) => [
              styles.createRow,
              {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.borderSubtle,
                opacity: pressed ? 0.7 : 1
              }
            ]}
          >
            <Text style={[styles.rowTitle, { color: colors.primary, flex: 1 }]}>
              {t('workspace.create_new', '创建新空间')}
            </Text>
            <Text style={{ color: colors.primary, fontSize: 20 }}>+</Text>
          </Pressable>
        </View>
      </ScrollView>
    </StackScreenLayout>
  )
}

const styles = StyleSheet.create({
  layoutContent: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    padding: 16,
    paddingBottom: 32
  },
  card: {
    overflow: 'hidden'
  },
  searchWrap: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15
  },
  emptyRow: {
    paddingHorizontal: 14,
    paddingVertical: 16,
    alignItems: 'center'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '500'
  },
  sub: {
    fontSize: 13,
    lineHeight: 18
  },
  badge: {
    fontSize: 14,
    fontWeight: '600'
  },
  actions: {
    flexDirection: 'row',
    gap: 12
  },
  action: {
    fontSize: 14,
    fontWeight: '600'
  },
  paginationWrap: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  pageInfo: {
    fontSize: 12
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12
  }
})
