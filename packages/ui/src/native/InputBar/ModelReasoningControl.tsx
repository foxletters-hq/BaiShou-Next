import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type LayoutRectangle
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Check, ChevronUp, Settings, Sparkles } from 'lucide-react-native'
import { formatReasoningEffortLabel, type ReasoningEffortSetting } from '@baishou/shared'
import { useNativeTheme } from '../theme'
import { ProviderBrandIcon } from '../ProviderBrandIcon'
import { ModelVisionBadge } from '../../shared/ModelVisionBadge'
import { computeModelReasoningPanelLayout } from './model-reasoning-panel-layout.util'

export interface ModelReasoningProvider {
  id: string
  name: string
  type?: string
  models?: string[]
  enabledModels?: string[]
}

export interface ModelReasoningControlProps {
  currentProviderId?: string | null
  currentModelId?: string | null
  currentProviderType?: string | null
  displayModelName?: string | null
  providers?: ModelReasoningProvider[]
  onSelectModel?: (providerId: string, modelId: string) => void
  onManageProviders?: () => void
  reasoningEffort?: {
    value: ReasoningEffortSetting
    options: ReasoningEffortSetting[]
    onChange: (value: ReasoningEffortSetting) => void
  }
}

export function ModelReasoningControl({
  currentProviderId,
  currentModelId,
  currentProviderType,
  displayModelName,
  providers = [],
  onSelectModel,
  onManageProviders,
  reasoningEffort
}: ModelReasoningControlProps) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const insets = useSafeAreaInsets()
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const triggerRef = useRef<View>(null)
  const [anchor, setAnchor] = useState<LayoutRectangle | null>(null)
  const [host, setHost] = useState<LayoutRectangle>({
    x: 0,
    y: 0,
    width: windowWidth,
    height: windowHeight
  })

  const measureTrigger = useCallback((onMeasured?: (rect: LayoutRectangle) => void) => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      onMeasured?.({ x, y, width, height })
    })
  }, [])

  const open = () => {
    measureTrigger((rect) => setAnchor(rect))
  }

  const close = () => setAnchor(null)
  const isOpen = anchor != null

  useEffect(() => {
    if (!isOpen) return undefined

    const followTrigger = () => {
      measureTrigger((rect) => {
        setAnchor((prev) => (prev == null ? prev : rect))
      })
    }

    followTrigger()
    const events =
      Platform.OS === 'ios'
        ? (['keyboardWillChangeFrame', 'keyboardWillHide', 'keyboardDidHide'] as const)
        : (['keyboardDidShow', 'keyboardDidHide'] as const)
    const subs = events.map((event) => Keyboard.addListener(event, followTrigger))
    const settleTimer = setTimeout(followTrigger, 280)
    return () => {
      subs.forEach((sub) => sub.remove())
      clearTimeout(settleTimer)
    }
  }, [isOpen, measureTrigger])

  const effortOptions = reasoningEffort?.options || []
  const hasEffortOptions = effortOptions.length > 0
  const modelText = displayModelName || currentModelId || t('agent.no_model_selected', '选择模型')
  const effortSuffix =
    hasEffortOptions && reasoningEffort?.value
      ? ` · ${formatReasoningEffortLabel(reasoningEffort.value)}`
      : ''

  const panelLayout = computeModelReasoningPanelLayout({
    trigger: anchor ?? { x: 0, y: windowHeight, width: 0, height: 0 },
    host,
    triggerYOffset: Platform.OS === 'android' ? insets.top : 0
  })

  return (
    <>
      <View ref={triggerRef} collapsable={false}>
        <TouchableOpacity
          onPress={open}
          activeOpacity={0.75}
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          accessibilityRole="button"
          accessibilityLabel={`${modelText}${effortSuffix}`}
          style={[
            styles.trigger,
            {
              backgroundColor: 'transparent',
              borderColor: 'transparent',
              borderWidth: 0,
              paddingHorizontal: 4,
              maxWidth: Math.min(220, windowWidth - 140)
            }
          ]}
        >
          {currentProviderId ? (
            <ProviderBrandIcon
              providerId={currentProviderId}
              providerType={currentProviderType || undefined}
              size={14}
            />
          ) : (
            <Sparkles size={13} color={colors.textSecondary} strokeWidth={2} />
          )}
          <Text style={[styles.triggerText, { color: colors.textSecondary }]} numberOfLines={1}>
            {modelText}
            {effortSuffix ? (
              <Text style={[styles.triggerEffortText, { color: colors.textTertiary }]}>
                {effortSuffix}
              </Text>
            ) : null}
          </Text>
          <ChevronUp size={12} color={colors.textTertiary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <Modal
        visible={anchor != null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={close}
      >
        <View
          collapsable={false}
          style={styles.backdrop}
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout
            if (width <= 0 || height <= 0) return
            setHost({ x: 0, y: 0, width, height })
          }}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />
          <View
            style={[
              styles.panel,
              {
                bottom: panelLayout.bottom,
                right: panelLayout.right,
                width: panelLayout.width,
                maxHeight: panelLayout.maxHeight,
                backgroundColor: colors.bgSurface,
                borderColor: colors.borderMuted
              }
            ]}
          >
            {hasEffortOptions ? (
              <View style={styles.sectionWrap}>
                <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>
                  {t('agent.reasoning.effort_section', '思考强度')}
                </Text>
                <View style={styles.effortRow}>
                  {effortOptions.map((opt) => {
                    const isSelected = opt === reasoningEffort?.value
                    return (
                      <TouchableOpacity
                        key={opt}
                        activeOpacity={0.7}
                        onPress={() => reasoningEffort?.onChange(opt)}
                        style={[
                          styles.effortChip,
                          isSelected
                            ? {
                                backgroundColor: colors.primary,
                                borderColor: colors.primary
                              }
                            : {
                                backgroundColor: colors.bgSurfaceHigh,
                                borderColor: colors.borderSubtle
                              }
                        ]}
                      >
                        <Text
                          style={[
                            styles.effortChipLabel,
                            {
                              color: isSelected ? colors.textOnPrimary : colors.textSecondary,
                              fontWeight: isSelected ? '600' : '400'
                            }
                          ]}
                          numberOfLines={1}
                        >
                          {formatReasoningEffortLabel(opt)}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
                <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
              </View>
            ) : null}

            <View style={styles.sectionWrap}>
              <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>
                {t('models.select_model', '选择模型')}
              </Text>
            </View>

            <ScrollView
              style={styles.modelListScroll}
              contentContainerStyle={styles.modelListContent}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              {providers.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                    {t('models.no_available_models', '暂无可用模型')}
                  </Text>
                </View>
              ) : (
                providers.map((provider) => {
                  const models =
                    provider.enabledModels && provider.enabledModels.length > 0
                      ? provider.enabledModels
                      : provider.models || []
                  if (models.length === 0) return null

                  return (
                    <View key={provider.id} style={styles.providerGroup}>
                      <View style={styles.providerHeader}>
                        <ProviderBrandIcon
                          providerId={provider.id}
                          providerType={provider.type}
                          size={13}
                        />
                        <Text
                          style={[styles.providerName, { color: colors.textTertiary }]}
                          numberOfLines={1}
                        >
                          {provider.name || provider.id}
                        </Text>
                      </View>
                      {models.map((modelId) => {
                        const isSelected =
                          provider.id === currentProviderId && modelId === currentModelId
                        return (
                          <TouchableOpacity
                            key={modelId}
                            activeOpacity={0.7}
                            onPress={() => {
                              onSelectModel?.(provider.id, modelId)
                              close()
                            }}
                            style={[
                              styles.modelRow,
                              isSelected ? { backgroundColor: colors.bgSurfaceHigh } : null
                            ]}
                          >
                            <View style={styles.modelInfo}>
                              <Text
                                style={[
                                  styles.modelName,
                                  {
                                    color: isSelected ? colors.primary : colors.textPrimary,
                                    fontWeight: isSelected ? '600' : '400'
                                  }
                                ]}
                                numberOfLines={1}
                              >
                                {modelId}
                              </Text>
                              <ModelVisionBadge
                                modelId={modelId}
                                providerKey={provider.id}
                                size={13}
                              />
                            </View>
                            {isSelected ? (
                              <Check size={14} color={colors.primary} strokeWidth={2.2} />
                            ) : null}
                          </TouchableOpacity>
                        )
                      })}
                    </View>
                  )
                })
              )}
            </ScrollView>

            {onManageProviders ? (
              <View>
                <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
                <TouchableOpacity
                  style={styles.manageBtn}
                  activeOpacity={0.7}
                  onPress={() => {
                    close()
                    onManageProviders()
                  }}
                >
                  <Settings size={13} color={colors.textSecondary} />
                  <Text style={[styles.manageBtnText, { color: colors.textSecondary }]}>
                    {t('settings.manage_providers', '管理供应商')}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  trigger: {
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  triggerText: {
    fontSize: 12,
    fontWeight: '500',
    flexShrink: 1
  },
  triggerEffortText: {
    fontSize: 11,
    fontWeight: '400'
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.25)'
  },
  panel: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 8
  },
  sectionWrap: {
    paddingHorizontal: 8
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    paddingTop: 2,
    paddingBottom: 6
  },
  effortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingBottom: 4
  },
  effortChip: {
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  effortChipLabel: {
    fontSize: 12
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 6,
    marginHorizontal: 4
  },
  modelListScroll: {
    maxHeight: 220
  },
  modelListContent: {
    paddingHorizontal: 4,
    paddingBottom: 2
  },
  providerGroup: {
    marginBottom: 6
  },
  providerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 6,
    paddingVertical: 4
  },
  providerName: {
    fontSize: 11,
    fontWeight: '600'
  },
  modelRow: {
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6
  },
  modelInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  modelName: {
    fontSize: 13,
    flexShrink: 1
  },
  emptyWrap: {
    paddingVertical: 16,
    alignItems: 'center'
  },
  emptyText: {
    fontSize: 12
  },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6
  },
  manageBtnText: {
    fontSize: 12,
    fontWeight: '500'
  }
})
