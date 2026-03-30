import React, { useEffect, useState } from 'react'
import styles from './TitleBar.module.css'

export const TitleBar: React.FC = () => {
  const [platform, setPlatform] = useState<string>('win32')

  useEffect(() => {
    // Assuming electron context bridge exposes platform info
    // window.api.getPlatform()
    if (window.navigator.userAgent.includes('Mac')) {
      setPlatform('darwin')
    }
  }, [])

  const handleMinimize = () => {
    /* window.api.minimize() */
  }
  const handleMaximize = () => {
    /* window.api.maximize() */
  }
  const handleClose = () => {
    /* window.api.close() */
  }

  return (
    <div className={`${styles.titlebar} ${platform === 'darwin' ? styles.mac : styles.win}`}>
      <div className={styles.dragRegion}></div>
      {platform === 'win32' && (
        <div className={styles.windowControls}>
          <button className={styles.controlBtn} onClick={handleMinimize}>
            &#xE921;
          </button>
          <button className={styles.controlBtn} onClick={handleMaximize}>
            &#xE922;
          </button>
          <button className={`${styles.controlBtn} ${styles.closeBtn}`} onClick={handleClose}>
            &#xE8BB;
          </button>
        </div>
      )}
    </div>
  )
}
