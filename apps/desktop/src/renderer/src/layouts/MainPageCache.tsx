import React, { useEffect, useState, createContext } from 'react'
import { motion, useAnimation } from 'framer-motion'
import { DiaryPage } from '../features/diary/DiaryPage'
import { SummaryPage } from '../features/summary/SummaryPage'
import { CloudSyncPage } from '../features/settings/CloudSyncPage'
import { IncrementalSyncPage } from '../features/settings/IncrementalSyncPage'
import { GitManagementPage } from '../features/settings/GitManagementPage'
import { SettingsHubPage } from '../features/settings/SettingsHubPage'
import { AgentChatCachedPage } from '../features/agent/AgentChatCachedPage'
import { isSettingsHubPath } from '../features/settings/settings-route.util'
import styles from './MainLayout.module.css'
import { MainPageCacheActiveContext } from './main-page-cache.context'

export { MainPageCacheActiveContext } from './main-page-cache.context'

/** 离开路由后仍保持挂载，便于日记 ↔ 伙伴快速切换 */
const PERSISTENT_MAIN_PAGE_KEYS = new Set(['/diary', '/chat'])

/** 侧边栏主页面：日记/伙伴保活；设置、总结等离开即卸载 */

export const MAIN_PAGE_CACHE: Record<string, React.ComponentType> = {
  '/diary': DiaryPage,
  '/summary': SummaryPage,
  '/data-sync': CloudSyncPage,
  '/incremental-sync': IncrementalSyncPage,
  '/git': GitManagementPage,
  '/hub': SettingsHubPage,
  '/chat': AgentChatCachedPage
}

export function getMainPageCacheKey(pathname: string): string | null {
  if (pathname in MAIN_PAGE_CACHE) return pathname
  if (pathname.startsWith('/chat')) return '/chat'
  if (isSettingsHubPath(pathname)) return '/hub'
  return null
}

const CachedPageLayer: React.FC<{
  cacheKey: string
  vaultScopeRevision: number
  isActive: boolean
  hideWhenOverlay: boolean
  Component: React.ComponentType
}> = ({ cacheKey, vaultScopeRevision, isActive, hideWhenOverlay, Component }) => {
  const controls = useAnimation()
  const layerActive = isActive && !hideWhenOverlay

  useEffect(() => {
    if (!layerActive) return

    let cancelled = false

    const reveal = async () => {
      if (!cancelled) {
        await controls.start({
          opacity: 1,
          y: 0,
          transition: { duration: 0 }
        })
      }
    }
    void reveal()

    return () => {
      cancelled = true
    }
  }, [layerActive, cacheKey, vaultScopeRevision, controls])

  return (
    <motion.div
      key={`${cacheKey}:${vaultScopeRevision}`}
      className={styles.cachedPage}
      hidden={!layerActive}
      aria-hidden={!layerActive}
      initial={false}
      animate={controls}
    >
      <MainPageCacheActiveContext.Provider value={layerActive}>
        <Component />
      </MainPageCacheActiveContext.Provider>
    </motion.div>
  )
}

export const MainPageCache: React.FC<{
  activeKey: string | null
  vaultScopeRevision: number
  hideActiveWhenOverlay?: boolean
}> = ({ activeKey, vaultScopeRevision, hideActiveWhenOverlay = false }) => {
  const [mountedKeys, setMountedKeys] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    if (activeKey) initial.add(activeKey)
    return initial
  })

  useEffect(() => {
    if (!activeKey) return
    setMountedKeys((prev) => {
      const next = new Set<string>()
      for (const key of prev) {
        if (PERSISTENT_MAIN_PAGE_KEYS.has(key)) {
          next.add(key)
        }
      }
      next.add(activeKey)
      return next
    })
  }, [activeKey])

  return (
    <>
      {[...mountedKeys].map((key) => {
        const Component = MAIN_PAGE_CACHE[key]
        if (!Component) return null
        return (
          <CachedPageLayer
            key={`${key}:${vaultScopeRevision}`}
            cacheKey={key}
            vaultScopeRevision={vaultScopeRevision}
            isActive={key === activeKey}
            hideWhenOverlay={hideActiveWhenOverlay && key === activeKey}
            Component={Component}
          />
        )
      })}
    </>
  )
}

/** 占位路由：实际内容由 MainPageCache 渲染 */
export const CachedRoutePlaceholder: React.FC = () => null
