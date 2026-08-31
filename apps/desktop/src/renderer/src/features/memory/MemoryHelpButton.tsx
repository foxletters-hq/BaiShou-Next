import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, SettingsHelpIconButton } from '@baishou/ui'
import { MemoryNotebookNotice } from './MemoryNotebookNotice'
import styles from './MemoryHelpButton.module.css'

export const MemoryHelpButton: React.FC<{ size?: number; className?: string }> = ({
  size = 16,
  className = ''
}) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <>
      <SettingsHelpIconButton
        aria-label={t('memory.help_aria', '关于全局 AI 记忆')}
        size={size}
        className={className}
        onActivate={() => setOpen(true)}
      />
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={t('memory.help_modal_title', '记忆说明')}
        closeOnOverlayClick
        className={styles.helpModal}
        zIndex={10050}
      >
        <div className={styles.helpContent}>
          <p className={styles.intro}>
            {t(
              'memory.lead',
              '日记和伙伴共用这一套记忆。片段保存原文，用于回忆细节；关系保存联系，用于理清脉络。笔记本资料的向量和关系图在各自笔记本里管理，不并入这里。'
            )}
          </p>
          <MemoryNotebookNotice onOpen={() => setOpen(false)} />
        </div>
      </Modal>
    </>
  )
}
