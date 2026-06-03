import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView
} from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useNativeTheme, useNativeToast } from '@baishou/ui/native'
import { PROVIDER_TYPES } from '../../../constants/known-ai-providers'
import { AIProviderConfig, ProviderType } from '@baishou/shared'
import { useBaishou } from '../../../providers/BaishouProvider'
import { ProviderSortableList } from './ProviderSortableList'
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

  const [savedProviders, setSavedProviders] = useState<AIProviderConfig[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', type: 'openai', baseUrl: '' })

  const providerItems = useMemo(
    () => buildProviderListItems(savedProviders, t),
    [savedProviders, t]
  )

  const [localProviderItems, setLocalProviderItems] = useState(providerItems)

  useEffect(() => {
    setLocalProviderItems(providerItems)
  }, [providerItems])

  const loadProviders = useCallback(async () => {
    if (!services || !dbReady) return
    try {
      const list =
        (await services.settingsManager.get<AIProviderConfig[]>('ai_providers')) || []
      setSavedProviders(list)
    } catch (e) {
      console.warn('Load providers failed', e)
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
      const next = applyProviderOrderFromIds(savedProviders, orderedIds, orderedItems)
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
    const baseUrl =
      addForm.baseUrl.trim() || effectiveProviderBaseUrl(id, addForm.type, '', '')
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
      sortOrder: savedProviders.length + 1,
      defaultDialogueModel: '',
      defaultNamingModel: ''
    }
    try {
      const next = [...savedProviders, newProvider]
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
      <TouchableOpacity
        style={[styles.addBtn, { backgroundColor: colors.primary }]}
        onPress={() => setShowAddModal(true)}
      >
        <Text style={{ color: colors.textOnPrimary, fontWeight: '600' }}>
          + {t('settings.add_provider')}
        </Text>
      </TouchableOpacity>
    </View>
  )

  return (
    <View style={styles.root}>
      <ProviderSortableList
        items={localProviderItems}
        onOpen={handleOpenProvider}
        onReorder={(items) => void handleReorderProviders(items)}
        ListFooterComponent={footer}
      />

      {showAddModal && (
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalCard, cardStyle]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {t('settings.add_provider')}
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.bgApp,
                  color: colors.textPrimary,
                  borderColor: colors.borderSubtle
                }
              ]}
              value={addForm.name}
              onChangeText={(name) => setAddForm((f) => ({ ...f, name }))}
              placeholder={t('settings.provider_name')}
              placeholderTextColor={colors.textTertiary}
            />
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              {t('settings.provider_type')}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeRow}>
              {PROVIDER_TYPES.slice(0, 12).map((type: string) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeChip,
                    {
                      borderColor:
                        addForm.type === type ? colors.primary : colors.borderSubtle,
                      backgroundColor:
                        addForm.type === type ? colors.primaryContainer : colors.bgApp
                    }
                  ]}
                  onPress={() => setAddForm((f) => ({ ...f, type }))}
                >
                  <Text
                    style={{
                      color: addForm.type === type ? colors.primary : colors.textSecondary,
                      fontSize: 12
                    }}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.bgApp,
                  color: colors.textPrimary,
                  borderColor: colors.borderSubtle
                }
              ]}
              value={addForm.baseUrl}
              onChangeText={(baseUrl) => setAddForm((f) => ({ ...f, baseUrl }))}
              placeholder="Base URL (optional)"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Text style={{ color: colors.textSecondary }}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => void handleAddCustomProvider()}>
                <Text style={{ color: colors.primary, fontWeight: '600' }}>
                  {t('common.confirm')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  footer: {
    marginTop: 8
  },
  addBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center'
  },
  fieldLabel: {
    fontSize: 12,
    marginTop: 4
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    padding: 24,
    zIndex: 20
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
  typeRow: {
    maxHeight: 40,
    marginBottom: 4
  },
  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 6
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 20,
    marginTop: 8
  }
})
