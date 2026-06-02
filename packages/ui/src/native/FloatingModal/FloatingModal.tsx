import React from 'react'
import {
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle
} from 'react-native'
import { useNativeTheme } from '../theme'

export interface FloatingModalProps {
  visible: boolean
  onClose: () => void
  children: React.ReactNode
  maxWidth?: number
  cardStyle?: ViewStyle
}

/** 半透明遮罩 + 居中浮层，不占用整页 */
export const FloatingModal: React.FC<FloatingModalProps> = ({
  visible,
  onClose,
  children,
  maxWidth = 400,
  cardStyle
}) => {
  const { colors } = useNativeTheme()
  const { width: screenWidth, height: screenHeight } = useWindowDimensions()
  const cardWidth = Math.min(screenWidth - 32, maxWidth)

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.bgOverlay }]}
          onPress={onClose}
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
    padding: 16
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    zIndex: 1
  }
})
