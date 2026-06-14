import React, { useEffect, useState } from 'react'
import { motion, useAnimation } from 'framer-motion'
import { DiaryPage } from '../features/diary/DiaryPage'
import { SummaryPage } from '../features/summary/SummaryPage'
import { LanTransferPage } from '../features/settings/LanTransferPage'
import { CloudSyncPage } from '../features/settings/CloudSyncPage'
import { IncrementalSyncPage } from '../features/settings/IncrementalSyncPage'
import { GitManagementPage } from '../features/settings/GitManagementPage'
import styles from './MainLayout.module.css'
/** 侧边栏主页面：切换时保持挂载，避免重复加载数据 */
export const MAIN_PAGE_CACHE: Record<string, React.ComponentType> = {
  '/diary': DiaryPage,
  '/summary': SummaryPage,
  '/lan-transfer': LanTransferPage,
  '/data-sync': CloudSyncPage,
  '/incremental-sync': IncrementalSyncPage,
  '/git': GitManagementPage
}

export function getMainPageCacheKey(pathname: string): string | null {
  if (pathname in MAIN_PAGE_CACHE) return pathname
  return null
}

const CachedPageLayer: React.FC<{
  cacheKey: string
  isActive: boolean
  hideWhenOverlay: boolean
  Component: React.ComponentType
}> = ({ cacheKey, isActive, hideWhenOverlay, Component }) => {
  const controls = useAnimation()

  useEffect(() => {
    if (!isActive) return

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
  }, [isActive, cacheKey, controls])

  return (
    <motion.div
      className={styles.cachedPage}
      hidden={!isActive || hideWhenOverlay}
      aria-hidden={!isActive || hideWhenOverlay}
      initial={false}
      animate={controls}
    >
      <Component />
    </motion.div>
  )
}

export const MainPageCache: React.FC<{
  activeKey: string | null
  hideActiveWhenOverlay?: boolean
}> = ({ activeKey, hideActiveWhenOverlay = false }) => {
  const [mountedKeys, setMountedKeys] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    if (activeKey) initial.add(activeKey)
    return initial
  })

  useEffect(() => {
    if (!activeKey) return
    setMountedKeys((prev) => {
      if (prev.has(activeKey)) return prev
      const next = new Set(prev)
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
            key={key}
            cacheKey={key}
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
