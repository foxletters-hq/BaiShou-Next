import React, { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  Animated,
  type StyleProp,
  type TextStyle,
  type ViewStyle
} from 'react-native'
import { useNativeTheme } from '../theme'
import { useTranslation } from 'react-i18next'
import { settingsSelectorStyles } from '../SettingsSelector/settings-selector.styles'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

export interface NativeSelectOption {
  label: string
  value: string
  leading?: React.ReactNode
}

export type NativeSelectPresentation = 'sheet' | 'center'
export type NativeSelectVariant = 'default' | 'settings'

export interface NativeSelectProps {
  options: NativeSelectOption[]
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  error?: string
  style?: any
  /** 覆盖触发器外观（如表单页预览更小圆角） */
  triggerStyle?: StyleProp<ViewStyle>
  /** 覆盖右侧箭头字符，默认 settings 为 ›、其它为 ▼ */
  chevron?: string
  chevronStyle?: StyleProp<TextStyle>
  /** sheet：自底部滑出；center：屏幕居中弹出 */
  presentation?: NativeSelectPresentation
  /** sheet 模式下是否显示半透明遮罩（嵌套在已有弹窗内建议关闭） */
  showOverlay?: boolean
  /** settings：对齐全局默认模型选择器样式 */
  variant?: NativeSelectVariant
  /** 选项为空时弹窗内文案 */
  emptyText?: string
  /** 紧凑模式：自适应内容宽度，不强制撑满外部容器与留白 */
  compact?: boolean
}

export const Select: React.FC<NativeSelectProps> = ({
  options,
  value,
  onValueChange,
  placeholder,
  error,
  style,
  triggerStyle,
  chevron,
  chevronStyle,
  presentation = 'sheet',
  showOverlay = false,
  variant = 'default',
  emptyText,
  compact = false
}) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const { width: screenWidth } = useWindowDimensions()
  const [modalVisible, setModalVisible] = useState(false)
  const [mounted, setMounted] = useState(false)
  const sheetTranslateY = useRef(new Animated.Value(320)).current

  const selectedOpt = options.find((o) => o.value === value)
  const panelWidth = Math.min(screenWidth - 48, 320)
  const hasValue = Boolean(selectedOpt)
  const isSettings = variant === 'settings'
  const isCenter = presentation === 'center' || isSettings

  useEffect(() => {
    if (isCenter) return
    if (!modalVisible) {
      if (!mounted) return
      Animated.timing(sheetTranslateY, {
        toValue: 320,
        duration: sharedTokens.animation.swift,
        useNativeDriver: true
      }).start(({ finished }) => {
        if (finished) setMounted(false)
      })
      return
    }

    setMounted(true)
    sheetTranslateY.setValue(320)
    Animated.spring(sheetTranslateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 68,
      friction: 12
    }).start()
  }, [modalVisible, isCenter, mounted, sheetTranslateY])

  const closeSheet = () => setModalVisible(false)
  const emptyCopy = emptyText ?? t('common.no_data', '暂无资料')
  const emptyNode = (
    <Text
      style={{
        color: colors.textSecondary,
        fontSize: mobileTypography.primary.fontSize,
        textAlign: 'center',
        paddingHorizontal: tokens.spacing.md,
        paddingVertical: tokens.spacing.mdSnug
      }}
    >
      {emptyCopy}
    </Text>
  )

  const triggerContent = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: compact ? sharedTokens.spacing.xs : sharedTokens.spacing.sm,
        flex: compact ? undefined : 1
      }}
    >
      {selectedOpt?.leading}
      <Text
        style={{
          color: hasValue ? colors.textPrimary : colors.textTertiary,
          fontSize: isSettings
            ? mobileTypography.secondary.fontSize
            : mobileTypography.primary.fontSize,
          lineHeight: isSettings ? 20 : undefined,
          flex: compact ? undefined : 1,
          textAlign: isSettings ? 'right' : 'left'
        }}
        numberOfLines={2}
      >
        {selectedOpt ? selectedOpt.label : placeholder || 'Select...'}
      </Text>
    </View>
  )

  const renderCenterOptions = () => (
    <ScrollView
      style={{ maxHeight: 320 }}
      contentContainerStyle={settingsSelectorStyles.modalOptionsList}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {options.map((item) => {
        const active = item.value === value
        return (
          <TouchableOpacity
            key={item.value}
            activeOpacity={0.7}
            style={[
              settingsSelectorStyles.modalOption,
              {
                backgroundColor: active ? colors.primaryLight : colors.bgSurface,
                borderColor: active ? colors.primary : colors.borderControl,
                borderWidth: active ? 1.5 : 1
              }
            ]}
            onPress={() => {
              onValueChange?.(item.value)
              closeSheet()
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: sharedTokens.spacing.sm,
                flex: 1
              }}
            >
              {item.leading}
              <Text
                style={{
                  color: active ? colors.primary : colors.textPrimary,
                  fontSize: mobileTypography.primary.fontSize,
                  fontWeight: active ? '600' : '400',
                  flex: 1
                }}
              >
                {item.label}
              </Text>
            </View>
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                borderWidth: active ? 1.5 : 1,
                borderColor: active ? colors.primary : colors.borderControl,
                backgroundColor: active ? colors.primary : 'transparent',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {active ? (
                <Text
                  style={{
                    color: colors.textOnPrimary,
                    fontSize: 11,
                    fontWeight: '700',
                    lineHeight: 14,
                    textAlign: 'center'
                  }}
                >
                  ✓
                </Text>
              ) : null}
            </View>
          </TouchableOpacity>
        )
      })}
    </ScrollView>
  )

  return (
    <View style={compact ? [{ alignSelf: 'flex-end' }, style] : style}>
      <TouchableOpacity
        style={
          isSettings
            ? [
                settingsSelectorStyles.trigger,
                {
                  backgroundColor: colors.bgSurface,
                  borderColor: hasValue ? colors.borderControl : colors.borderSubtle
                },
                compact && {
                  alignSelf: 'flex-end',
                  justifyContent: 'center',
                  paddingHorizontal: sharedTokens.spacing.smPlus,
                  paddingVertical: sharedTokens.spacing.xxs,
                  gap: sharedTokens.spacing.xs,
                  minHeight: 32
                },
                triggerStyle
              ]
            : [
                {
                  backgroundColor: colors.bgSurfaceNormal,
                  paddingHorizontal: tokens.spacing.md,
                  paddingVertical: tokens.spacing.md,
                  borderRadius: tokens.radius.xs,
                  borderBottomWidth: 1,
                  borderBottomColor: error ? colors.accentGreen : 'transparent',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                },
                triggerStyle
              ]
        }
        activeOpacity={0.7}
        onPress={() => setModalVisible(true)}
      >
        {triggerContent}
        <Text
          style={[settingsSelectorStyles.chevron, { color: colors.textTertiary }, chevronStyle]}
        >
          {chevron ?? (isSettings ? '›' : '▼')}
        </Text>
      </TouchableOpacity>
      {error ? (
        <Text
          style={{
            color: colors.accentGreen,
            fontSize: mobileTypography.caption.fontSize,
            marginTop: tokens.spacing.xs
          }}
        >
          {error}
        </Text>
      ) : null}

      <Modal
        visible={isCenter ? modalVisible : mounted}
        transparent
        animationType={isCenter ? 'fade' : 'none'}
        onRequestClose={closeSheet}
      >
        {isCenter ? (
          <View style={settingsSelectorStyles.modalOverlay}>
            <View
              style={[settingsSelectorStyles.modalBackdrop, { backgroundColor: colors.bgOverlay }]}
            >
              <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
            </View>
            <View
              style={[
                settingsSelectorStyles.modalPanel,
                {
                  width: panelWidth,
                  backgroundColor: colors.bgSurface,
                  borderColor: colors.borderSubtle,
                  borderRadius: tokens.radius.lg
                }
              ]}
            >
              {options.length === 0 ? emptyNode : renderCenterOptions()}
              <TouchableOpacity
                style={[
                  settingsSelectorStyles.modalCancel,
                  {
                    backgroundColor: colors.bgSurface,
                    borderWidth: 1,
                    borderColor: colors.borderControl
                  }
                ]}
                activeOpacity={0.7}
                onPress={closeSheet}
              >
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: mobileTypography.primary.fontSize,
                    fontWeight: '500',
                    textAlign: 'center'
                  }}
                >
                  {t('common.cancel', '取消')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.sheetRoot}>
            {showOverlay ? (
              <Pressable
                style={[StyleSheet.absoluteFill, { backgroundColor: colors.bgOverlay }]}
                onPress={closeSheet}
              />
            ) : (
              <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
            )}
            <Animated.View
              style={[
                styles.sheetPanel,
                {
                  backgroundColor: colors.bgSurface,
                  borderTopLeftRadius: tokens.radius.lg,
                  borderTopRightRadius: tokens.radius.lg,
                  transform: [{ translateY: sheetTranslateY }]
                }
              ]}
            >
              <FlatList
                data={options}
                keyExtractor={(item) => item.value}
                ListEmptyComponent={emptyNode}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={{
                      padding: tokens.spacing.md,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.bgSurfaceNormal,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: sharedTokens.spacing.sm
                    }}
                    onPress={() => {
                      onValueChange?.(item.value)
                      closeSheet()
                    }}
                  >
                    {item.leading}
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontSize: mobileTypography.primary.fontSize,
                        textAlign: 'center'
                      }}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                )}
              />
              <TouchableOpacity
                style={{
                  padding: tokens.spacing.md,
                  marginBottom: tokens.spacing.lg
                }}
                onPress={closeSheet}
              >
                <Text
                  style={{
                    color: colors.primary,
                    fontSize: mobileTypography.primary.fontSize,
                    textAlign: 'center',
                    fontWeight: '600'
                  }}
                >
                  {t('common.cancel', '取消')}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  sheetRoot: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  sheetPanel: {
    maxHeight: '50%'
  }
})
