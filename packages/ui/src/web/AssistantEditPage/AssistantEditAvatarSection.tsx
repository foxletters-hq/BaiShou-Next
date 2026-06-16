import React from 'react'
import { useTranslation } from 'react-i18next'
import { DEFAULT_BUILTIN_ASSISTANT_AVATAR_PATH } from '@baishou/shared'
import { AssistantAvatarPicker } from '../AssistantAvatarPicker'
import styles from './AssistantEditPage.module.css'

interface AssistantEditAvatarSectionProps {
  avatarPath: string
  onSelectBuiltin: (path: string) => void
  onUploadImage: (dataUrl: string) => void
  onResetToDefault?: () => void
  showReset?: boolean
}

export const AssistantEditAvatarSection: React.FC<AssistantEditAvatarSectionProps> = ({
  avatarPath,
  onSelectBuiltin,
  onUploadImage,
  onResetToDefault,
  showReset
}) => {
  const { t } = useTranslation()

  return (
    <div className={styles.avatarSection}>
      <AssistantAvatarPicker
        avatarPath={avatarPath || DEFAULT_BUILTIN_ASSISTANT_AVATAR_PATH}
        onSelectBuiltin={onSelectBuiltin}
        onUploadImage={onUploadImage}
      />
      {showReset && onResetToDefault ? (
        <button type="button" className={styles.textBtn} onClick={onResetToDefault}>
          {t('agent.assistant.reset_builtin_avatar', '恢复默认内置头像')}
        </button>
      ) : null}
    </div>
  )
}
