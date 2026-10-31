import React, { useEffect, useState } from 'react'
import {
  Dimensions,
  Modal as RNModal,
  ModalProps as RNModalProps,
  View,
  Text,
  Pressable,
  useWindowDimensions,
  StyleSheet,
  type ViewStyle
} from 'react-native'
import { mobileTypography, sharedTokens } from '../../theme/tokens'
import { useKeyboardHeight } from '../hooks/useKeyboardHeight'
import { useNativeTheme } from '../theme'
import {
  MODAL_BACKDROP_ARM_MS,
  modalCardMaxHeight,
  modalKeyboardPadding
} from './modal-keyboard.util'

/** 居中弹窗底部操作行：内容宽按钮靠右，与桌面 Dialog 一致 */
export const modalActionsStyle: ViewStyle = {
  flexDirection: 'row',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  alignItems: 'center',
  flexShrink: 0,
  gap: sharedTokens.spacing.sm,
  marginTop: sharedTokens.spacing.md
}

export interface NativeModalProps extends RNModalProps {
  title?: string
  onClose?: () => void
  /** 限制弹窗内容区最大高度，便于内部 ScrollView 滚动 */
  contentMaxHeight?: number
  /** 是否随软键盘弹起向上避让，默认为 true；无输入框或底层弹窗可设为 false */
  avoidKeyboard?: boolean
}

export const Modal: React.FC<NativeModalProps> = ({
  title,
  onClose,
  children,
  transparent = true,
  animationType = 'fade',
  contentMaxHeight,
  avoidKeyboard = true,
  visible,
  ...props
}) => {
  const { colors, tokens } = useNativeTheme()
  const { width: screenWidth, height: screenHeight } = useWindowDimensions()
  const { keyboardHeight } = useKeyboardHeight()
  const horizontalMargin = Math.max(tokens.spacing.lg, 24)
  const maxWidth = 360
  const modalWidth = Math.min(screenWidth - horizontalMargin * 2, maxWidth)
  const activeKeyboardHeight = avoidKeyboard ? keyboardHeight : 0
  const keyboardInset = modalKeyboardPadding(activeKeyboardHeight, tokens.spacing.sm)
  const resolvedMaxHeight = modalCardMaxHeight(screenHeight, keyboardInset, contentMaxHeight)
  const [backdropArmed, setBackdropArmed] = useState(false)

  useEffect(() => {
    if (!visible) {
      setBackdropArmed(false)
      return
    }
    const timer = setTimeout(() => setBackdropArmed(true), MODAL_BACKDROP_ARM_MS)
    return () => clearTimeout(timer)
  }, [visible])

  return (
    <RNModal
      transparent={transparent}
      animationType={animationType}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
      visible={visible}
      {...props}
    >
      <View
        collapsable={false}
        pointerEvents="box-none"
        style={[
          styles.scrim,
          {
            backgroundColor: colors.bgOverlay,
            minHeight: Dimensions.get('screen').height
          }
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          pointerEvents={backdropArmed ? 'auto' : 'none'}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <View pointerEvents="box-none" style={[styles.frame, { paddingBottom: keyboardInset }]}>
          <View
            style={[
              styles.card,
              {
                width: modalWidth,
                maxHeight: resolvedMaxHeight,
                backgroundColor: colors.bgSurface,
                borderRadius: tokens.radius.md,
                padding: tokens.spacing.md,
                zIndex: 2
              }
            ]}
          >
            {title ? (
              <Text
                style={{
                  fontSize: mobileTypography.title.fontSize,
                  fontWeight: mobileTypography.title.fontWeight,
                  color: colors.textPrimary,
                  marginBottom: tokens.spacing.md
                }}
              >
                {title}
              </Text>
            ) : null}
            <View style={styles.body}>{children}</View>
          </View>
        </View>
      </View>
    </RNModal>
  )
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    flex: 1
  },
  frame: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center'
  },
  card: {
    elevation: 0,
    shadowOpacity: 0,
    flexGrow: 0,
    flexShrink: 1,
    overflow: 'hidden'
  },
  body: {
    flexGrow: 0,
    flexShrink: 1,
    minHeight: 0,
    width: '100%',
    alignSelf: 'stretch'
  }
})
