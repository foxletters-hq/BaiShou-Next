import React, { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { SettingsContentView } from './SettingsContentView'
import { getSettingsRouteSegment, SETTINGS_HUB_PREFIX } from './settings-route.util'
import { useRagRuntimeBridge } from './hooks/useRagRuntimeBridge'
import { useSettingsRouteActive } from './hooks/useSettingsRouteActive'
import './SettingsPage.css'
import styles from './SettingsHubPage.module.css'

/** 日记区内嵌设置（/hub/*）：仅右侧内容，导航由主导航侧栏承担 */
export const SettingsHubPage: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const contentKey = getSettingsRouteSegment(location.pathname)

  const settingsRouteActive = useSettingsRouteActive()

  useRagRuntimeBridge(settingsRouteActive)

  useEffect(() => {
    if (location.pathname === SETTINGS_HUB_PREFIX) {
      navigate(`${SETTINGS_HUB_PREFIX}/general`, { replace: true })
    }
  }, [location.pathname, navigate])

  return (
    <div className={styles.hubPage}>
      <div className={styles.hubContent}>
        <SettingsContentView pathname={location.pathname} motionKey={contentKey} />
      </div>
    </div>
  )
}
