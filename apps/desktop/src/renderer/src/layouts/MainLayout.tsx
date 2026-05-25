import React from 'react'
import { Outlet, useLocation } from 'react-router-dom'
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
          {showOutlet && <Outlet />}
        </div>
      </div>
    </div>
  )
}
