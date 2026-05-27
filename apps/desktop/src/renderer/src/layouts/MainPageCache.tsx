import React, { useEffect, useRef, useState } from 'react'
import { motion, useAnimation } from 'framer-motion'
import { DiaryPage } from '../features/diary/DiaryPage'
import { SummaryPage } from '../features/summary/SummaryPage'
import { LanTransferPage } from '../features/settings/LanTransferPage'
import { CloudSyncPage } from '../features/settings/CloudSyncPage'
import { IncrementalSyncPage } from '../features/settings/IncrementalSyncPage'
import { GitManagementPage } from '../features/settings/GitManagementPage'
import {
  consumeDiaryReturnReveal,
  DIARY_RETURN_REVEAL_TRANSITION
} from '../features/diary/diary-navigation'
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
  Component: React.ComponentType
}> = ({ cacheKey, isActive, Component }) => {
  const controls = useAnimation()
  const hasEnteredRef = useRef(false)

  useEffect(() => {
    if (!isActive) return

    if (cacheKey === '/diary' && consumeDiaryReturnReveal()) {
      controls.set({ opacity: 0, y: 22 })
      void controls.start({
        opacity: 1,
        y: 0,
        transition: DIARY_RETURN_REVEAL_TRANSITION
      })
      hasEnteredRef.current = true
      return
    }

    if (!hasEnteredRef.current) {
      hasEnteredRef.current = true
      controls.set({ opacity: 0 })
      void controls.start({ opacity: 1, transition: { duration: 0.35, ease: 'easeOut' } })
    }
  }, [isActive, cacheKey, controls])

  return (
    <motion.div
      className={styles.cachedPage}
      hidden={!isActive}
      aria-hidden={!isActive}
      initial={false}
      animate={controls}
    >
      <Component />
    </motion.div>
  )
}

export const MainPageCache: React.FC<{ activeKey: string | null }> = ({ activeKey }) => {
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
            Component={Component}
          />
        )
      })}
    </>
  )
}

/** 占位路由：实际内容由 MainPageCache 渲染 */
export const CachedRoutePlaceholder: React.FC = () => null
