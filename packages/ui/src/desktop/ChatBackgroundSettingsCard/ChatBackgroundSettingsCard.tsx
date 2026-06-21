import React from 'react'
import { MdWallpaper, MdDelete } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import defaultBg from '../../assets/images/BaiShou-v0.0.1.jpeg'
import { SettingsExpansionTile } from '../shared/SettingsExpansionTile'
import './ChatBackgroundSettingsCard.css'

export interface ChatBackgroundSettingsProps {
  backgroundPath?: string | null
  onPickBackground: () => void
  onClearBackground: () => void
  embedded?: boolean
  isLast?: boolean
}

export const ChatBackgroundSettingsCard: React.FC<ChatBackgroundSettingsProps> = ({
  backgroundPath,
  onPickBackground,
  onClearBackground,
  embedded = false,
  isLast = false
}) => {
  const { t } = useTranslation()

  const subtitle = backgroundPath
    ? t('settings.chat_background_custom', '自定义背景')
    : t('settings.chat_background_default', '默认背景')

  return (
    <div className="chat-bg-settings-wrapper">
      <SettingsExpansionTile
        embedded={embedded}
        isLast={isLast}
        icon={<MdWallpaper size={24} />}
        title={t('settings.chat_background', '聊天背景')}
        subtitle={subtitle}
      >
        <div className="chat-bg-preview-area" onClick={onPickBackground}>
          <img
            className="chat-bg-preview-img"
            src={backgroundPath || defaultBg}
            alt={t('settings.chat_background', '聊天背景')}
          />
          <div className="chat-bg-preview-overlay">
            <span>{t('settings.chat_background_change', '更换背景')}</span>
          </div>
        </div>
        {backgroundPath && (
          <button className="chat-bg-reset-btn" onClick={onClearBackground}>
            <MdDelete size={16} />
            <span>{t('settings.chat_background_reset', '恢复默认背景')}</span>
          </button>
        )}
      </SettingsExpansionTile>
    </div>
  )
}
