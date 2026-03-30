import React, { createContext, useContext, useState, useRef } from 'react';
import { Animated, Text, View, PanResponder } from 'react-native';
import { useNativeTheme } from '../theme';

interface ToastContextType {
  showToast: (message: string, type?: 'info' | 'success' | 'error') => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { colors, tokens, isDark } = useNativeTheme();
  const [toastData, setToastData] = useState<{message: string, type: string} | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(100)).current;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const dismissToast = () => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: 100, duration: 200, useNativeDriver: true })
    ]).start(() => {
        setToastData(null);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderRelease: (e, gestureState) => {
        if (gestureState.vx > 1.0 || gestureState.dx > 40) {
           dismissToast();
        }
      }
    })
  ).current;

  const showToast = (msg: string, type = 'info') => {
    setToastData({message: msg, type});
    opacity.setValue(0);
    translateX.setValue(100);
    
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: 0, duration: 300, useNativeDriver: true })
    ]).start();

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      dismissToast();
    }, type === 'error' ? 5000 : 3000);
  };

  const getIconColor = () => {
    if (toastData?.type === 'success') return '#16A34A';
    if (toastData?.type === 'error') return '#DC2626';
    return colors.primary;
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toastData && (
        <Animated.View 
          {...panResponder.panHandlers}
          style={{
          position: 'absolute',
          top: 40,
          right: 16,
          alignItems: 'flex-end',
          opacity,
          transform: [{ translateX }],
          zIndex: 9999,
        }}>
          <View style={{
            backgroundColor: isDark ? '#1C2936' : colors.bgSurface,
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderRadius: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 16,
            elevation: 8,
            borderWidth: 1,
            borderColor: 'rgba(158, 158, 158, 0.1)',
            maxWidth: '80%' // Roughly matches Flutter 0.7 * screen width
          }}>
            <Text style={{ color: getIconColor(), fontSize: 18, fontWeight: 'bold' }}>
              {toastData.type === 'error' ? '!' : (toastData.type === 'success' ? '✓' : 'i')}
            </Text>
            <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '500', flexShrink: 1 }}>
              {toastData.message}
            </Text>
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
