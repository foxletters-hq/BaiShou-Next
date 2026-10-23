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
import { mobileTypography, sharedTokens } from '../../theme/tokens'

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
  hasChatBackground?: boolean
}

export function ModelReasoningControl({
  currentProviderId,
  currentModelId,
  currentProviderType,
  displayModelName,
  providers = [],
  onSelectModel,
  onManageProviders,
  reasoningEffort,
  hasChatBackground = false
}: ModelReasoningControlProps) {
  const { t } = useTranslation()
  const { colors, isDark } = useNativeTheme()
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
              paddingHorizontal: sharedTokens.spacing.xs,
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
                backgroundColor: hasChatBackground
                  ? isDark
                    ? 'rgba(30, 30, 34, 0.92)'
                    : 'rgba(255, 255, 255, 0.94)'
                  : colors.bgSurface,
                borderColor: hasChatBackground
                  ? isDark
                    ? 'rgba(255, 255, 255, 0.15)'
                    : 'rgba(0, 0, 0, 0.10)'
                  : colors.borderMuted
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
                                backgroundColor: hasChatBackground
                                  ? isDark
                                    ? 'rgba(255, 255, 255, 0.08)'
                                    : 'rgba(0, 0, 0, 0.04)'
                                  : colors.bgSurfaceHigh,
                                borderColor: hasChatBackground
                                  ? isDark
                                    ? 'rgba(255, 255, 255, 0.12)'
                                    : 'rgba(0, 0, 0, 0.06)'
                                  : colors.borderSubtle
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
    paddingHorizontal: sharedTokens.spacing.sm,
    borderRadius: sharedTokens.radius.xsPlus,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xs
  },
  triggerText: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '500',
    flexShrink: 1
  },
  triggerEffortText: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '400'
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.25)'
  },
  panel: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: sharedTokens.radius.md,
    paddingVertical: sharedTokens.spacing.sm,
    paddingHorizontal: sharedTokens.spacing.xsPlus,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.16,
        shadowRadius: 12
      },
      default: {}
    })
  },
  sectionWrap: {
    paddingHorizontal: sharedTokens.spacing.sm
  },
  sectionTitle: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '600',
    letterSpacing: 0.3,
    paddingTop: sharedTokens.spacing.xxs,
    paddingBottom: sharedTokens.spacing.xsPlus
  },
  effortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: sharedTokens.spacing.xsPlus,
    paddingBottom: sharedTokens.spacing.xs
  },
  effortChip: {
    paddingHorizontal: sharedTokens.spacing.smPlus,
    height: 26,
    borderRadius: sharedTokens.radius.xsPlus,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  effortChipLabel: {
    fontSize: mobileTypography.caption.fontSize
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: sharedTokens.spacing.xsPlus,
    marginHorizontal: sharedTokens.spacing.xs
  },
  modelListScroll: {
    maxHeight: 220
  },
  modelListContent: {
    paddingHorizontal: sharedTokens.spacing.xs,
    paddingBottom: sharedTokens.spacing.xxs
  },
  providerGroup: {
    marginBottom: sharedTokens.spacing.xsPlus
  },
  providerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xsPlus,
    paddingHorizontal: sharedTokens.spacing.xsPlus,
    paddingVertical: sharedTokens.spacing.xs
  },
  providerName: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '600'
  },
  modelRow: {
    height: 32,
    paddingHorizontal: sharedTokens.spacing.sm,
    borderRadius: sharedTokens.radius.xsPlus,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sharedTokens.spacing.xsPlus
  },
  modelInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xsPlus
  },
  modelName: {
    fontSize: mobileTypography.secondary.fontSize,
    flexShrink: 1
  },
  emptyWrap: {
    paddingVertical: sharedTokens.spacing.md,
    alignItems: 'center'
  },
  emptyText: {
    fontSize: mobileTypography.caption.fontSize
  },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sharedTokens.spacing.xsPlus,
    paddingVertical: sharedTokens.spacing.xsPlus
  },
  manageBtnText: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '500'
  }
})
