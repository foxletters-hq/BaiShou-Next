import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MdAutoStories, MdOutlineSettings, MdWorkspaces } from 'react-icons/md'
import { resolveDiaryHomePath } from '../../../components/Sidebar/sidebar-preferences'
import { SETTINGS_HUB_PREFIX } from '../../settings/settings-route.util'
import { VaultIconSwitcher } from './VaultIconSwitcher'
import styles from './WorkbenchRail.module.css'

export const WorkbenchRail: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()

  const isWorkbench = location.pathname.startsWith('/agent-workspace')
  const isDiary =
    !location.pathname.startsWith('/chat') &&
    !location.pathname.startsWith('/agent') &&
    !location.pathname.startsWith('/agent-workspace') &&
    !location.pathname.startsWith('/settings')
  const isSettings = location.pathname.startsWith('/settings')

  return (
    <nav className={styles.rail} aria-label={t('nav.workbench', '工作台')}>
      <div className={styles.top}>
        <button
          type="button"
          className={`${styles.railBtn} ${isDiary ? styles.railBtnActive : ''}`}
          title={t('workbench.diary', '日记')}
          onClick={() => navigate(resolveDiaryHomePath())}
        >
          <MdAutoStories size={22} />
        </button>
        <button
          type="button"
          className={`${styles.railBtn} ${isWorkbench ? styles.railBtnActive : ''}`}
          title={t('nav.workbench', '工作台')}
          onClick={() => navigate('/agent-workspace')}
        >
          <MdWorkspaces size={22} />
        </button>
        <button
          type="button"
          className={`${styles.railBtn} ${isSettings ? styles.railBtnActive : ''}`}
          title={t('workbench.settings', '设置')}
          onClick={() => navigate(`${SETTINGS_HUB_PREFIX}/general`)}
        >
          <MdOutlineSettings size={22} />
        </button>
      </div>
      <div className={styles.bottom}>
        <VaultIconSwitcher />
      </div>
    </nav>
  )
}
