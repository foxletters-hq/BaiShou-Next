import React from 'react'
import {
  Modal as RNModal,
  ModalProps as RNModalProps,
  View,
  Text,
  Pressable,
  useWindowDimensions,
  StyleSheet
} from 'react-native'
import { useNativeTheme } from '../theme'

export interface NativeModalProps extends RNModalProps {
  title?: string
  onClose?: () => void
  /** 限制弹窗内容区最大高度，便于内部 ScrollView 滚动 */
  contentMaxHeight?: number
}

export const Modal: React.FC<NativeModalProps> = ({
  title,
  onClose,
  children,
  transparent = true,
  animationType = 'fade',
  contentMaxHeight,
  ...props
}) => {
  const { colors, tokens } = useNativeTheme()
  const { width: screenWidth, height: screenHeight } = useWindowDimensions()
  const horizontalMargin = Math.max(tokens.spacing.lg, 24)
  const maxWidth = 360
  const modalWidth = Math.min(screenWidth - horizontalMargin * 2, maxWidth)
  const resolvedMaxHeight = contentMaxHeight ?? Math.round(screenHeight * 0.72)

  return (
    <RNModal
      transparent={transparent}
      animationType={animationType}
      onRequestClose={onClose}
      {...props}
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <View
          style={[
            styles.card,
            {
              width: modalWidth,
              maxHeight: resolvedMaxHeight,
              backgroundColor: colors.bgSurface,
              borderRadius: tokens.radius.xl,
              padding: tokens.spacing.md
            }
          ]}
        >
          {title ? (
            <Text
              style={{
                fontSize: 18,
                fontWeight: '600',
                color: colors.textPrimary,
                marginBottom: tokens.spacing.md
              }}
            >
              {title}
            </Text>
          ) : null}
          {children}
        </View>
      </View>
    </RNModal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)'
  },
  card: {
    elevation: 0,
    shadowOpacity: 0
  }
})
