import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import { AppState, StyleSheet, Text, View } from 'react-native'
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '@baishou/ui/native'

export interface NetworkStatus {
  /** 设备已连接 Wi-Fi 或蜂窝网络 */
  isConnected: boolean
  /** 是否能访问互联网（可能为 null，表示尚未检测） */
  isInternetReachable: boolean | null
  /** 发送消息、触发云同步等需要联网的操作是否应放行 */
  isOnline: boolean
}

const DEFAULT_STATUS: NetworkStatus = {
  isConnected: true,
  isInternetReachable: true,
  isOnline: true
}

const NetworkContext = createContext<NetworkStatus>(DEFAULT_STATUS)

function resolveNetworkStatus(state: NetInfoState | null): NetworkStatus {
  const isConnected = state?.isConnected ?? true
  const isInternetReachable = state?.isInternetReachable ?? null
  const isOnline = isConnected && (isInternetReachable === null || isInternetReachable === true)
  return { isConnected, isInternetReachable, isOnline }
}

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<NetworkStatus>(DEFAULT_STATUS)

  useEffect(() => {
    let cancelled = false
    let wasOnline: boolean | null = null

    const applyState = (state: NetInfoState) => {
      if (cancelled) return
      const next = resolveNetworkStatus(state)
      setStatus(next)
      // 首次检测到在线，或离线→在线时消费嵌入欠账
      if (next.isOnline && wasOnline !== true) {
        void import('../services/mobile-diary-embed-jobs-consumer.service').then(
          ({ scheduleConsumeDiaryEmbedJobs }) => {
            scheduleConsumeDiaryEmbedJobs(wasOnline === false ? 'network-online' : 'network-ready')
          }
        )
      }
      wasOnline = next.isOnline
    }

    const unsubscribe = NetInfo.addEventListener(applyState)

    void NetInfo.fetch().then(applyState)

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return
      void NetInfo.fetch().then(applyState)
    })

    return () => {
      cancelled = true
      unsubscribe()
      appStateSub.remove()
    }
  }, [])

  const value = useMemo(() => status, [status])

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
}

export function useNetworkStatus(): NetworkStatus {
  return useContext(NetworkContext)
}

/** 预留：后续在布局中挂载即可展示离线提示 */
export function NetworkOfflineBanner() {
  const { isOnline } = useNetworkStatus()
  const insets = useSafeAreaInsets()
  const { colors } = useNativeTheme()
  const { t } = useTranslation()

  if (isOnline) return null

  return (
    <View
      pointerEvents="none"
      style={[
        styles.banner,
        {
          top: insets.top,
          backgroundColor: colors.bgGlassSurface ?? colors.bgSurface,
          borderColor: colors.borderSubtle
        }
      ]}
    >
      <Text style={[styles.bannerText, { color: colors.textSecondary }]}>
        {t('app.network_offline', '当前离线，部分功能不可用')}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 1000,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center'
  },
  bannerText: {
    fontSize: 13,
    fontWeight: '500'
  }
})
