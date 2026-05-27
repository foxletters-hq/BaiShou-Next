import React from 'react'
import { useTranslation } from 'react-i18next'
import { Smile } from 'lucide-react'
import { AvatarEditor } from '../AvatarEditor'
import styles from './AssistantEditPage.module.css'

interface AssistantEditAvatarSectionProps {
  emoji: string
  currentAvatarImagePath: string | null
  onEmojiChange: (emoji: string) => void
  onAvatarChange: (path: string) => void
  onRemoveAvatar: () => void
}

export const AssistantEditAvatarSection: React.FC<AssistantEditAvatarSectionProps> = ({
  emoji,
  currentAvatarImagePath,
  onEmojiChange,
  onAvatarChange,
  onRemoveAvatar
}) => {
  const { t } = useTranslation()

  return (
    <div className={styles.avatarSection}>
      <AvatarEditor
        emoji={emoji}
        avatarPath={currentAvatarImagePath || undefined}
        onChange={(type, value) => {
          if (type === 'emoji') {
            onEmojiChange(value)
          } else {
            onAvatarChange(value)
          }
        }}
      >
        <div className={styles.avatarStack}>
          <div
            className={styles.avatarCircle}
            style={{
              backgroundImage: currentAvatarImagePath ? `url(${currentAvatarImagePath})` : 'none'
            }}
          >
            {!currentAvatarImagePath && <span className={styles.emojiText}>{emoji}</span>}
          </div>
          <div className={styles.avatarBadge}>
            <Smile size={16} />
          </div>
        </div>
      </AvatarEditor>
      <div className={styles.avatarHint}>
        {t('agent.assistant.avatar_hint', '点击更换伙伴的图标或头像')}
      </div>
      {currentAvatarImagePath && (
        <button className={styles.textBtn} onClick={onRemoveAvatar}>
          {t('agent.assistant.remove_avatar', '移除图片')}
        </button>
      )}
    </div>
  )
}
