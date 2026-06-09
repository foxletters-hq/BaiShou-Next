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

export interface NativeSelectOption {
  label: string
  value: string
  leading?: React.ReactNode
}

export type NativeSelectPresentation = 'sheet' | 'center'

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
}

export const Select: React.FC<NativeSelectProps> = ({
  options,
  value,
  onValueChange,
  placeholder,
  error,
  style,
  presentation = 'sheet',
  showOverlay = false
}) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const { width: screenWidth } = useWindowDimensions()
  const [modalVisible, setModalVisible] = useState(false)
  const sheetTranslateY = useRef(new Animated.Value(320)).current

  const selectedOpt = options.find((o) => o.value === value)
  const panelWidth = Math.min(screenWidth - 48, 320)

  useEffect(() => {
    if (presentation !== 'sheet') return
    if (modalVisible) {
      sheetTranslateY.setValue(320)
      Animated.spring(sheetTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 68,
        friction: 12
      }).start()
      return
    }
    sheetTranslateY.setValue(320)
  }, [modalVisible, presentation, sheetTranslateY])

  const closeSheet = () => setModalVisible(false)

  return (
    <View style={style}>
      <TouchableOpacity
        style={{
          backgroundColor: colors.bgSurfaceNormal,
          paddingHorizontal: tokens.spacing.md,
          paddingVertical: tokens.spacing.md,
          borderRadius: tokens.radius.sm,
          borderBottomWidth: 1,
          borderBottomColor: error ? colors.accentGreen : 'transparent',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
        onPress={() => setModalVisible(true)}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          {selectedOpt?.leading}
          <Text
            style={{
              color: selectedOpt ? colors.textPrimary : colors.textSecondary,
              fontSize: 16,
              flex: 1
            }}
            numberOfLines={1}
          >
            {selectedOpt ? selectedOpt.label : placeholder || 'Select...'}
          </Text>
        </View>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>▼</Text>
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
        visible={modalVisible}
        transparent
        animationType={presentation === 'center' ? 'fade' : 'fade'}
        onRequestClose={closeSheet}
      >
        {presentation === 'center' ? (
          <View style={styles.centerOverlay}>
            <Pressable
              style={[StyleSheet.absoluteFill, { backgroundColor: colors.bgOverlay }]}
              onPress={closeSheet}
            />
            <View
              style={[
                styles.centerPanel,
                {
                  width: panelWidth,
                  backgroundColor: colors.bgSurface,
                  borderColor: colors.borderSubtle,
                  borderRadius: tokens.radius.lg
                }
              ]}
            >
              {options.map((item, index) => {
                const active = item.value === value
                return (
                  <TouchableOpacity
                    key={item.value}
                    style={[
                      styles.centerOption,
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
                  </TouchableOpacity>
                )
              })}
              <TouchableOpacity
                style={[styles.centerCancel, { borderTopColor: colors.borderSubtle }]}
                onPress={closeSheet}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 16, textAlign: 'center' }}>
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
  centerOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  centerPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden'
  },
  centerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  centerCancel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14
  },
  sheetRoot: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  sheetPanel: {
    maxHeight: '50%'
  }
})
