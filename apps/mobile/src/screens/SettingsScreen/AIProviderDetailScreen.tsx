import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { scrollIndicatorStyle, useNativeTheme } from '@baishou/ui/native'
import { AIProviderConfig } from '@baishou/shared'
import { StackScreenLayout } from '../../components/StackScreenLayout'
import { getStackScreenChrome } from '../../components/stackScreenChrome'
import { useBaishou } from '../../providers/BaishouProvider'
import { AIProviderConfigForm } from './components/AIProviderConfigForm'
import { buildProviderListItems } from './utils/provider-settings'

export interface AIProviderDetailScreenProps {
  providerId: string
}

export const AIProviderDetailScreen: React.FC<AIProviderDetailScreenProps> = ({ providerId }) => {
  const { t } = useTranslation()
  const router = useRouter()
  const { colors, isDark } = useNativeTheme()
  const chrome = getStackScreenChrome(colors)
  const { services, dbReady } = useBaishou()
  const [savedProviders, setSavedProviders] = useState<AIProviderConfig[]>([])

  const loadProviders = useCallback(async () => {
    if (!services || !dbReady) return
    const list = (await services.settingsManager.get<AIProviderConfig[]>('ai_providers')) || []
    setSavedProviders(list)
  }, [services, dbReady])

  useEffect(() => {
    void loadProviders()
  }, [loadProviders])

  const providerItems = useMemo(
    () => buildProviderListItems(savedProviders, t),
    [savedProviders, t]
  )
  const providerMeta = providerItems.find((p) => p.id === providerId)
  const activeConfig = savedProviders.find((p) => p.id === providerId)

  const title = activeConfig?.name || providerMeta?.name || providerId

  useEffect(() => {
    if (dbReady && savedProviders.length > 0 && !savedProviders.some((p) => p.id === providerId)) {
      router.back()
    }
  }, [dbReady, savedProviders, providerId, router])

  return (
    <StackScreenLayout title={title} {...chrome} contentStyle={styles.layoutContent}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        indicatorStyle={scrollIndicatorStyle(isDark)}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        <AIProviderConfigForm
          providerId={providerId}
          providerMeta={providerMeta}
          savedProviders={savedProviders}
          onProvidersChange={(next) => {
            setSavedProviders(next)
            if (!next.some((p) => p.id === providerId)) {
              router.back()
            }
          }}
        />
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
  }
})
