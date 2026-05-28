import React, { useState, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Dimensions,
  TextInput
} from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useNativeTheme } from '@baishou/ui/native'
import { ProviderType, type AiProviderModel } from '@baishou/shared'
import { CompressionChart } from '../components/CompressionChart'
import { ONBOARDING_STORAGE_KEY } from '../constants/storage'
import { useBaishou } from '../providers/BaishouProvider'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

interface OnboardingPage {
  id: number
  title: string
  subtitle: string
  content?: React.ReactNode
  isAiSetup?: boolean
}

const GEMINI_PROVIDER_ID = 'gemini_default'

export const OnboardingScreen = () => {
  const router = useRouter()
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const { services, dbReady } = useBaishou()
  const [currentPage, setCurrentPage] = useState(0)
  const [apiKey, setApiKey] = useState('')
  const scrollViewRef = useRef<ScrollView>(null)

  const saveApiKeyToProviders = async (key: string) => {
    if (!services?.settingsManager || !dbReady) return

    const existing = (await services.settingsManager.get<AiProviderModel[]>('ai_providers')) || []
    const providers: AiProviderModel[] = existing.length > 0 ? [...existing] : []

    const geminiIndex = providers.findIndex((p) => p.id === GEMINI_PROVIDER_ID)
    const geminiTemplate = providers[geminiIndex]

    const updatedGemini: AiProviderModel = {
      ...(geminiTemplate ?? {
        id: GEMINI_PROVIDER_ID,
        name: 'Google Gemini',
        type: ProviderType.Gemini,
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
        defaultDialogueModel: 'gemini-2.5-flash',
        defaultNamingModel: 'gemini-2.5-flash',
        enabledModels: ['gemini-2.5-pro', 'gemini-2.5-flash'],
        isSystem: true,
        sortOrder: 2
      }),
      apiKey: key,
      isEnabled: true
    }

    if (geminiIndex >= 0) {
      providers[geminiIndex] = updatedGemini
    } else {
      providers.push(updatedGemini)
    }

    await services.settingsManager.set('ai_providers', providers)

    const globalModels =
      (await services.settingsManager.get<Record<string, string>>('global_models')) || {}
    if (!globalModels.globalDialogueProviderId) {
      globalModels.globalDialogueProviderId = GEMINI_PROVIDER_ID
      globalModels.globalDialogueModelId =
        globalModels.globalDialogueModelId ||
        updatedGemini.defaultDialogueModel ||
        'gemini-2.5-flash'
      await services.settingsManager.set('global_models', globalModels)
    }
  }

  const finishOnboarding = async (destination: '/(tabs)/agent' | '/(tabs)/settings') => {
    await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, '1')
    if (apiKey.trim()) {
      try {
        await saveApiKeyToProviders(apiKey.trim())
      } catch (e) {
        console.warn('[Onboarding] save api key to settings failed', e)
        await AsyncStorage.setItem('@baishou/mobile_onboarding_api_key', apiKey.trim())
      }
    }
    if (destination === '/(tabs)/settings') {
      router.replace({
        pathname: '/(tabs)/settings',
        params: { tab: 'ai-services' }
      })
    } else {
      router.replace('/(tabs)/agent')
    }
  }

  const pages: OnboardingPage[] = [
    {
      id: 1,
      title: '欢迎来到',
      subtitle: 'BaiShou Next',
      content: (
        <View style={styles.heroContainer}>
          <View style={[styles.logoBox, { backgroundColor: colors.primary + '20' }]}>
            <Text style={styles.logoText}>✨</Text>
          </View>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            强大的伙伴网络系统，为你提供智能且高效的移动端响应。
          </Text>
        </View>
      )
    },
    {
      id: 2,
      title: '压缩算法',
      subtitle: '高效存储',
      content: (
        <View style={styles.chartContainer}>
          <Text style={[styles.chartDescription, { color: colors.textSecondary }]}>
            通过多级压缩算法，将日记数据从日级到年级逐层压缩，节省存储空间的同时保留关键信息。
          </Text>
          <CompressionChart delay={300} />
        </View>
      )
    },
    {
      id: 3,
      title: 'AI 伙伴',
      subtitle: '智能对话',
      content: (
        <View style={styles.featureContainer}>
          <View style={[styles.featureItem, { backgroundColor: colors.bgSurfaceHighest }]}>
            <Text style={styles.featureIcon}>🤖</Text>
            <Text style={[styles.featureTitle, { color: colors.textPrimary }]}>多模型支持</Text>
            <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>
              支持 OpenAI、Claude、Gemini 等多种 AI 模型
            </Text>
          </View>
          <View style={[styles.featureItem, { backgroundColor: colors.bgSurfaceHighest }]}>
            <Text style={styles.featureIcon}>💬</Text>
            <Text style={[styles.featureTitle, { color: colors.textPrimary }]}>流式对话</Text>
            <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>
              实时流式输出，打字机效果
            </Text>
          </View>
          <View style={[styles.featureItem, { backgroundColor: colors.bgSurfaceHighest }]}>
            <Text style={styles.featureIcon}>🔧</Text>
            <Text style={[styles.featureTitle, { color: colors.textPrimary }]}>工具调用</Text>
            <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>
              支持搜索、记忆召回等工具
            </Text>
          </View>
        </View>
      )
    },
    {
      id: 4,
      title: t('onboarding.ai_setup_title', '配置你的 AI 智慧'),
      subtitle: t('onboarding.api_guide_title', '获取 API Key'),
      isAiSetup: true,
      content: (
        <View style={styles.aiSetupContainer}>
          <Text style={[styles.chartDescription, { color: colors.textSecondary }]}>
            {t(
              'onboarding.ai_setup_desc',
              '白守本身不存储你的 AI 密钥。请配置标准的 OpenAI 兼容协议，开启你们的灵魂对话。'
            )}
          </Text>
          <Text style={[styles.apiKeyLabel, { color: colors.textPrimary }]}>
            {t('onboarding.api_key_label', 'Gemini API Key')}
          </Text>
          <TextInput
            style={[
              styles.apiKeyInput,
              {
                color: colors.textPrimary,
                borderColor: colors.borderSubtle,
                backgroundColor: colors.bgSurfaceHighest
              }
            ]}
            value={apiKey}
            onChangeText={setApiKey}
            placeholder={t('onboarding.api_key_hint', '可选，稍后在设置中配置')}
            placeholderTextColor={colors.textTertiary}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.primary }]}
            onPress={() => finishOnboarding('/(tabs)/settings')}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
              {t('onboarding.go_to_config', '去配置')}
            </Text>
          </TouchableOpacity>
        </View>
      )
    },
    {
      id: 5,
      title: '数据安全',
      subtitle: '本地优先',
      content: (
        <View style={styles.securityContainer}>
          <View style={[styles.securityItem, { backgroundColor: colors.bgSurfaceHighest }]}>
            <Text style={styles.securityIcon}>🔒</Text>
            <Text style={[styles.securityTitle, { color: colors.textPrimary }]}>本地存储</Text>
            <Text style={[styles.securityDesc, { color: colors.textSecondary }]}>
              所有数据存储在本地 SQLite 数据库
            </Text>
          </View>
          <View style={[styles.securityItem, { backgroundColor: colors.bgSurfaceHighest }]}>
            <Text style={styles.securityIcon}>📡</Text>
            <Text style={[styles.securityTitle, { color: colors.textPrimary }]}>局域网同步</Text>
            <Text style={[styles.securityDesc, { color: colors.textSecondary }]}>
              支持局域网设备间同步
            </Text>
          </View>
          <View style={[styles.securityItem, { backgroundColor: colors.bgSurfaceHighest }]}>
            <Text style={styles.securityIcon}>☁️</Text>
            <Text style={[styles.securityTitle, { color: colors.textPrimary }]}>云备份</Text>
            <Text style={[styles.securityDesc, { color: colors.textSecondary }]}>
              支持 WebDAV/S3 云备份
            </Text>
          </View>
        </View>
      )
    }
  ]

  const handleNext = () => {
    if (currentPage < pages.length - 1) {
      const nextPage = currentPage + 1
      setCurrentPage(nextPage)
      scrollViewRef.current?.scrollTo({
        x: nextPage * SCREEN_WIDTH,
        animated: true
      })
    } else {
      finishOnboarding('/(tabs)/agent')
    }
  }

  const handleSkip = () => {
    finishOnboarding('/(tabs)/agent')
  }

  const handleScroll = (event: any) => {
    const contentOffset = event.nativeEvent.contentOffset
    const page = Math.round(contentOffset.x / SCREEN_WIDTH)
    if (page !== currentPage) {
      setCurrentPage(page)
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgApp }]}>
      {/* 跳过按钮 */}
      {currentPage < pages.length - 1 && (
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={[styles.skipText, { color: colors.textSecondary }]}>跳过</Text>
        </TouchableOpacity>
      )}

      {/* 页面指示器 */}
      <View style={styles.indicatorContainer}>
        {pages.map((_, index) => (
          <View
            key={index}
            style={[
              styles.indicator,
              {
                backgroundColor: index === currentPage ? colors.primary : colors.bgSurfaceHighest,
                width: index === currentPage ? 24 : 8
              }
            ]}
          />
        ))}
      </View>

      {/* 内容区域 */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
      >
        {pages.map((page, index) => (
          <View key={page.id} style={styles.page}>
            <View style={styles.pageContent}>
              <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>{page.title}</Text>
              <Text style={[styles.pageSubtitle, { color: colors.primary }]}>{page.subtitle}</Text>
              {page.content}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* 底部按钮 */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextButton, { backgroundColor: colors.primary }]}
          onPress={handleNext}
        >
          <Text style={[styles.nextButtonText, { color: colors.textOnPrimary }]}>
            {currentPage === pages.length - 1 ? '开始体验' : '下一步'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  skipButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 8
  },
  skipText: {
    fontSize: 16,
    fontWeight: '500'
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 20,
    gap: 8
  },
  indicator: {
    height: 8,
    borderRadius: 4
  },
  scrollView: {
    flex: 1
  },
  page: {
    width: SCREEN_WIDTH,
    flex: 1
  },
  pageContent: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'center'
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8
  },
  pageSubtitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 32
  },
  heroContainer: {
    alignItems: 'center'
  },
  logoBox: {
    width: 100,
    height: 100,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24
  },
  logoText: {
    fontSize: 50
  },
  heroSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24
  },
  chartContainer: {
    alignItems: 'center'
  },
  chartDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24
  },
  featureContainer: {
    gap: 16
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 16
  },
  featureIcon: {
    fontSize: 32
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4
  },
  featureDesc: {
    fontSize: 14,
    flex: 1
  },
  securityContainer: {
    gap: 16
  },
  securityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 16
  },
  securityIcon: {
    fontSize: 32
  },
  securityTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4
  },
  securityDesc: {
    fontSize: 14,
    flex: 1
  },
  footer: {
    padding: 24
  },
  nextButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center'
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: 'bold'
  },
  aiSetupContainer: {
    gap: 16
  },
  apiKeyLabel: {
    fontSize: 15,
    fontWeight: '600'
  },
  apiKeyInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16
  },
  secondaryButton: {
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center'
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600'
  }
})
