import React, { useEffect, useRef, useSyncExternalStore } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Sidebar } from '../components/Sidebar'
import styles from './MainLayout.module.css'
import { MainPageCache, getMainPageCacheKey } from './MainPageCache'
import { isSettingsHubPath } from '../features/settings/settings-route.util'
import {
  getDesktopVaultScopeRevision,
  subscribeDesktopVaultScope
} from '../cache/desktop-vault-scope'
import { useDesktopSettingsOverlay } from './desktop-settings-overlay.context'

export const MainLayout: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const settingsOverlayOpen = useDesktopSettingsOverlay()
  const vaultScopeRevision = useSyncExternalStore(
    subscribeDesktopVaultScope,
    getDesktopVaultScopeRevision
  )
  const cacheKey = getMainPageCacheKey(location.pathname)
  const showOutlet = cacheKey === null
  const hideCacheForSubRoute =
    showOutlet &&
    (location.pathname.startsWith('/diary/') || location.pathname.startsWith('/summary/'))

  // 当处于日记编辑或总结详情等二级子页面时，保持对应底座页面挂载，但隐藏以免与 Outlet 叠层闪烁
  let activeCacheKey = cacheKey
  if (location.pathname.startsWith('/chat')) {
    activeCacheKey = '/chat'
  } else if (location.pathname.startsWith('/diary/')) {
    activeCacheKey = '/diary'
  } else if (location.pathname.startsWith('/summary/')) {
    activeCacheKey = '/summary'
  } else if (isSettingsHubPath(location.pathname)) {
    activeCacheKey = '/hub'
  }

  const prevVaultScopeRevisionRef = useRef(vaultScopeRevision)

  useEffect(() => {
    if (prevVaultScopeRevisionRef.current === vaultScopeRevision) return
    prevVaultScopeRevisionRef.current = vaultScopeRevision
    if (vaultScopeRevision === 0) return

    if (location.pathname.startsWith('/diary/') || location.pathname.startsWith('/summary/')) {
      navigate(location.pathname.startsWith('/summary/') ? '/summary' : '/diary', { replace: true })
    }
  }, [vaultScopeRevision, location.pathname, navigate])

  return (
    <div className={styles.appContainer}>
      <div className={styles.mainContent}>
        <Sidebar />
        <div className={styles.pageContent}>
          <MainPageCache
            activeKey={activeCacheKey}
            vaultScopeRevision={vaultScopeRevision}
            hideActiveWhenOverlay={hideCacheForSubRoute || settingsOverlayOpen}
          />

          <AnimatePresence mode="wait">
            {showOutlet && (
              <motion.div
                key={location.pathname.startsWith('/chat') ? '/chat' : location.pathname}
                initial={{ opacity: 1, y: 0 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 1, y: 0 }}
                transition={{ duration: 0 }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  zIndex: 10
                }}
              >
                <Outlet />
              </motion.div>
            )}
          </AnimatePresence>

          {/* 原版白守渐变过渡：切换任意底座根路由时展示一个瞬发并淡出的背景遮罩层以统一视效 */}
          <motion.div
            key={location.pathname.split('/')[1] || 'home'}
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'var(--bg-app)',
              pointerEvents: 'none',
              zIndex: 50
            }}
          />
        </div>
      </div>
    </div>
  )
}
