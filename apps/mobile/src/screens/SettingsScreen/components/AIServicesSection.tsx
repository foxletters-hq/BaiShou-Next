import React, { useCallback, useMemo, useRef, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { useTranslation } from 'react-i18next'
import {
  useNativeTheme,
  useNativeToast,
  Input,
  Button,
  CardLinkAction,
  Select
} from '@baishou/ui/native'
import { PROVIDER_TYPES } from '../../../constants/known-ai-providers'
import { AIProviderConfig, ProviderType } from '@baishou/shared'
import { useBaishou } from '../../../providers/BaishouProvider'
import { ProviderSortableList } from './ProviderSortableList'
import { ProviderBrandIcon } from './ProviderBrandIcon'
import {
  applyProviderOrderFromIds,
  buildAndCacheProviderListItems,
  effectiveProviderBaseUrl,
  peekProviderListItemsCache,
  peekProviderSettingsCache,
  writeProviderListItemsCache,
  writeProviderSettingsCache,
  type ProviderListItem
} from '../utils/provider-settings'

export const AIServicesSection: React.FC = () => {
  const { t } = useTranslation()
  const router = useRouter()
  const { colors, tokens } = useNativeTheme()
  const { services, dbReady } = useBaishou()
  const toast = useNativeToast()
  const loadingRef = useRef(false)

  const [listItems, setListItems] = useState<ProviderListItem[] | null>(
    () => peekProviderListItemsCache()
  )
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', type: 'openai', baseUrl: '' })

  const loadListFromDb = useCallback(async () => {
    if (!services || !dbReady || loadingRef.current) return
    loadingRef.current = true
    try {
      const list = (await services.settingsManager.get<AIProviderConfig[]>('ai_providers')) || []
      writeProviderSettingsCache(list)
      const items = buildAndCacheProviderListItems(list, t)
      setListItems(items)
    } catch (e) {
      console.warn('Load providers failed', e)
      setListItems([])
    } finally {
      loadingRef.current = false
    }
  }, [services, dbReady, t])

  const syncListOnFocus = useCallback(() => {
    const cachedItems = peekProviderListItemsCache()
    if (cachedItems) {
      setListItems((prev) => (prev === cachedItems ? prev : cachedItems))
      return
    }
    const full = peekProviderSettingsCache()
    if (full) {
      const items = buildAndCacheProviderListItems(full, t)
      setListItems(items)
      return
    }
    void loadListFromDb()
  }, [loadListFromDb, t])

  useFocusEffect(
    useCallback(() => {
      syncListOnFocus()
    }, [syncListOnFocus])
  )

  const handleReorderProviders = useCallback(
    (orderedItems: ProviderListItem[]) => {
      const withSortOrder = orderedItems.map((item, index) => ({
        ...item,
        sortOrder: index
      }))
      setListItems(withSortOrder)
      writeProviderListItemsCache(withSortOrder)

      if (!services || !dbReady) return

      const full = peekProviderSettingsCache() ?? []
      const next = applyProviderOrderFromIds(
        full,
        withSortOrder.map((p) => p.id),
        withSortOrder
      )
      writeProviderSettingsCache(next, { keepListCache: true })

      void services.settingsManager.setWithoutFlush('ai_providers', next).then(
        () => {
          services.settingsManager.scheduleFlushToDisk()
        },
        (e) => {
          console.warn('Reorder providers failed', e)
        }
      )
    },
    [services, dbReady]
  )

  const handleOpenProvider = useCallback(
    (id: string) => {
      router.push(`/settings/ai-provider/${encodeURIComponent(id)}`)
    },
    [router]
  )

  const handleAddCustomProvider = async () => {
    if (!services || !dbReady) return
    const name = addForm.name.trim()
    if (!name) {
      toast.showWarning(t('settings.provider_name'))
      return
    }
    const id = `custom_${Date.now()}`
    const baseUrl = addForm.baseUrl.trim() || effectiveProviderBaseUrl(id, addForm.type, '', '')
    const newProvider: AIProviderConfig = {
      id,
      name,
      type: addForm.type as ProviderType,
      apiKey: '',
      baseUrl,
      models: [],
      enabledModels: [],
      isEnabled: true,
      isSystem: false,
      sortOrder: (peekProviderSettingsCache() ?? []).length + 1,
      defaultDialogueModel: '',
      defaultNamingModel: ''
    }
    try {
      const next = [...(peekProviderSettingsCache() ?? []), newProvider]
      await services.settingsManager.set('ai_providers', next)
      writeProviderSettingsCache(next)
      const items = buildAndCacheProviderListItems(next, t)
      setListItems(items)
      setShowAddModal(false)
      setAddForm({ name: '', type: 'openai', baseUrl: '' })
      router.push(`/settings/ai-provider/${encodeURIComponent(id)}`)
    } catch {
      toast.showError(t('ai_config.save_failed'))
    }
  }

  const cardStyle = {
    backgroundColor: colors.bgSurface,
    borderRadius: tokens.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle
  }

  const footer = useMemo(
    () => (
      <View style={styles.footer}>
        <CardLinkAction onPress={() => setShowAddModal(true)}>
          {t('settings.add_provider')}
        </CardLinkAction>
      </View>
    ),
    [t]
  )

  const typeOptions = useMemo(
    () =>
      PROVIDER_TYPES.map((type) => ({
        label: type,
        value: type,
        leading: <ProviderBrandIcon providerId={type} size={18} />
      })),
    []
  )

  if (listItems === null) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <ProviderSortableList
        items={listItems}
        onOpen={handleOpenProvider}
        onReorder={handleReorderProviders}
        ListFooterComponent={footer}
      />

      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}
      >
        <TouchableOpacity
          style={[styles.modalOverlay, { backgroundColor: colors.overlay || 'rgba(0,0,0,0.4)' }]}
          activeOpacity={1}
          onPress={() => setShowAddModal(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.modalCard, cardStyle]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {t('settings.add_provider')}
            </Text>
            <Input
              value={addForm.name}
              onChangeText={(name) => setAddForm((f) => ({ ...f, name }))}
              placeholder={t('settings.provider_name')}
            />
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              {t('settings.provider_type')}
            </Text>
            <Select
              options={typeOptions}
              value={addForm.type}
              onValueChange={(type) => setAddForm((f) => ({ ...f, type }))}
            />
            <Input
              value={addForm.baseUrl}
              onChangeText={(baseUrl) => setAddForm((f) => ({ ...f, baseUrl }))}
              placeholder="Base URL (optional)"
              autoCapitalize="none"
            />
            <View style={styles.modalActions}>
              <Button variant="ghost" onPress={() => setShowAddModal(false)}>
                {t('common.cancel')}
              </Button>
              <Button variant="primary" onPress={() => void handleAddCustomProvider()}>
                {t('common.confirm')}
              </Button>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48
  },
  footer: {
    marginTop: 8,
    alignSelf: 'stretch',
    width: '100%'
  },
  fieldLabel: {
    fontSize: 12,
    marginTop: 4
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 24
  },
  modalCard: {
    padding: 20,
    gap: 10
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 20,
    marginTop: 8
  }
})
