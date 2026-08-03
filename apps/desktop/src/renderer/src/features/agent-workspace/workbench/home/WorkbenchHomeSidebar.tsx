import React from 'react'
import { useTranslation } from 'react-i18next'
import { BookMarked, FolderKanban, Home, Plus, Settings, LayoutTemplate } from 'lucide-react'
import appIcon from '@baishou/shared/assets/images/icon.png'
import styles from './WorkbenchHomeSidebar.module.css'

export type WorkbenchHomeNavId = 'home' | 'knowledge' | 'templates' | 'projects' | null

export interface WorkbenchHomeSidebarProps {
  activeNav?: WorkbenchHomeNavId
  onNewProject: () => void
  onOpenHome: () => void
  onOpenKnowledge: () => void
  onOpenTemplates: () => void
  onOpenProjects: () => void
  onOpenSettings: () => void
  creating?: boolean
}

export const WorkbenchHomeSidebar: React.FC<WorkbenchHomeSidebarProps> = ({
  activeNav = null,
  onNewProject,
  onOpenHome,
  onOpenKnowledge,
  onOpenTemplates,
  onOpenProjects,
  onOpenSettings,
  creating
}) => {
  const { t } = useTranslation()

  return (
    <aside className={styles.sidebar} aria-label={t('nav.workbench', '工作台')}>
      {/* 与日记侧栏 .brandRow 同结构：Logo + 标题垂直居中 */}
      <div className={styles.brandRow}>
        <div className={styles.logoBox}>
          <img src={appIcon} alt="" className={styles.brandLogo} />
        </div>
        <div className={styles.brandText}>
          <div className={styles.brandName}>{t('nav.workbench', '工作台')}</div>
          <div className={styles.brandSlogan}>
            {t('workbench.home_brand_subtitle', '与伙伴一起创作')}
          </div>
        </div>
      </div>

      <div className={styles.menuContainer}>
        <div className={styles.newProjectWrapper}>
          <button
            type="button"
            className={styles.newProjectBtn}
            onClick={onNewProject}
            disabled={creating}
          >
            <Plus size={18} />
            <span>{t('workbench.home_new_project', '新建项目')}</span>
          </button>
        </div>

        <nav className={styles.navList} aria-label={t('workbench.home_nav', '工作台导航')}>
          <button
            type="button"
            className={`${styles.navItem} ${activeNav === 'home' ? styles.selected : ''}`}
            onClick={onOpenHome}
          >
            <span className={styles.navLead} aria-hidden />
            <span className={styles.navIcon} aria-hidden>
              <Home size={18} />
            </span>
            <span className={styles.navLabel}>{t('workbench.home_nav_home', '首页')}</span>
          </button>
          <button
            type="button"
            className={`${styles.navItem} ${activeNav === 'knowledge' ? styles.selected : ''}`}
            onClick={onOpenKnowledge}
          >
            {/* 对应日记侧栏隐藏的拖拽手柄占位，保证文字起点一致 */}
            <span className={styles.navLead} aria-hidden />
            <span className={styles.navIcon} aria-hidden>
              <BookMarked size={18} />
            </span>
            <span className={styles.navLabel}>{t('workbench.home_knowledge', '知识库')}</span>
          </button>
          <button
            type="button"
            className={`${styles.navItem} ${activeNav === 'templates' ? styles.selected : ''}`}
            onClick={onOpenTemplates}
          >
            <span className={styles.navLead} aria-hidden />
            <span className={styles.navIcon} aria-hidden>
              <LayoutTemplate size={18} />
            </span>
            <span className={styles.navLabel}>{t('workbench.home_templates', '模板')}</span>
          </button>
          <button
            type="button"
            className={`${styles.navItem} ${activeNav === 'projects' ? styles.selected : ''}`}
            onClick={onOpenProjects}
          >
            <span className={styles.navLead} aria-hidden />
            <span className={styles.navIcon} aria-hidden>
              <FolderKanban size={18} />
            </span>
            <span className={styles.navLabel}>{t('workbench.home_projects', '项目')}</span>
          </button>
        </nav>

        <div className={styles.dividerWrapper}>
          <div className={styles.divider} />
        </div>

        <div className={styles.fixedNav}>
          <button type="button" className={styles.navItem} onClick={onOpenSettings}>
            <span className={styles.navIcon} aria-hidden>
              <Settings size={18} />
            </span>
            <span className={styles.navLabel}>{t('workbench.settings', '工作台设置')}</span>
          </button>
        </div>
      </div>
    </aside>
  )
}
