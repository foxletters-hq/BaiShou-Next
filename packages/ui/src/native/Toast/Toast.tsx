import React, { createContext, useCallback, useContext, useMemo } from 'react'
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useToast } from 'heroui-native'
import type { ToastComponentProps } from 'heroui-native'
import Animated, { Easing, Keyframe } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
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

const STATUS_TOAST_ID = 'baishou-status-toast'
/** 与 toastExit Keyframe 时长一致；hide 后须等退场结束再 show，避免 Android Reanimated 视图竞态 */
const TOAST_EXIT_MS = 220

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

// 还原 Flutter 原版进入动画：时长 300ms，从屏幕右侧外 translateX: 360 完全淡入滑入
const toastEnter = new Keyframe({
  0: {
    opacity: 0,
    transform: [{ translateX: 360 }]
  },
  100: {
    opacity: 1,
    transform: [{ translateX: 0 }],
    easing: Easing.out(Easing.cubic)
  }
}).duration(300)

// 还原 Flutter 原版退场动画：时长 200ms，向右侧 translateX: 360 完全淡出滑出
const toastExit = new Keyframe({
  0: {
    opacity: 1,
    transform: [{ translateX: 0 }]
  },
  100: {
    opacity: 0,
    transform: [{ translateX: 360 }],
    easing: Easing.in(Easing.cubic)
  }
}).duration(200)

type BaishouHeroToastProps = ToastComponentProps & {
  message: string
  type: ToastType
}

const BaishouHeroToast: React.FC<BaishouHeroToastProps> = ({ id, message, type, hide }) => {
  const { isDark, colors } = useNativeTheme()
  const { width } = useWindowDimensions()

  const toastMaxWidth = Math.min(width * 0.7, 360) // 限制最大宽度为 70% 屏幕宽度
  const topPosition = 12 // 直接设定为原版经典偏移值，配合 InsetsContainer 的 safeArea paddingTop 实现完美高度

  return (
    <View
      style={[
        styles.toastRow,
        {
          width: width, // 宽度等于屏幕物理宽度，绕过第三方没有宽度的 bug 父容器
          top: topPosition
        }
      ]}
      pointerEvents="box-none"
    >
      <Animated.View
        entering={toastEnter}
        exiting={toastExit}
        style={{ maxWidth: toastMaxWidth }} // 仅设置最大宽度约束，实现自适应宽度
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
          <MaterialIcons name={ICON_BY_TYPE[type]} size={18} color={COLOR_BY_TYPE[type]} />
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
 */
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toast, isToastVisible } = useToast()

  const presentToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      const showNext = () => {
        toast.show({
          id: STATUS_TOAST_ID,
          duration: durationForType(type),
          component: (props) => <BaishouHeroToast {...props} message={message} type={type} />
        })
      }

      if (isToastVisible) {
        toast.hide('all')
        setTimeout(showNext, TOAST_EXIT_MS)
        return
      }

      showNext()
    },
    [isToastVisible, toast]
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
    position: 'absolute',
    left: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingRight: 16 // 还原原版靠右 16px 边距
  },
  toast: {
    borderCurve: 'continuous',
    borderRadius: 12, // 还原原版圆角
    borderWidth: 1,
    paddingHorizontal: 16, // 还原原版内边距
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 }, // 还原原版投影
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8
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
