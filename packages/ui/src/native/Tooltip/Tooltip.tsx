import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, ViewProps, Modal, TouchableWithoutFeedback } from 'react-native';
import { useNativeTheme } from '../theme';

export interface NativeTooltipProps extends ViewProps {
  content: React.ReactNode;
  position?: 'top' | 'bottom';
}

export const Tooltip: React.FC<NativeTooltipProps> = ({ 
  content, 
  children, 
  position = 'bottom',
  style, 
  ...props 
}) => {
  const { colors, tokens } = useNativeTheme();
  const [isVisible, setIsVisible] = useState(false);
  const [layout, setLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });

  const handlePress = useCallback(() => {
    setIsVisible(true);
  }, []);

  const handleClose = useCallback(() => {
    setIsVisible(false);
  }, []);

  const handleLayout = useCallback((event: any) => {
    const { x, y, width, height } = event.nativeEvent.layout;
    setLayout({ x, y, width, height });
  }, []);

  return (
    <>
      <Pressable 
        onPress={handlePress} 
        onLayout={handleLayout}
        style={style}
        {...props}
      >
        {children}
      </Pressable>
      
      {isVisible && (
        <Modal
          transparent
          visible={isVisible}
          animationType="fade"
          onRequestClose={handleClose}
        >
          <TouchableWithoutFeedback onPress={handleClose}>
            <View style={{ 
              flex: 1, 
              justifyContent: position === 'top' ? 'flex-start' : 'flex-end',
              alignItems: 'center',
              paddingBottom: position === 'bottom' ? 100 : 0,
              paddingTop: position === 'top' ? 100 : 0,
            }}>
              <TouchableWithoutFeedback>
                <View style={{
                  backgroundColor: colors.inverseSurface,
                  borderRadius: tokens.radius.md,
                  paddingHorizontal: tokens.spacing.md,
                  paddingVertical: tokens.spacing.sm,
                  maxWidth: '80%',
                  elevation: 4,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.25,
                  shadowRadius: 4,
                }}>
                  {typeof content === 'string' ? (
                    <Text style={{ 
                      color: colors.inverseOnSurface, 
                      fontSize: 14,
                      lineHeight: 20,
                    }}>
                      {content}
                    </Text>
                  ) : (
                    content
                  )}
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}
    </>
  );
};
