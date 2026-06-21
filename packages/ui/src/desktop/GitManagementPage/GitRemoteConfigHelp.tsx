import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MdHelpOutline } from 'react-icons/md'
import { Modal } from '../Modal/Modal'
import { mergeSettingsHelpButtonHandlers } from '../shared/settingsInlineHelpBlock'
import styles from './GitRemoteConfigHelp.module.css'

export const GitRemoteConfigHelp: React.FC = () => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className={styles.helpBtn}
        aria-label={t('version_control.remote_config_help_aria', '远程仓库配置说明')}
        {...mergeSettingsHelpButtonHandlers(() => setOpen(true))}
      >
        <MdHelpOutline size={14} className={styles.helpIcon} aria-hidden />
      </button>
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={t('version_control.remote_config_help_title', '远程仓库配置说明')}
        closeOnOverlayClick
        className={styles.helpModal}
        zIndex={10050}
      >
        <p className={styles.body}>{t('version_control.remote_config_help')}</p>
      </Modal>
    </>
  )
}
