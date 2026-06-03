import React from 'react'
import {
  Modal as RNModal,
  ModalProps as RNModalProps,
  View,
  Text,
  TouchableWithoutFeedback,
  useWindowDimensions
} from 'react-native'
import { useNativeTheme } from '../theme'

export interface NativeModalProps extends RNModalProps {
  title?: string
  onClose?: () => void
}

export const Modal: React.FC<NativeModalProps> = ({
  title,
  onClose,
  children,
  transparent = true,
  animationType = 'fade',
  ...props
}) => {
  const { colors, tokens } = useNativeTheme()
  const { width: screenWidth } = useWindowDimensions()
  const horizontalMargin = Math.max(tokens.spacing.lg, 24)
  const maxWidth = 320
  const modalWidth = Math.min(screenWidth - horizontalMargin * 2, maxWidth)

  return (
    <RNModal
      transparent={transparent}
      animationType={animationType}
      onRequestClose={onClose}
      {...props}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0,0,0,0.5)'
          }}
        >
          <TouchableWithoutFeedback>
            <View
              style={{
                width: modalWidth,
                backgroundColor: colors.bgSurface,
                borderRadius: tokens.radius.xl,
                padding: tokens.spacing.md,
                elevation: 0,
                shadowOpacity: 0
              }}
            >
              {title && (
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
              )}
              {children}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </RNModal>
  )
}
