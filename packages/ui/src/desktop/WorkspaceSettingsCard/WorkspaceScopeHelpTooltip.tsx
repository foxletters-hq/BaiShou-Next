import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../Modal/Modal'
import { SettingsHelpIconButton } from '../HelpTooltip/SettingsHelpIconButton'
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
          '小窝是你与伙伴共同生活的独立空间。如果你有多个伙伴，可以创建并切换不同的小窝——切换小窝后，对应的伙伴、日记、记忆与全部专属数据都会一并切换。'
        )}
      </p>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>
          {t('workspace.help_per_vault_title', '切换小窝后会随之切换')}
        </h3>
        <ul className={styles.list}>
          <li>{t('workspace.help_per_vault_agent', '伙伴人设、记忆、关系图谱与聊天记录')}</li>
          <li>{t('workspace.help_per_vault_diary', '日记与日记附件')}</li>
          <li>{t('workspace.help_per_vault_summary', '阶段总结与归档')}</li>
          <li>{t('workspace.help_per_vault_attachments', '附件库与回忆画廊')}</li>
        </ul>
      </section>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>
          {t('workspace.help_global_title', '切换小窝后不变')}
        </h3>
        <ul className={styles.list}>
          <li>{t('workspace.help_global_ui', '主题、语言等界面设置')}</li>
          <li>{t('workspace.help_global_ai', 'AI 服务商、模型与 RAG 等配置')}</li>
          <li>{t('workspace.help_global_profile', '昵称、身份卡与用户头像')}</li>
          <li>{t('workspace.help_global_registry', '小窝列表与存储位置')}</li>
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
      <SettingsHelpIconButton
        aria-label={t('workspace.help_aria', '小窝作用范围说明')}
        size={size}
        className={className}
        onActivate={() => setOpen(true)}
      />
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={t('workspace.help_modal_title', '小窝说明')}
        closeOnOverlayClick
        className={styles.helpModal}
        zIndex={10050}
      >
        <WorkspaceScopeHelpBody />
      </Modal>
    </>
  )
}
