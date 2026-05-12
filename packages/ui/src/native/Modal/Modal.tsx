import React from 'react';
import { Modal as RNModal, ModalProps as RNModalProps, View, Text, TouchableWithoutFeedback } from 'react-native';
import { useNativeTheme } from '../theme';

export interface NativeModalProps extends RNModalProps {
  title?: string;
  onClose?: () => void;
}

export const Modal: React.FC<NativeModalProps> = ({ title, onClose, children, transparent = true, animationType = 'fade', ...props }) => {
  const { colors, tokens } = useNativeTheme();

  return (
    <RNModal transparent={transparent} animationType={animationType} onRequestClose={onClose} {...props}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <TouchableWithoutFeedback>
            <View style={{ 
              width: '90%', 
              backgroundColor: colors.bgSurface, 
              borderRadius: tokens.radius.xl, 
              padding: tokens.spacing.lg,
              elevation: 5,
              shadowColor: 'var(--text-primary)',
              shadowOpacity: 0.25,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 2 },
            }}>
              {title && <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary, marginBottom: tokens.spacing.md }}>{title}</Text>}
              {children}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </RNModal>
  );
};
