import React, { useState, useRef } from 'react'
import styles from './ProfileSettingsCard.module.css'
import { useTranslation } from 'react-i18next'
import { useDialog } from '../Dialog'
import { Modal } from '../Modal/Modal'
import { Button } from '../Button/Button'
import { AvatarCropModal } from '../AvatarCropModal'
import { resolveDesktopUserAvatarSrc } from '../user-avatar.util'
import { DESKTOP_BUILTIN_USER_AVATAR_URLS } from '../builtin-user-avatar.sources'
import {
  BUILTIN_USER_AVATAR_IDS,
  type BuiltinUserAvatarId,
  isCustomUserAvatar,
  parseBuiltinUserAvatarId,
  toBuiltinUserAvatarPath
} from '@baishou/shared'
import { Camera, ImagePlus, LayoutGrid, Pencil } from 'lucide-react'

export interface ProfileData {
  nickname: string
  avatarPath?: string | null
}

export interface ProfileSettingsCardProps {
  profile: ProfileData
  onSave: (data: ProfileData) => void
}

export const ProfileSettingsCard: React.FC<ProfileSettingsCardProps> = ({ profile, onSave }) => {
  const { t } = useTranslation()
  const dialog = useDialog()
  const [choiceModalOpen, setChoiceModalOpen] = useState(false)
  const [showBuiltinModal, setShowBuiltinModal] = useState(false)
  const [inEditAvatar, setInEditAvatar] = useState(false)
  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectedBuiltinId = parseBuiltinUserAvatarId(profile.avatarPath)

  // 触发选图
  const handleTriggerPick = () => {
    if (fileInputRef.current) fileInputRef.current.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        if (typeof ev.target?.result === 'string') {
          setTempImageSrc(ev.target.result)
          setInEditAvatar(true)
        }
      }
      reader.readAsDataURL(file)
    }
    e.target.value = ''
  }

  const cancelCrop = () => {
    setInEditAvatar(false)
    setTempImageSrc(null)
  }

  const finishCrop = (croppedUrl: string) => {
    onSave({ ...profile, avatarPath: croppedUrl })
    setInEditAvatar(false)
    setTempImageSrc(null)
  }

  const handleBuiltinSelect = (id: BuiltinUserAvatarId) => {
    onSave({ ...profile, avatarPath: toBuiltinUserAvatarPath(id) })
    setShowBuiltinModal(false)
  }

  // 编辑昵称
  const handleEditNickname = async () => {
    const promptMessage = t('profile.edit_nickname_prompt', '请输入新的昵称：')
    const nextName = await dialog.prompt(promptMessage, profile.nickname)
    if (nextName && nextName.trim() !== '' && nextName !== profile.nickname) {
      onSave({ ...profile, nickname: nextName.trim() })
    }
  }

  return (
    <>
      <div className={styles.cardContainer}>
        <div
          className={styles.avatarZone}
          onClick={() => setChoiceModalOpen(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setChoiceModalOpen(true)
            }
          }}
          title={t('profile.change_avatar', '更换头像')}
          aria-label={t('profile.change_avatar', '更换头像')}
        >
          <img
            className={styles.avatarImg}
            src={resolveDesktopUserAvatarSrc(profile.avatarPath)}
            alt="avatar"
          />
          <div className={styles.avatarHover} aria-hidden>
            <Camera size={22} />
          </div>
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>

        <div className={styles.infoZone}>
          <div className={styles.nameRow}>
            <h2 className={styles.nickname}>
              {profile.nickname || t('profile.default_nickname', '白守用户')}
            </h2>
            <button
              className={styles.editBtn}
              onClick={handleEditNickname}
              title={t('profile.edit_nickname', '修改昵称')}
              aria-label={t('profile.edit_nickname', '修改昵称')}
            >
              <Pencil size={16} />
            </button>
          </div>
        </div>
      </div>

      <Modal
        isOpen={choiceModalOpen}
        onClose={() => setChoiceModalOpen(false)}
        title={t('profile.change_avatar', '更换头像')}
        closeOnOverlayClick
        className={styles.choiceModal}
      >
        <div className={styles.actionRow}>
          <Button
            type="button"
            onClick={() => {
              setChoiceModalOpen(false)
              setShowBuiltinModal(true)
            }}
          >
            <LayoutGrid size={16} />
            <span>{t('profile.select_builtin_avatar', '选择内置头像')}</span>
          </Button>
          <Button
            type="button"
            onClick={() => {
              setChoiceModalOpen(false)
              handleTriggerPick()
            }}
          >
            <ImagePlus size={16} />
            <span>{t('profile.upload_avatar', '从本地上传')}</span>
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={showBuiltinModal}
        onClose={() => setShowBuiltinModal(false)}
        title={t('profile.builtin_avatars', '内置头像')}
        closeOnOverlayClick
        className={styles.builtinModal}
      >
        <div className={styles.presetGrid}>
          {BUILTIN_USER_AVATAR_IDS.map((id) => {
            const selected = selectedBuiltinId === id && !isCustomUserAvatar(profile.avatarPath)
            return (
              <button
                key={id}
                type="button"
                className={`${styles.presetBtn} ${selected ? styles.presetBtnSelected : ''}`}
                onClick={() => handleBuiltinSelect(id)}
                aria-label={t('profile.select_builtin_avatar', '选择内置头像')}
              >
                <img
                  src={DESKTOP_BUILTIN_USER_AVATAR_URLS[id]}
                  alt=""
                  className={styles.presetImg}
                />
              </button>
            )
          })}
        </div>
      </Modal>

      {inEditAvatar && tempImageSrc && (
        <AvatarCropModal imageSrc={tempImageSrc} onCanceled={cancelCrop} onCropped={finishCrop} />
      )}
    </>
  )
}
