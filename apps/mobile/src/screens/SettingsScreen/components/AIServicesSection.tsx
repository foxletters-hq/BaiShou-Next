import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
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
  buildProviderListItems,
  effectiveProviderBaseUrl
} from '../utils/provider-settings'

export const AIServicesSection: React.FC = () => {
  const { t } = useTranslation()
  const router = useRouter()
  const { colors, tokens } = useNativeTheme()
  const { services, dbReady } = useBaishou()
  const toast = useNativeToast()

  const [savedProviders, setSavedProviders] = useState<AIProviderConfig[] | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', type: 'openai', baseUrl: '' })

  const providerItems = useMemo(
    () => buildProviderListItems(savedProviders ?? [], t),
    [savedProviders, t]
  )

  const [localProviderItems, setLocalProviderItems] = useState<typeof providerItems>([])

  useEffect(() => {
    if (savedProviders === null) return
    setLocalProviderItems(providerItems)
  }, [savedProviders, providerItems])

  const loadProviders = useCallback(async () => {
    if (!services || !dbReady) return
    try {
      const list = (await services.settingsManager.get<AIProviderConfig[]>('ai_providers')) || []
      setSavedProviders(list)
    } catch (e) {
      console.warn('Load providers failed', e)
      setSavedProviders([])
    }
  }, [services, dbReady])

  useEffect(() => {
    void loadProviders()
  }, [loadProviders])

  const handleReorderProviders = useCallback(
    async (orderedItems: typeof providerItems) => {
      setLocalProviderItems(orderedItems)
      if (!services || !dbReady) return
      const orderedIds = orderedItems.map((p) => p.id)
      const next = applyProviderOrderFromIds(savedProviders ?? [], orderedIds, orderedItems)
      try {
        await services.settingsManager.set('ai_providers', next)
        setSavedProviders(next)
      } catch (e) {
        console.warn('Reorder providers failed', e)
        setLocalProviderItems(providerItems)
      }
    },
    [services, dbReady, savedProviders, providerItems]
  )

  const handleOpenProvider = (id: string) => {
    router.push(`/settings/ai-provider/${encodeURIComponent(id)}`)
  }

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
      sortOrder: (savedProviders ?? []).length + 1,
      defaultDialogueModel: '',
      defaultNamingModel: ''
    }
    try {
      const next = [...(savedProviders ?? []), newProvider]
      await services.settingsManager.set('ai_providers', next)
      setSavedProviders(next)
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

  const footer = (
    <View style={styles.footer}>
      <CardLinkAction onPress={() => setShowAddModal(true)}>
        {t('settings.add_provider')}
      </CardLinkAction>
    </View>
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

  if (savedProviders === null) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <ProviderSortableList
        items={localProviderItems}
        onOpen={handleOpenProvider}
        onReorder={(items) => void handleReorderProviders(items)}
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
