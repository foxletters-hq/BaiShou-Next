import React from 'react'
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle
} from 'react-native'
import { useNativeTheme } from '../theme'
import { sharedTokens } from '../../theme/tokens'

export interface FloatingModalProps {
  visible: boolean
  onClose: () => void
  children: React.ReactNode
  maxWidth?: number
  cardStyle?: ViewStyle
  /** 点击遮罩是否关闭，默认 true */
  closeOnBackdropPress?: boolean
  /** none：立刻出现，避免底层画布上的淡入延迟 */
  animationType?: 'none' | 'fade' | 'slide'
}

/** 半透明遮罩 + 居中浮层，不占用整页 */
export const FloatingModal: React.FC<FloatingModalProps> = ({
  visible,
  onClose,
  children,
  maxWidth = 400,
  cardStyle,
  closeOnBackdropPress = true,
  animationType = 'fade'
}) => {
  const { colors } = useNativeTheme()
  const { width: screenWidth, height: screenHeight } = useWindowDimensions()
  const cardWidth = Math.min(screenWidth - 32, maxWidth)

  return (
    <Modal
      visible={visible}
      transparent
      animationType={animationType}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { minHeight: Dimensions.get('screen').height }]}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.bgOverlay }]}
          onPress={closeOnBackdropPress ? onClose : undefined}
        />
        <View
          style={[
            styles.card,
            {
              width: cardWidth,
              maxHeight: screenHeight * 0.85,
              backgroundColor: colors.bgSurface,
              borderColor: colors.borderSubtle
            },
            cardStyle
          ]}
        >
          {children}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: sharedTokens.spacing.md
  },
  card: {
    borderRadius: sharedTokens.radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    zIndex: 1
  }
})
