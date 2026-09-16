import i18n from 'i18next'
import React from 'react'
import { useTranslation } from 'react-i18next'
import stack from '../shared/SettingsStack.module.css'

const INCLUDED = [
  [
    'version_control.scope_journals',
    i18n.t('auto.packages.ui.src.desktop.GitManagementPage.GitScopeSection.L6', '日记')
  ],
  [
    'version_control.scope_archives',
    i18n.t('auto.packages.ui.src.desktop.GitManagementPage.GitScopeSection.L7', '总结')
  ],
  [
    'version_control.scope_sessions',
    i18n.t('auto.packages.ui.src.desktop.GitManagementPage.GitScopeSection.L8', '会话')
  ],
  [
    'version_control.scope_graph',
    i18n.t('auto.packages.ui.src.desktop.GitManagementPage.GitScopeSection.L9', '图谱')
  ],
  [
    'version_control.scope_memory',
    i18n.t('auto.packages.ui.src.desktop.GitManagementPage.GitScopeSection.L10', '记忆')
  ],
  [
    'version_control.scope_assistants',
    i18n.t('auto.packages.ui.src.desktop.GitManagementPage.GitScopeSection.L11', '助手')
  ],
  [
    'version_control.scope_attachments',
    i18n.t('auto.packages.ui.src.desktop.GitManagementPage.GitScopeSection.L12', '附件')
  ],
  [
    'version_control.scope_notebooks',
    i18n.t('auto.packages.ui.src.desktop.GitManagementPage.GitScopeSection.L13', '知识库原文')
  ]
] as const

const EXCLUDED = [
  [
    'version_control.scope_excluded_app',
    i18n.t('auto.packages.ui.src.desktop.GitManagementPage.GitScopeSection.L17', '应用数据')
  ],
  [
    'version_control.scope_excluded_db',
    i18n.t('auto.packages.ui.src.desktop.GitManagementPage.GitScopeSection.L18', '数据库')
  ],
  [
    'version_control.scope_excluded_conflict',
    i18n.t('auto.packages.ui.src.desktop.GitManagementPage.GitScopeSection.L19', '冲突备份')
  ],
  [
    'version_control.scope_excluded_temp',
    i18n.t('auto.packages.ui.src.desktop.GitManagementPage.GitScopeSection.L20', '快照与临时文件')
  ]
] as const

export const GitScopeSection: React.FC = () => {
  const { t } = useTranslation()

  return (
    <div className={stack.stackGroup}>
      <div className={stack.sectionLabelRow}>
        <h3 className={stack.sectionLabel}>{t('version_control.scope_title', '管理范围')}</h3>
      </div>
      <section className={stack.cardSection}>
        <div className="gmp-section-body">
          <p className="gmp-scope-lead">
            {t('version_control.scope_lead', '跟踪各工作区的写作与原文。仅桌面端提供。')}
          </p>
          <div className="gmp-scope-row">
            <span className="gmp-scope-heading">{t('version_control.scope_included', '纳入')}</span>
            <div className="gmp-scope-chips">
              {INCLUDED.map(([key, fallback]) => (
                <span key={key} className="gmp-scope-chip">
                  {t(key, fallback)}
                </span>
              ))}
            </div>
          </div>
          <div className="gmp-scope-row">
            <span className="gmp-scope-heading">
              {t('version_control.scope_excluded', '不纳入')}
            </span>
            <div className="gmp-scope-chips">
              {EXCLUDED.map(([key, fallback]) => (
                <span key={key} className="gmp-scope-chip gmp-scope-chip-muted">
                  {t(key, fallback)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
