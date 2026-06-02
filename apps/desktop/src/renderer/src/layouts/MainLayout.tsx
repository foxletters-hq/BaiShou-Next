import React from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Sidebar } from '../components/Sidebar'
import styles from './MainLayout.module.css'
import { MainPageCache, getMainPageCacheKey } from './MainPageCache'

export const MainLayout: React.FC = () => {
  const location = useLocation()
  const cacheKey = getMainPageCacheKey(location.pathname)
  const showOutlet = cacheKey === null

  return (
    <div className={styles.appContainer}>
      <div className={styles.mainContent}>
        <Sidebar />
        <div className={styles.pageContent}>
          <MainPageCache activeKey={cacheKey} />

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
