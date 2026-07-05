import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import { useTranslation } from 'react-i18next'
import styles from './NetworkOfflineBanner.module.css'

export interface NetworkStatus {
  isConnected: boolean
  isInternetReachable: boolean | null
  isOnline: boolean
}

const DEFAULT_STATUS: NetworkStatus = {
  isConnected: true,
  isInternetReachable: true,
  isOnline: true
}

const NetworkContext = createContext<NetworkStatus>(DEFAULT_STATUS)

function resolveNetworkStatus(): NetworkStatus {
  const isConnected = typeof navigator !== 'undefined' ? navigator.onLine : true
  return {
    isConnected,
    isInternetReachable: isConnected ? null : false,
    isOnline: isConnected
  }
}

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<NetworkStatus>(DEFAULT_STATUS)

  useEffect(() => {
    const applyState = () => {
      setStatus(resolveNetworkStatus())
    }

    applyState()
    window.addEventListener('online', applyState)
    window.addEventListener('offline', applyState)

    return () => {
      window.removeEventListener('online', applyState)
      window.removeEventListener('offline', applyState)
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
  const { t } = useTranslation()

  if (isOnline) return null

  return (
    <div className={styles.banner} role="status" aria-live="polite">
      {t('app.network_offline', '当前离线，部分功能不可用')}
    </div>
  )
}
