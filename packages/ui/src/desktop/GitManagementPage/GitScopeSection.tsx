import React from 'react'
import { useTranslation } from 'react-i18next'
import stack from '../shared/SettingsStack.module.css'

const INCLUDED = [
  ['version_control.scope_journals', '日记'],
  ['version_control.scope_archives', '总结'],
  ['version_control.scope_sessions', '会话'],
  ['version_control.scope_graph', '图谱'],
  ['version_control.scope_memory', '记忆'],
  ['version_control.scope_assistants', '助手'],
  ['version_control.scope_attachments', '附件'],
  ['version_control.scope_notebooks', '知识库原文']
] as const

const EXCLUDED = [
  ['version_control.scope_excluded_app', '应用数据'],
  ['version_control.scope_excluded_db', '数据库'],
  ['version_control.scope_excluded_conflict', '冲突备份'],
  ['version_control.scope_excluded_temp', '快照与临时文件']
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
