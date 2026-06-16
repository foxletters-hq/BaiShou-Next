import React, { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useSettingsStore } from '@baishou/store'
import { SettingsContentView } from './SettingsContentView'
import { getSettingsRouteSegment, SETTINGS_HUB_PREFIX } from './settings-route.util'
import './SettingsPage.css'
import styles from './SettingsHubPage.module.css'

/** 日记区内嵌设置（/hub/*）：仅右侧内容，导航由主导航侧栏承担 */
export const SettingsHubPage: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const settings = useSettingsStore()
  const loadConfig = useSettingsStore((s) => s.loadConfig)
  const contentKey = getSettingsRouteSegment(location.pathname)

  useEffect(() => {
    void loadConfig()
  }, [loadConfig])

  useEffect(() => {
    if (location.pathname === SETTINGS_HUB_PREFIX) {
      navigate(`${SETTINGS_HUB_PREFIX}/general`, { replace: true })
    }
  }, [location.pathname, navigate])

  return (
    <div className={styles.hubPage}>
      <div className={styles.hubContent}>
        <AnimatePresence mode="wait">
          <SettingsContentView
            key={contentKey}
            pathname={location.pathname}
            settings={settings}
            motionKey={contentKey}
          />
        </AnimatePresence>
      </div>
    </div>
  )
}
