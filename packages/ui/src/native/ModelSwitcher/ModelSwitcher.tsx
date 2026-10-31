import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Platform,
  useWindowDimensions
} from 'react-native'
import { Check, Settings, X } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { getNativeElevationStyle, useNativeTheme } from '../theme'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import {
  formatReasoningEffortLabel,
  getReasoningCatalogEpoch,
  listSessionReasoningEffortSettings,
  subscribeReasoningCatalog,
  type ReasoningEffortSetting
} from '@baishou/shared'
import { ProviderBrandIcon } from '../ProviderBrandIcon'
import { ModelVisionBadge } from '../../shared/ModelVisionBadge'
import { styles } from './model-switcher.styles'

export interface MockAiProviderModel {
  id: string
  name: string
  type?: string
  enabledModels?: string[]
  models?: string[]
}

interface NativeModelSwitcherProps {
  isOpen: boolean
  onClose: () => void
  providers: MockAiProviderModel[]
  currentProviderId?: string | null
  currentModelId?: string | null
  onSelect: (providerId: string, modelId: string, reasoningEffort?: ReasoningEffortSetting) => void
  onManageProviders?: () => void
  showReasoningPanel?: boolean
  reasoningEffort?: ReasoningEffortSetting
  onReasoningEffortChange?: (value: ReasoningEffortSetting) => void
}

export const ModelSwitcher: React.FC<NativeModelSwitcherProps> = ({
  isOpen,
  onClose,
  providers,
  currentProviderId,
  currentModelId,
  onSelect,
  onManageProviders,
  showReasoningPanel = false,
  reasoningEffort,
  onReasoningEffortChange
}) => {
  const { t } = useTranslation()
  const { colors, maxModalWidth, isDark } = useNativeTheme()
  const { height: windowHeight } = useWindowDimensions()

  useSyncExternalStore(
    subscribeReasoningCatalog,
    getReasoningCatalogEpoch,
    getReasoningCatalogEpoch
  )
  // 内部维护暂存状态，点击底部保存按钮统一生效
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(
    currentProviderId ?? null
  )
  const [selectedModelId, setSelectedModelId] = useState<string | null>(currentModelId ?? null)
  const [selectedEffort, setSelectedEffort] = useState<ReasoningEffortSetting>(
    reasoningEffort ?? 'auto'
  )

  useEffect(() => {
    if (isOpen) {
      setSelectedProviderId(currentProviderId ?? null)
      setSelectedModelId(currentModelId ?? null)
      setSelectedEffort(reasoningEffort ?? 'auto')
    }
  }, [isOpen, currentProviderId, currentModelId, reasoningEffort])

  // 过滤有模型的可用供应商
  const activeProviders = useMemo(() => {
    return providers.filter((p) => {
      const list = p.enabledModels ?? p.models ?? []
      return list.length > 0
    })
  }, [providers])

  // 计算当前暂存选中的模型所支持的思考强度档位
  const activeProvider = providers.find((provider) => provider.id === selectedProviderId)
  const effortOptions =
    showReasoningPanel && selectedModelId
      ? listSessionReasoningEffortSettings(
          selectedModelId,
          activeProvider?.type || selectedProviderId || undefined
        )
      : []
  const hasEffortOptions = effortOptions.length > 0

  const handleSelectModel = (providerId: string, modelId: string) => {
    setSelectedProviderId(providerId)
    setSelectedModelId(modelId)
    const provider = providers.find((p) => p.id === providerId)
    const modelOpts = showReasoningPanel
      ? listSessionReasoningEffortSettings(modelId, provider?.type || providerId || undefined)
      : []
    if (modelOpts.length > 0) {
      if (!modelOpts.includes(selectedEffort)) {
        setSelectedEffort('auto')
      }
    }
  }

  const handleSave = () => {
    if (selectedProviderId && selectedModelId) {
      onSelect(selectedProviderId, selectedModelId, showReasoningPanel ? selectedEffort : undefined)
      if (showReasoningPanel && onReasoningEffortChange) {
        onReasoningEffortChange(selectedEffort)
      }
    }
    onClose()
  }

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.backdrop, { backgroundColor: colors.bgOverlay }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </View>

        <View
          style={[
            styles.dialog,
            {
              backgroundColor: colors.bgSurface,
              borderColor: colors.borderMuted,
              width: '90%',
              maxWidth: Math.min(380, maxModalWidth),
              maxHeight: Math.min(560, windowHeight * 0.82),
              ...(Platform.OS === 'ios' ? getNativeElevationStyle(isDark, 'raised') : {})
            }
          ]}
        >
          {/* 弹窗头部 */}
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
              {t('models.switch_model', '切换模型')}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={t('common.close', '关闭')}
            >
              <X size={20} color={colors.textSecondary} strokeWidth={DEFAULT_STROKE_WIDTH} />
            </TouchableOpacity>
          </View>

          {/* 思考强度区域：对齐伙伴页面ModelReasoningControl风格 */}
          {hasEffortOptions ? (
            <View style={styles.sectionWrap}>
              <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>
                {t('agent.reasoning.effort_section', '思考强度')}
              </Text>
              <View style={styles.effortRow}>
                {effortOptions.map((opt) => {
                  const isSelected = opt === selectedEffort
                  return (
                    <TouchableOpacity
                      key={opt}
                      activeOpacity={0.7}
                      onPress={() => setSelectedEffort(opt)}
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

          {/* 选择模型小节标题 */}
          <View style={styles.sectionWrap}>
            <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>
              {t('models.select_model', '选择模型')}
            </Text>
          </View>

          {/* 模型列表 */}
          <ScrollView
            style={styles.modelListScroll}
            contentContainerStyle={styles.modelListContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {activeProviders.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                  {t('models.no_available_models', '暂无可用模型')}
                </Text>
              </View>
            ) : (
              activeProviders.map((provider) => {
                const models = provider.enabledModels ?? provider.models ?? []
                const isCurrentProvider = provider.id === selectedProviderId

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
                      <View
                        style={[styles.countBadge, { backgroundColor: colors.bgSurfaceNormal }]}
                      >
                        <Text style={[styles.countText, { color: colors.textSecondary }]}>
                          {models.length}
                        </Text>
                      </View>
                    </View>

                    {models.map((modelId) => {
                      const isSelected = isCurrentProvider && modelId === selectedModelId

                      return (
                        <TouchableOpacity
                          key={modelId}
                          activeOpacity={0.7}
                          onPress={() => handleSelectModel(provider.id, modelId)}
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
                            <Check size={15} color={colors.primary} strokeWidth={2.2} />
                          ) : null}
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                )
              })
            )}
          </ScrollView>

          {/* 底部保存按钮与管理供应商 */}
          <View style={[styles.footer, { borderTopColor: colors.borderSubtle }]}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleSave}
              disabled={!selectedModelId}
              style={[
                styles.saveBtn,
                {
                  backgroundColor: selectedModelId ? colors.primary : colors.bgSurfaceNormal,
                  opacity: selectedModelId ? 1 : 0.6
                }
              ]}
            >
              <Text
                style={[
                  styles.saveBtnText,
                  { color: selectedModelId ? colors.textOnPrimary : colors.textTertiary }
                ]}
              >
                {t('common.save', '保存')}
              </Text>
            </TouchableOpacity>

            {onManageProviders ? (
              <TouchableOpacity
                style={styles.manageBtn}
                activeOpacity={0.7}
                onPress={() => {
                  onClose()
                  onManageProviders()
                }}
              >
                <Settings size={13} color={colors.textSecondary} />
                <Text style={[styles.manageBtnText, { color: colors.textSecondary }]}>
                  {t('settings.manage_providers', '管理供应商')}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  )
}
