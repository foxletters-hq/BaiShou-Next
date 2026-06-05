import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  scrollIndicatorStyle,
  useNativeTheme,
  useDialog,
  useNativeToast,
  Input,
  Pagination,
  Button,
  removeRecentPersonaId,
  renameRecentPersonaId,
  updateRecentPersonaIds
} from '@baishou/ui/native'
import { StackScreenLayout } from '../../components/StackScreenLayout'
import { getStackScreenChrome } from '../../components/stackScreenChrome'
import { useBaishou } from '../../providers/BaishouProvider'

const PAGE_SIZE = 10

interface PersonaInfo {
  id: string
  factsCount: number
}

export const IdentityCardManagementScreen: React.FC = () => {
  const { t } = useTranslation()
  const { colors, isDark, tokens } = useNativeTheme()
  const chrome = getStackScreenChrome(colors)
  const { services, dbReady } = useBaishou()
  const dialog = useDialog()
  const toast = useNativeToast()

  const [personas, setPersonas] = useState<PersonaInfo[]>([])
  const [activePersonaId, setActivePersonaId] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const loadPersonas = useCallback(async () => {
    if (!services || !dbReady) return
    try {
      const userProfile = (await services.settingsManager.get<any>('user_profile')) || {}
      const personasMap = userProfile.personas || {}
      const list: PersonaInfo[] = Object.keys(personasMap).map((id) => ({
        id,
        factsCount: Object.keys(personasMap[id]?.facts || {}).length
      }))
      setPersonas(list)
      setActivePersonaId(userProfile.activePersonaId || Object.keys(personasMap)[0] || '')
    } catch (e) {
      console.warn('Load personas failed', e)
    }
  }, [dbReady, services])

  useEffect(() => {
    void loadPersonas()
  }, [loadPersonas])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  const filteredPersonas = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return personas
    return personas.filter((p) => p.id.toLowerCase().includes(q))
  }, [personas, searchQuery])

  const totalPages = Math.max(1, Math.ceil(filteredPersonas.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  const pagedPersonas = useMemo(() => {
    if (filteredPersonas.length <= PAGE_SIZE) return filteredPersonas
    const start = (safePage - 1) * PAGE_SIZE
    return filteredPersonas.slice(start, start + PAGE_SIZE)
  }, [filteredPersonas, safePage])

  const showPagination = filteredPersonas.length > PAGE_SIZE

  const handleCreate = async () => {
    const name = await dialog.prompt(
      t('settings.identity_name_prompt', '请输入身份卡名称'),
      '',
      t('settings.new_identity_card', '新建身份卡')
    )
    if (!name?.trim()) return
    if (personas.some((p) => p.id === name.trim())) {
      toast.showError(t('settings.identity_name_exists', '该身份卡已存在'))
      return
    }
    try {
      const userProfile = (await services!.settingsManager.get<any>('user_profile')) || {}
      const personasMap = userProfile.personas || {}
      personasMap[name.trim()] = { id: name.trim(), facts: {} }
      const previousActiveId = userProfile.activePersonaId || activePersonaId
      userProfile.personas = personasMap
      userProfile.activePersonaId = name.trim()
      userProfile.recentPersonaIds = updateRecentPersonaIds(
        userProfile.recentPersonaIds,
        previousActiveId,
        name.trim()
      )
      await services!.settingsManager.set('user_profile', userProfile)
      await loadPersonas()
      toast.showSuccess(t('common.save_success'))
    } catch {
      toast.showError(t('common.errors.save_failed'))
    }
  }

  const handleSwitch = async (personaId: string) => {
    if (!services || activePersonaId === personaId) return
    try {
      const userProfile = (await services.settingsManager.get<any>('user_profile')) || {}
      const previousActiveId = userProfile.activePersonaId || activePersonaId
      userProfile.activePersonaId = personaId
      userProfile.recentPersonaIds = updateRecentPersonaIds(
        userProfile.recentPersonaIds,
        previousActiveId,
        personaId
      )
      await services.settingsManager.set('user_profile', userProfile)
      setActivePersonaId(personaId)
      toast.showSuccess(t('common.save_success'))
    } catch {
      toast.showError(t('common.errors.save_failed'))
    }
  }

  const handleRename = async (personaId: string) => {
    const newName = await dialog.prompt(
      t('settings.identity_name_prompt', '请输入身份卡名称'),
      personaId,
      t('settings.rename_identity_card', '重命名身份卡')
    )
    if (!newName?.trim() || newName.trim() === personaId) return
    if (personas.some((p) => p.id === newName.trim())) {
      toast.showError(t('settings.identity_name_exists', '该身份卡已存在'))
      return
    }
    try {
      const userProfile = (await services!.settingsManager.get<any>('user_profile')) || {}
      const personasMap = { ...userProfile.personas }
      personasMap[newName.trim()] = { ...personasMap[personaId], id: newName.trim() }
      delete personasMap[personaId]
      userProfile.personas = personasMap
      if (userProfile.activePersonaId === personaId) {
        userProfile.activePersonaId = newName.trim()
      }
      userProfile.recentPersonaIds = renameRecentPersonaId(
        userProfile.recentPersonaIds,
        personaId,
        newName.trim()
      )
      await services!.settingsManager.set('user_profile', userProfile)
      await loadPersonas()
      toast.showSuccess(t('common.save_success'))
    } catch {
      toast.showError(t('common.errors.save_failed'))
    }
  }

  const handleDelete = async (personaId: string) => {
    if (personas.length <= 1) {
      toast.showError(t('settings.identity_min_one', '至少保留一张身份卡！'))
      return
    }
    const confirmed = await dialog.confirm(
      t('settings.delete_identity_card', '确定删除身份卡: $personaId').replace('$personaId', personaId),
      { confirmText: t('common.confirm', '确定'), destructive: true }
    )
    if (!confirmed) return
    try {
      const userProfile = (await services!.settingsManager.get<any>('user_profile')) || {}
      const personasMap = { ...userProfile.personas }
      delete personasMap[personaId]
      userProfile.personas = personasMap
      if (userProfile.activePersonaId === personaId) {
        userProfile.activePersonaId = Object.keys(personasMap)[0]
      }
      userProfile.recentPersonaIds = removeRecentPersonaId(userProfile.recentPersonaIds, personaId)
      await services!.settingsManager.set('user_profile', userProfile)
      await loadPersonas()
      toast.showSuccess(t('common.save_success'))
    } catch {
      toast.showError(t('common.errors.save_failed'))
    }
  }

  return (
    <StackScreenLayout
      title={t('settings.manage_identity_cards', '管理身份卡')}
      {...chrome}
      contentStyle={styles.layoutContent}
    >
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
            <Input
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('settings.search_identity_placeholder', '搜索身份卡…')}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {filteredPersonas.length === 0 ? (
            <View style={styles.emptyRow}>
              <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                {t('settings.search_identity_empty', '没有匹配的身份卡')}
              </Text>
            </View>
          ) : null}

          {pagedPersonas.map((persona, index) => {
            const isActive = activePersonaId === persona.id
            const isLast = index === pagedPersonas.length - 1 && !showPagination
            return (
              <View
                key={persona.id}
                style={[
                  styles.row,
                  !isLast && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.borderSubtle
                  }
                ]}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                    {persona.id}
                  </Text>
                  <Text style={[styles.sub, { color: colors.textSecondary }]}>
                    {t('settings.identity_facts_count', '{{count}} 条身份条目', {
                      count: persona.factsCount
                    })}
                  </Text>
                </View>
                {isActive ? (
                  <Text style={[styles.badge, { color: colors.primary }]}>
                    {t('settings.identity_current', '当前')}
                  </Text>
                ) : (
                  <View style={styles.actions}>
                    <Pressable onPress={() => void handleSwitch(persona.id)}>
                      <Text style={[styles.action, { color: colors.primary }]}>
                        {t('workspace.switch', '切换')}
                      </Text>
                    </Pressable>
                  </View>
                )}
                <Pressable onPress={() => void handleRename(persona.id)}>
                  <Text style={[styles.action, { color: colors.textSecondary }]}>
                    {t('common.rename', '重命名')}
                  </Text>
                </Pressable>
                {personas.length > 1 && (
                  <Pressable onPress={() => void handleDelete(persona.id)}>
                    <Text style={[styles.action, { color: '#ef4444' }]}>
                      {t('workspace.delete', '删除')}
                    </Text>
                  </Pressable>
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
                  total: filteredPersonas.length,
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
        </View>

        <Button
          variant="outline"
          className="w-full"
          style={{ marginTop: 12 }}
          onPress={() => void handleCreate()}
        >
          + {t('settings.create_new_identity', '创建新身份卡')}
        </Button>
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
  emptyRow: {
    paddingHorizontal: 14,
    paddingVertical: 16,
    alignItems: 'center'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  }
})
