import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../Modal/Modal'
import { SettingsHelpIconButton } from '../HelpTooltip/SettingsHelpIconButton'
import { ContextChainCompressionHelpContent } from './ContextChainCompressionHelp'
import styles from './ContextChainCompressionHelpButton.module.css'

export interface ContextChainCompressionHelpButtonProps {
  size?: number
  className?: string
}

/** 调用链底部「下次请求预计」旁的 ? — 点击打开说明弹窗（与工作空间说明一致） */
export const ContextChainCompressionHelpButton: React.FC<
  ContextChainCompressionHelpButtonProps
> = ({ size = 15, className = '' }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <>
      <SettingsHelpIconButton
        aria-label={t('agent.chat.compression_help_aria', '查看对话压缩规则说明')}
        size={size}
        className={className}
        onActivate={() => setOpen(true)}
      />
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={t('agent.chat.compression_help_modal_title', '对话压缩规则')}
        closeOnOverlayClick
        className={styles.helpModal}
        zIndex={10050}
      >
        <ContextChainCompressionHelpContent t={t} />
      </Modal>
    </>
  )
}
