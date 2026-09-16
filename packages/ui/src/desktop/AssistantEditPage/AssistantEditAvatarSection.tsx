import React from 'react'
import { useTranslation } from 'react-i18next'
import { DEFAULT_BUILTIN_ASSISTANT_AVATAR_PATH } from '@baishou/shared'
import { AssistantAvatarPicker } from '../AssistantAvatarPicker'
import styles from './AssistantEditPage.module.css'
import { Button } from '../Button/Button'

interface AssistantEditAvatarSectionProps {
  avatarPath: string
  onSelectBuiltin: (path: string) => void
  onUploadImage: (dataUrl: string) => void
  onResetToDefault?: () => void
  showReset?: boolean
  previewSize?: number
  fullWidth?: boolean
}

export const AssistantEditAvatarSection: React.FC<AssistantEditAvatarSectionProps> = ({
  avatarPath,
  onSelectBuiltin,
  onUploadImage,
  onResetToDefault,
  showReset,
  previewSize = 88,
  fullWidth = false
}) => {
  const { t } = useTranslation()

  return (
    <div className={styles.avatarSection}>
      <AssistantAvatarPicker
        avatarPath={avatarPath || DEFAULT_BUILTIN_ASSISTANT_AVATAR_PATH}
        previewSize={previewSize}
        fullWidth={fullWidth}
        onSelectBuiltin={onSelectBuiltin}
        onUploadImage={onUploadImage}
      />
      {showReset && onResetToDefault ? (
        <Button type="button" variant="outlined" size="small" onClick={onResetToDefault}>
          {t('agent.assistant.reset_builtin_avatar')}
        </Button>
      ) : null}
    </div>
  )
}
