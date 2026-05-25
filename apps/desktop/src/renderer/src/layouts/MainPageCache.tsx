import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
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
        const isActive = key === activeKey
        return (
          <motion.div
            key={key}
            className={styles.cachedPage}
            hidden={!isActive}
            aria-hidden={!isActive}
            initial={{ opacity: 0 }}
            animate={isActive ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            <Component />
          </motion.div>
        )
      })}
    </>
  )
}

/** 占位路由：实际内容由 MainPageCache 渲染 */
export const CachedRoutePlaceholder: React.FC = () => null
