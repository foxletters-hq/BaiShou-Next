import React from 'react'
import { useTranslation } from 'react-i18next'
import type { AgentWorkspaceEntry } from '@baishou/shared'
import {
  getWorkspaceAvatarTone,
  getWorkspaceInitialLabel,
  resolveWorkspaceAvatarSrc
} from '../../utils/workspace-display.util'
import styles from './WorkbenchRecentProjects.module.css'

const AVATAR_TONE_CLASS: Record<ReturnType<typeof getWorkspaceAvatarTone>, string> = {
  cyan: styles.avatarCyan,
  blue: styles.avatarBlue,
  green: styles.avatarGreen,
  orange: styles.avatarOrange,
  pink: styles.avatarPink,
  purple: styles.avatarPurple,
  red: styles.avatarRed,
  gray: styles.avatarGray
}

function shortenPath(path: string, max = 36): string {
  const normalized = path.replace(/\\/g, '/')
  if (normalized.length <= max) return normalized
  return `…${normalized.slice(-(max - 1))}`
}

export interface WorkbenchRecentProjectsProps {
  workspaces: AgentWorkspaceEntry[]
  onOpen: (workspaceId: string) => void
  onViewAll?: () => void
  loading?: boolean
}

export const WorkbenchRecentProjects: React.FC<WorkbenchRecentProjectsProps> = ({
  workspaces,
  onOpen,
  onViewAll,
  loading
}) => {
  const { t } = useTranslation()
  const recent = workspaces.slice(0, 6)

  return (
    <section
      className={styles.section}
      aria-label={t('workbench.home_recent_projects', '最近项目')}
    >
      <div className={styles.head}>
        <h3 className={styles.title}>{t('workbench.home_recent_projects', '最近项目')}</h3>
        {onViewAll ? (
          <button type="button" className={styles.viewAll} onClick={onViewAll}>
            {t('workbench.home_view_all', '查看全部')}
          </button>
        ) : null}
      </div>

      {loading ? (
        <p className={styles.empty}>{t('common.loading', '加载中...')}</p>
      ) : recent.length === 0 ? (
        <p className={styles.empty}>{t('workbench.home_empty_dirs_title', '还没有工作目录')}</p>
      ) : (
        <ul className={styles.grid}>
          {recent.map((ws) => {
            const avatarSrc = resolveWorkspaceAvatarSrc(ws.avatarPath)
            const toneClass =
              AVATAR_TONE_CLASS[getWorkspaceAvatarTone(ws.folderRoot || ws.displayName)]
            return (
              <li key={ws.id}>
                <button type="button" className={styles.card} onClick={() => onOpen(ws.id)}>
                  <span className={`${styles.avatar} ${toneClass}`} aria-hidden>
                    {avatarSrc ? (
                      <img src={avatarSrc} alt="" />
                    ) : (
                      <span className={styles.initial}>
                        {getWorkspaceInitialLabel(ws.displayName)}
                      </span>
                    )}
                  </span>
                  <p className={styles.name}>{ws.displayName}</p>
                  <p className={styles.path}>{shortenPath(ws.folderRoot)}</p>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
