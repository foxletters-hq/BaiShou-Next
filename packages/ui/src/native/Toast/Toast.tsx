import React, { createContext, useContext, useState, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import { useNativeTheme } from '../theme';

interface ToastContextType {
  showToast: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { colors, tokens } = useNativeTheme();
  const [message, setMessage] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;

  const showToast = (msg: string) => {
    setMessage(msg);
    opacity.setValue(0);
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true })
    ]).start(() => setMessage(null));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {message && (
        <Animated.View style={{
          position: 'absolute',
          bottom: 50,
          left: 20,
          right: 20,
          alignItems: 'center',
          opacity,
          pointerEvents: 'none',
        }}>
          <View style={{
            backgroundColor: colors.textPrimary,
            paddingHorizontal: tokens.spacing.lg,
            paddingVertical: tokens.spacing.sm,
            borderRadius: tokens.radius.full,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            elevation: 3
          }}>
            <Text style={{ color: colors.bgSurface, fontSize: 14 }}>{message}</Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
};

export const useNativeToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useNativeToast must be used within ToastProvider');
  return ctx;
};
