import React, { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ImagePlus } from 'lucide-react'
import {
  BUILTIN_ASSISTANT_AVATAR_IDS,
  type BuiltinAssistantAvatarId,
  isAssistantCustomAvatar,
  parseBuiltinAssistantAvatarId,
  toBuiltinAssistantAvatarPath
} from '@baishou/shared'
import { AvatarCropModal } from '../AvatarCropModal'
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
  const [showCropModal, setShowCropModal] = useState(false)
  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectedBuiltinId = parseBuiltinAssistantAvatarId(avatarPath)
  const previewSrc = isAssistantCustomAvatar(avatarPath)
    ? resolveWebAssistantAvatarSrc(avatarPath)
    : resolveWebAssistantAvatarSrc(avatarPath)

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
  }

  return (
    <div className={styles.root}>
      <div
        className={styles.preview}
        style={{ backgroundImage: previewSrc ? `url("${previewSrc}")` : undefined }}
      />

      <p className={styles.sectionLabel}>{t('agent.assistant.builtin_avatars', '内置头像')}</p>
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
              <img
                src={WEB_BUILTIN_ASSISTANT_AVATAR_URLS[id]}
                alt=""
                className={styles.presetImg}
              />
            </button>
          )
        })}
      </div>

      <button type="button" className={styles.uploadBtn} onClick={triggerUpload}>
        <ImagePlus size={18} />
        <span>{t('agent.assistant.upload_avatar', '从本地上传')}</span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className={styles.hiddenInput}
        onChange={handleFileChange}
      />

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
