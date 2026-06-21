import React from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, Folder } from 'lucide-react'
import styles from './AttachmentManagementView.module.css'
import { ImagePreview } from '../DiaryEditor/ImagePreview'
import type { AttachmentManagementViewProps } from './attachment-management.types'
import { useAttachmentManagementView } from './useAttachmentManagementView'
import { DiaryAttachmentPane } from './DiaryAttachmentPane'
import { SessionAttachmentPane } from './SessionAttachmentPane'
import { AttachmentYearPickerPortal } from './AttachmentYearPickerPortal'

export const AttachmentManagementView: React.FC<AttachmentManagementViewProps> = (props) => {
  const vm = useAttachmentManagementView(props)

  return (
    <div className={styles.container}>
      <div className={styles.mainTabNav}>
        <div className={styles.mainTabs}>
          <button
            className={`${styles.mainTabItem} ${vm.activePane === 'diary' ? styles.mainTabItemActive : ''}`}
            onClick={() => vm.setActivePane('diary')}
          >
            <Calendar size={16} />
            <span>{vm.t('settings.attachment_pane_diary', '日记附件')}</span>
          </button>
          <button
            className={`${styles.mainTabItem} ${vm.activePane === 'session' ? styles.mainTabItemActive : ''}`}
            onClick={() => vm.setActivePane('session')}
          >
            <Folder size={16} />
            <span>{vm.t('settings.attachment_pane_session', 'AI 会话附件')}</span>
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {vm.activePane === 'diary' ? (
          <DiaryAttachmentPane key="diary" vm={vm} />
        ) : (
          <SessionAttachmentPane key="session" vm={vm} />
        )}
      </AnimatePresence>

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
  )
}
