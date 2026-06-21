import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MdHelpOutline } from 'react-icons/md'
import { Modal } from '../Modal/Modal'
import { mergeSettingsHelpButtonHandlers } from '../shared/settingsInlineHelpBlock'
import styles from './WorkspaceScopeHelpTooltip.module.css'

export interface WorkspaceScopeHelpTooltipProps {
  size?: number
  className?: string
}

function WorkspaceScopeHelpBody() {
  const { t } = useTranslation()

  return (
    <div className={styles.helpContent}>
      <p className={styles.intro}>
        {t(
          'workspace.help_intro',
          '每个工作空间是独立的本地数据区。切换后会刷新页面，并加载该空间内的内容。'
        )}
      </p>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>
          {t('workspace.help_per_vault_title', '切换工作空间后会变')}
        </h3>
        <ul className={styles.list}>
          <li>{t('workspace.help_per_vault_diary', '日记与日记附件')}</li>
          <li>{t('workspace.help_per_vault_summary', '阶段总结与归档')}</li>
          <li>{t('workspace.help_per_vault_agent', '伙伴配置与聊天记录')}</li>
          <li>{t('workspace.help_per_vault_attachments', '附件库与回忆画廊')}</li>
        </ul>
      </section>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>
          {t('workspace.help_global_title', '切换工作空间后不变')}
        </h3>
        <ul className={styles.list}>
          <li>{t('workspace.help_global_ui', '主题、语言等界面设置')}</li>
          <li>{t('workspace.help_global_ai', 'AI 服务商、模型与 RAG 等配置')}</li>
          <li>{t('workspace.help_global_profile', '昵称、身份卡与用户头像')}</li>
          <li>{t('workspace.help_global_registry', '工作空间列表与存储位置')}</li>
        </ul>
      </section>
    </div>
  )
}

/** Help icon — click to open a readable scope dialog (workspace switch). */
export const WorkspaceScopeHelpTooltip: React.FC<WorkspaceScopeHelpTooltipProps> = ({
  size = 16,
  className = ''
}) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className={`${styles.helpBtn} ${className}`.trim()}
        aria-label={t('workspace.help_aria', '工作空间作用范围说明')}
        {...mergeSettingsHelpButtonHandlers(() => setOpen(true))}
      >
        <MdHelpOutline size={size} className={styles.helpIcon} aria-hidden />
      </button>
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={t('workspace.help_modal_title', '工作空间说明')}
        closeOnOverlayClick
        className={styles.helpModal}
        zIndex={10050}
      >
        <WorkspaceScopeHelpBody />
      </Modal>
    </>
  )
}
