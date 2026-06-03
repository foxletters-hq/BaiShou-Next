import React, { createContext, useCallback, useContext, useMemo } from 'react'
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useToast } from 'heroui-native'
import type { ToastComponentProps } from 'heroui-native'
import Animated, { Easing, Keyframe } from 'react-native-reanimated'
import { useNativeTheme } from '../theme'

export type ToastType = 'info' | 'success' | 'error' | 'warning'

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

function durationForType(type: ToastType): number {
  if (type === 'error') return 5000
  if (type === 'success') return 3000
  return 2000
}

const toastEnter = new Keyframe({
  0: {
    opacity: 1,
    transform: [{ translateX: 48 }]
  },
  100: {
    opacity: 1,
    transform: [{ translateX: 0 }],
    easing: Easing.out(Easing.cubic)
  }
}).duration(240)

const toastExit = new Keyframe({
  0: {
    opacity: 1,
    transform: [{ translateX: 0 }]
  },
  100: {
    opacity: 1,
    transform: [{ translateX: 48 }],
    easing: Easing.in(Easing.cubic)
  }
}).duration(170)

type BaishouHeroToastProps = ToastComponentProps & {
  message: string
  type: ToastType
}

const BaishouHeroToast: React.FC<BaishouHeroToastProps> = ({ id, message, type, hide }) => {
  const { isDark, colors } = useNativeTheme()
  const { width } = useWindowDimensions()

  return (
    <View style={styles.toastRow} pointerEvents="box-none">
      <Animated.View
        entering={toastEnter}
        exiting={toastExit}
        style={{ maxWidth: Math.min(width * 0.72, 360) }}
      >
        <Pressable
          onPress={() => hide(id)}
          style={[
            styles.toast,
            {
              backgroundColor: isDark ? '#1C2936' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : colors.borderMuted
            }
          ]}
        >
          <MaterialIcons name={ICON_BY_TYPE[type]} size={20} color={COLOR_BY_TYPE[type]} />
          <Text style={[styles.message, { color: isDark ? colors.textPrimary : '#1A1C23' }]}>
            {message}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  )
}

/**
 * 桥接 HeroUI Native Toast，保留项目现有 `useNativeToast` 调用 API。
 * Toast 生命周期和安全区走 Hero；视觉卡片自定义为实心白底 + 右侧短滑入。
 */
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toast } = useToast()

  const presentToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      toast.hide('all')
      toast.show({
        duration: durationForType(type),
        component: (props) => <BaishouHeroToast {...props} message={message} type={type} />
      })
    },
    [toast]
  )

  const ctx = useMemo<ToastContextType>(
    () => ({
      showToast: presentToast,
      showSuccess: (message) => presentToast(message, 'success'),
      showError: (message) => presentToast(message, 'error'),
      showInfo: (message) => presentToast(message, 'info'),
      showWarning: (message) => presentToast(message, 'warning')
    }),
    [presentToast]
  )

  return <ToastContext.Provider value={ctx}>{children}</ToastContext.Provider>
}

const styles = StyleSheet.create({
  toastRow: {
    width: '100%',
    alignItems: 'flex-end'
  },
  toast: {
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 10
  },
  message: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500'
  }
})

export const useNativeToast = () => {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useNativeToast must be used within ToastProvider')
  return ctx
}
