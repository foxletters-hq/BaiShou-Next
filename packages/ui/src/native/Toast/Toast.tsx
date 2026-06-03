import React, { createContext, useContext, useState, useRef, useCallback } from 'react'
import { Animated, Text, View, PanResponder, StyleSheet, Pressable } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNativeTheme } from '../theme'

export type ToastType = 'info' | 'success' | 'error' | 'warning'

interface ToastPayload {
  message: string
  type: ToastType
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void
  showSuccess: (message: string) => void
  showError: (message: string) => void
  showInfo: (message: string) => void
  showWarning: (message: string) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

const ICON_BY_TYPE: Record<ToastType, keyof typeof MaterialIcons.glyphMap> = {
  success: 'check-circle-outline',
  error: 'error-outline',
  info: 'info-outline',
  warning: 'warning-amber'
}

const COLOR_BY_TYPE: Record<ToastType, string> = {
  success: '#16A34A',
  error: '#DC2626',
  info: '#2563EB',
  warning: '#D97706'
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { colors, isDark } = useNativeTheme()
  const insets = useSafeAreaInsets()
  const [toastData, setToastData] = useState<ToastPayload | null>(null)
  const opacity = useRef(new Animated.Value(0)).current
  const translateX = useRef(new Animated.Value(40)).current
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dismissToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: 20, duration: 200, useNativeDriver: true })
    ]).start(() => {
      setToastData(null)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    })
  }, [opacity, translateX])

  const presentToast = useCallback(
    (msg: string, type: ToastType = 'info') => {
      setToastData({ message: msg, type })
      opacity.setValue(0)
      translateX.setValue(40)

      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: 0, duration: 350, useNativeDriver: true })
      ]).start()

      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => dismissToast(), type === 'error' ? 5000 : 3000)
    },
    [dismissToast, opacity, translateX]
  )

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderRelease: (_e, gestureState) => {
        if (gestureState.vx > 1.0 || gestureState.dx > 40) {
          dismissToast()
        }
      }
    })
  ).current

  const ctx: ToastContextType = {
    showToast: presentToast,
    showSuccess: (message) => presentToast(message, 'success'),
    showError: (message) => presentToast(message, 'error'),
    showInfo: (message) => presentToast(message, 'info'),
    showWarning: (message) => presentToast(message, 'warning')
  }

  const iconColor = toastData ? COLOR_BY_TYPE[toastData.type] : colors.primary

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      {toastData ? (
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.host,
            {
              top: insets.top + 12,
              opacity,
              transform: [{ translateX }]
            }
          ]}
        >
          <Pressable onPress={dismissToast}>
            <View
              style={[
                styles.toast,
                {
                  backgroundColor: isDark ? '#242424' : colors.bgSurface,
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
                }
              ]}
            >
              <MaterialIcons name={ICON_BY_TYPE[toastData.type]} size={18} color={iconColor} />
              <Text style={[styles.message, { color: colors.textPrimary }]}>
                {toastData.message}
              </Text>
            </View>
          </Pressable>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  )
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    right: 16,
    left: 16,
    alignItems: 'flex-end',
    zIndex: 9999,
    pointerEvents: 'box-none'
  },
  toast: {
    maxWidth: '100%',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  message: {
    fontSize: 14,
    fontWeight: '500',
    flexShrink: 1,
    lineHeight: 20
  }
})

export const useNativeToast = () => {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useNativeToast must be used within ToastProvider')
  return ctx
}
