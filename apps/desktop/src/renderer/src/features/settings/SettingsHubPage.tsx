import React, { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useSettingsStore } from '@baishou/store'
import { SettingsContentView } from './SettingsContentView'
import styles from './SettingsHubPage.module.css'

export const SettingsHubPage: React.FC = () => {
  const location = useLocation()
  const settings = useSettingsStore()

  useEffect(() => {
    settings.loadConfig()
  }, [settings.loadConfig])

  return (
    <div className={styles.hubPage}>
      <SettingsContentView pathname={location.pathname} settings={settings} />
    </div>
  )
}
