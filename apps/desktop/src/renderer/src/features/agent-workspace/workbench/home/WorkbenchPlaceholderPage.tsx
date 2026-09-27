import React from 'react'
import { useTranslation } from 'react-i18next'
import pageStyles from './WorkbenchHomePage.module.css'
import styles from './WorkbenchPlaceholderPage.module.css'

export type WorkbenchPlaceholderSection = 'projects'

export interface WorkbenchPlaceholderPageProps {
  section: WorkbenchPlaceholderSection
}

/** 工作台侧栏二级页占位：正式功能落地前先跳到空白页 */
export const WorkbenchPlaceholderPage: React.FC<WorkbenchPlaceholderPageProps> = ({
  section: _section
}) => {
  const { t } = useTranslation()

  return (
    <div className={pageStyles.page}>
      <main className={pageStyles.main}>
        <div className={styles.empty}>
          <h1 className={styles.title}>{t('workbench.home_projects', '项目')}</h1>
          <p className={styles.desc}>
            {t('workbench.placeholder_projects_desc', '项目列表即将上线，敬请期待。')}
          </p>
        </div>
      </main>
    </div>
  )
}
