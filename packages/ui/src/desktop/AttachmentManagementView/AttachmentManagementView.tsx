import React from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence } from 'framer-motion'
import seg from '../shared/SegmentedControl.module.css'
import styles from './AttachmentManagementView.module.css'
import { ImagePreview } from '../DiaryEditor/ImagePreview'
import type { AttachmentManagementViewProps } from './attachment-management.types'
import { useAttachmentManagementView } from './useAttachmentManagementView'
import { DiaryAttachmentPane } from './DiaryAttachmentPane'
import { SessionAttachmentPane } from './SessionAttachmentPane'
import { AttachmentYearPickerPortal } from './AttachmentYearPickerPortal'
import { SettingsPageChrome } from '../shared/SettingsPageChrome'

export const AttachmentManagementView: React.FC<AttachmentManagementViewProps> = (props) => {
  const vm = useAttachmentManagementView(props)

  return (
    <SettingsPageChrome
      title={vm.t('settings.attachment_management', '附件管理')}
      layout="stack"
    >
      <div className={styles.container}>
        <div className={styles.mainTabNav}>
          <div className={seg.group}>
            <button
              type="button"
              className={`${seg.btn} ${vm.activePane === 'diary' ? seg.btnActive : ''}`}
              onClick={() => vm.setActivePane('diary')}
            >
              {vm.t('settings.attachment_pane_diary', '日记附件')}
            </button>
            <button
              type="button"
              className={`${seg.btn} ${vm.activePane === 'session' ? seg.btnActive : ''}`}
              onClick={() => vm.setActivePane('session')}
            >
              {vm.t('settings.attachment_pane_session', 'AI 会话附件')}
            </button>
          </div>
        </div>

        <div className={styles.content}>
          <AnimatePresence mode="wait">
            {vm.activePane === 'diary' ? (
              <DiaryAttachmentPane key="diary" vm={vm} />
            ) : (
              <SessionAttachmentPane key="session" vm={vm} />
            )}
          </AnimatePresence>
        </div>

        <AttachmentYearPickerPortal vm={vm} />

        {vm.mounted &&
          vm.imagePreview &&
          createPortal(
            <ImagePreview
              src={vm.imagePreview.src}
              alt={vm.imagePreview.name}
              isOpen={!!vm.imagePreview}
              onClose={() => vm.setImagePreview(null)}
            />,
            document.body
          )}
      </div>
    </SettingsPageChrome>
  )
}
