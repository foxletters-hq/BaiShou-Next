import React, { useState, useCallback } from 'react'
import { View, Text, Pressable, ViewProps, Modal, ScrollView, StyleSheet } from 'react-native'
import { useNativeTheme } from '../theme'

export interface NativeTooltipProps extends ViewProps {
  content: React.ReactNode
  position?: 'top' | 'bottom' | 'center'
}

export const Tooltip: React.FC<NativeTooltipProps> = ({
  content,
  children,
  position = 'center',
  style,
  ...props
}) => {
  const { colors, tokens } = useNativeTheme()
  const [isVisible, setIsVisible] = useState(false)
  const [layout, setLayout] = useState({ x: 0, y: 0, width: 0, height: 0 })

  const handlePress = useCallback(() => {
    setIsVisible(true)
  }, [])

  const handleClose = useCallback(() => {
    setIsVisible(false)
  }, [])

  const handleLayout = useCallback((event: any) => {
    const { x, y, width, height } = event.nativeEvent.layout
    setLayout({ x, y, width, height })
  }, [])

  const isDark =
    colors.textPrimary === '#ffffff' ||
    colors.bgApp === '#000000' ||
    colors.bgApp === '#121212' ||
    colors.bgSurface === '#1e1e1e'

  const solidBg = colors.bgSurface
  const solidBorder = colors.borderSubtle
  const shadowColor = '#000'

  const getJustifyContent = () => {
    if (position === 'top') return 'flex-start'
    if (position === 'bottom') return 'flex-end'
    return 'center'
  }

  return (
    <>
      <Pressable onPress={handlePress} onLayout={handleLayout} style={style} {...props}>
        {children}
      </Pressable>

      {isVisible && (
        <Modal transparent visible={isVisible} animationType="fade" onRequestClose={handleClose}>
          <View
            style={{
              flex: 1,
              justifyContent: getJustifyContent(),
              alignItems: 'center',
              paddingBottom: position === 'bottom' ? 120 : 20,
              paddingTop: position === 'top' ? 120 : 20,
              paddingHorizontal: 20
            }}
          >
            {/* 背景遮罩层：同级并列，点击关闭弹窗 */}
            <Pressable
              style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0, 0, 0, 0.4)' }]}
              onPress={handleClose}
            />

            {/* 卡片本体：不再嵌套于 TouchableWithoutFeedback 内部，防止滚动事件被截断 */}
            <View
              style={{
                backgroundColor: solidBg,
                borderColor: solidBorder,
                borderWidth: 1,
                borderRadius: tokens.radius.lg,
                paddingHorizontal: tokens.spacing.md,
                paddingVertical: tokens.spacing.md,
                maxWidth: '92%',
                width: 320,
                maxHeight: 360,
                elevation: 5,
                shadowColor: shadowColor,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: isDark ? 0.35 : 0.12,
                shadowRadius: 8
              }}
            >
              <ScrollView
                style={{ maxHeight: 328 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {typeof content === 'string' ? (
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontSize: 14,
                      lineHeight: 21
                    }}
                  >
                    {content}
                  </Text>
                ) : (
                  content
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </>
  )
}
