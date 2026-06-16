import React, { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ImagePlus, LayoutGrid } from 'lucide-react'
import {
  BUILTIN_ASSISTANT_AVATAR_IDS,
  type BuiltinAssistantAvatarId,
  isAssistantCustomAvatar,
  parseBuiltinAssistantAvatarId,
  toBuiltinAssistantAvatarPath
} from '@baishou/shared'
import { AvatarCropModal } from '../AvatarCropModal'
import { Modal } from '../Modal/Modal'
import { WEB_BUILTIN_ASSISTANT_AVATAR_URLS } from '../builtin-assistant-avatar.sources'
import { resolveWebAssistantAvatarSrc } from '../assistant-avatar.util'
import styles from './AssistantAvatarPicker.module.css'

export interface AssistantAvatarPickerProps {
  avatarPath: string
  onSelectBuiltin: (path: string) => void
  onUploadImage: (dataUrl: string) => void
}

export const AssistantAvatarPicker: React.FC<AssistantAvatarPickerProps> = ({
  avatarPath,
  onSelectBuiltin,
  onUploadImage
}) => {
  const { t } = useTranslation()
  const [showBuiltinModal, setShowBuiltinModal] = useState(false)
  const [showCropModal, setShowCropModal] = useState(false)
  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectedBuiltinId = parseBuiltinAssistantAvatarId(avatarPath)
  const previewSrc = resolveWebAssistantAvatarSrc(avatarPath)

  const triggerUpload = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      if (typeof ev.target?.result === 'string') {
        setTempImageSrc(ev.target.result)
        setShowCropModal(true)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleBuiltinSelect = (id: BuiltinAssistantAvatarId) => {
    onSelectBuiltin(toBuiltinAssistantAvatarPath(id))
    setShowBuiltinModal(false)
  }

  return (
    <div className={styles.root}>
      <div
        className={styles.preview}
        style={{ backgroundImage: previewSrc ? `url("${previewSrc}")` : undefined }}
      />

      <div className={styles.actionRow}>
        <button
          type="button"
          className={styles.actionBtn}
          onClick={() => setShowBuiltinModal(true)}
        >
          <LayoutGrid size={16} />
          <span>{t('agent.assistant.select_builtin_avatar', '选择内置头像')}</span>
        </button>
        <button type="button" className={styles.actionBtn} onClick={triggerUpload}>
          <ImagePlus size={16} />
          <span>{t('agent.assistant.upload_avatar', '从本地上传')}</span>
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className={styles.hiddenInput}
        onChange={handleFileChange}
      />

      <Modal
        isOpen={showBuiltinModal}
        onClose={() => setShowBuiltinModal(false)}
        title={t('agent.assistant.builtin_avatars', '内置头像')}
        closeOnOverlayClick
        className={styles.builtinModal}
      >
        <div className={styles.presetGrid}>
          {BUILTIN_ASSISTANT_AVATAR_IDS.map((id) => {
            const selected = selectedBuiltinId === id && !isAssistantCustomAvatar(avatarPath)
            return (
              <button
                key={id}
                type="button"
                className={`${styles.presetBtn} ${selected ? styles.presetBtnSelected : ''}`}
                onClick={() => handleBuiltinSelect(id)}
                aria-label={t('agent.assistant.select_builtin_avatar', '选择内置头像')}
              >
                <img src={WEB_BUILTIN_ASSISTANT_AVATAR_URLS[id]} alt="" className={styles.presetImg} />
              </button>
            )
          })}
        </div>
      </Modal>

      {showCropModal && tempImageSrc ? (
        <AvatarCropModal
          imageSrc={tempImageSrc}
          onCanceled={() => {
            setShowCropModal(false)
            setTempImageSrc(null)
          }}
          onCropped={(croppedUrl) => {
            onUploadImage(croppedUrl)
            setShowCropModal(false)
            setTempImageSrc(null)
          }}
        />
      ) : null}
    </div>
  )
}
