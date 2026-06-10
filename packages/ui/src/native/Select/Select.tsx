import React, { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Animated
} from 'react-native'
import { useNativeTheme } from '../theme'
import { useTranslation } from 'react-i18next'
import { settingsSelectorStyles } from '../SettingsSelector/settings-selector.styles'

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
  /** sheet：自底部滑出；center：屏幕居中弹出 */
  presentation?: NativeSelectPresentation
  /** sheet 模式下是否显示半透明遮罩（嵌套在已有弹窗内建议关闭） */
  showOverlay?: boolean
  /** settings：对齐全局默认模型选择器样式 */
  variant?: NativeSelectVariant
}

export const Select: React.FC<NativeSelectProps> = ({
  options,
  value,
  onValueChange,
  placeholder,
  error,
  style,
  presentation = 'sheet',
  showOverlay = false,
  variant = 'default'
}) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const { width: screenWidth } = useWindowDimensions()
  const [modalVisible, setModalVisible] = useState(false)
  const [mounted, setMounted] = useState(false)
  const sheetTranslateY = useRef(new Animated.Value(320)).current
  const fadeAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.92)).current

  const selectedOpt = options.find((o) => o.value === value)
  const panelWidth = Math.min(screenWidth - 48, 320)
  const hasValue = Boolean(selectedOpt)
  const isSettings = variant === 'settings'

  useEffect(() => {
    if (!modalVisible) {
      if (!mounted) return
      if (presentation === 'center' || isSettings) {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 160,
            useNativeDriver: true
          }),
          Animated.timing(scaleAnim, {
            toValue: 0.92,
            duration: 160,
            useNativeDriver: true
          })
        ]).start(({ finished }) => {
          if (finished) setMounted(false)
        })
        return
      }
      Animated.timing(sheetTranslateY, {
        toValue: 320,
        duration: 180,
        useNativeDriver: true
      }).start(({ finished }) => {
        if (finished) setMounted(false)
      })
      return
    }

    setMounted(true)
    if (presentation === 'center' || isSettings) {
      fadeAnim.setValue(0)
      scaleAnim.setValue(0.92)
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 65,
          friction: 11
        })
      ]).start()
      return
    }

    sheetTranslateY.setValue(320)
    Animated.spring(sheetTranslateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 68,
      friction: 12
    }).start()
  }, [modalVisible, presentation, isSettings, mounted, fadeAnim, scaleAnim, sheetTranslateY])

  const closeSheet = () => setModalVisible(false)

  const triggerContent = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
      {selectedOpt?.leading}
      <Text
        style={{
          color: hasValue ? colors.textPrimary : colors.textTertiary,
          fontSize: isSettings ? 14 : 16,
          lineHeight: isSettings ? 20 : undefined,
          flex: 1
        }}
        numberOfLines={2}
      >
        {selectedOpt ? selectedOpt.label : placeholder || 'Select...'}
      </Text>
    </View>
  )

  const renderCenterOptions = () =>
    options.map((item, index) => {
      const active = item.value === value
      return (
        <TouchableOpacity
          key={item.value}
          style={[
            settingsSelectorStyles.modalOption,
            index < options.length - 1 && {
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.borderSubtle
            },
            active && { backgroundColor: colors.primaryLight }
          ]}
          onPress={() => {
            onValueChange?.(item.value)
            closeSheet()
          }}
        >
          {item.leading}
          <Text
            style={{
              color: active ? colors.primary : colors.textPrimary,
              fontSize: 16,
              flex: 1
            }}
          >
            {item.label}
          </Text>
          {active && <Text style={{ color: colors.primary, fontSize: 16 }}>✓</Text>}
        </TouchableOpacity>
      )
    })

  return (
    <View style={style}>
      <TouchableOpacity
        style={
          isSettings
            ? [
                settingsSelectorStyles.trigger,
                {
                  backgroundColor: colors.bgSurface,
                  borderColor: hasValue ? colors.borderMuted : colors.borderSubtle
                }
              ]
            : {
                backgroundColor: colors.bgSurfaceNormal,
                paddingHorizontal: tokens.spacing.md,
                paddingVertical: tokens.spacing.md,
                borderRadius: tokens.radius.sm,
                borderBottomWidth: 1,
                borderBottomColor: error ? colors.accentGreen : 'transparent',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center'
              }
        }
        activeOpacity={0.7}
        onPress={() => setModalVisible(true)}
      >
        {triggerContent}
        <Text style={[settingsSelectorStyles.chevron, { color: colors.textTertiary }]}>
          {isSettings ? '›' : '▼'}
        </Text>
      </TouchableOpacity>
      {error ? (
        <Text
          style={{
            color: colors.accentGreen,
            fontSize: 12,
            marginTop: tokens.spacing.xs
          }}
        >
          {error}
        </Text>
      ) : null}

      <Modal
        visible={mounted}
        transparent
        animationType="none"
        onRequestClose={closeSheet}
      >
        {presentation === 'center' || isSettings ? (
          <View style={settingsSelectorStyles.modalOverlay}>
            <Animated.View
              style={[
                settingsSelectorStyles.modalBackdrop,
                { backgroundColor: colors.bgOverlay, opacity: fadeAnim }
              ]}
            >
              <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
            </Animated.View>
            <Animated.View
              style={[
                settingsSelectorStyles.modalPanel,
                {
                  width: panelWidth,
                  backgroundColor: colors.bgSurface,
                  borderColor: colors.borderSubtle,
                  borderRadius: tokens.radius.lg,
                  opacity: fadeAnim,
                  transform: [{ scale: scaleAnim }]
                }
              ]}
            >
              {renderCenterOptions()}
              <TouchableOpacity
                style={[settingsSelectorStyles.modalCancel, { borderTopColor: colors.borderSubtle }]}
                onPress={closeSheet}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 16, textAlign: 'center' }}>
                  {t('common.cancel', '取消')}
                </Text>
              </TouchableOpacity>
            </Animated.View>
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
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={{
                      padding: tokens.spacing.md,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.bgSurfaceNormal,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8
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
                        fontSize: 16,
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
                    fontSize: 16,
                    textAlign: 'center',
                    fontWeight: 'bold'
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
