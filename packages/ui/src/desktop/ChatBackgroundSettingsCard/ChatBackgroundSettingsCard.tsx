import React, { useCallback, useEffect, useState } from 'react'
import { MdWallpaper, MdDelete } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import {
  CHAT_BACKGROUND_BLUR_MAX,
  CHAT_BACKGROUND_BLUR_MIN,
  CHAT_BACKGROUND_OVERLAY_TRANSPARENCY_MIN,
  CHAT_BACKGROUND_OVERLAY_TRANSPARENCY_MAX,
  normalizeChatBackgroundBlur,
  normalizeChatBackgroundOverlayOpacity,
  chatBackgroundOverlayTransparencyFromOpacity,
  chatBackgroundOverlayOpacityFromTransparency,
  chatBackgroundOverlayAlpha,
  chatBackgroundOverlayTransparencyProgress
} from '@baishou/shared'
import { SettingsExpansionTile } from '../shared/SettingsExpansionTile'
import './ChatBackgroundSettingsCard.css'

export interface ChatBackgroundSettingsProps {
  backgroundPath?: string | null
  blur?: number
  overlayOpacity?: number
  onPickBackground: () => void
  onClearBackground: () => void
  onBlurChange?: (value: number) => void
  onOverlayOpacityChange?: (value: number) => void
  embedded?: boolean
  isLast?: boolean
}

export const ChatBackgroundSettingsCard: React.FC<ChatBackgroundSettingsProps> = ({
  backgroundPath,
  blur = 0,
  overlayOpacity = 0,
  onPickBackground,
  onClearBackground,
  onBlurChange,
  onOverlayOpacityChange,
  embedded = false,
  isLast = false
}) => {
  const { t } = useTranslation()
  const committedBlur = normalizeChatBackgroundBlur(blur)
  const committedOverlayOpacity = normalizeChatBackgroundOverlayOpacity(overlayOpacity)
  const committedOverlayTransparency =
    chatBackgroundOverlayTransparencyFromOpacity(committedOverlayOpacity)
  const [draftBlur, setDraftBlur] = useState(committedBlur)
  const [draftOverlayTransparency, setDraftOverlayTransparency] = useState(
    committedOverlayTransparency
  )

  useEffect(() => {
    setDraftBlur(committedBlur)
  }, [committedBlur])

  useEffect(() => {
    setDraftOverlayTransparency(committedOverlayTransparency)
  }, [committedOverlayTransparency])

  const draftOverlayOpacity = chatBackgroundOverlayOpacityFromTransparency(draftOverlayTransparency)
  const draftOverlayAlpha = chatBackgroundOverlayAlpha(draftOverlayOpacity)

  const subtitle = backgroundPath
    ? t('settings.chat_background_custom', '自定义背景')
    : t('settings.chat_background_default', '未设置')

  const stopRowClick: React.MouseEventHandler = (e) => {
    e.stopPropagation()
  }

  const commitBlur = useCallback(() => {
    if (draftBlur !== committedBlur) {
      onBlurChange?.(draftBlur)
    }
  }, [committedBlur, draftBlur, onBlurChange])

  const commitOverlay = useCallback(() => {
    if (draftOverlayTransparency !== committedOverlayTransparency) {
      onOverlayOpacityChange?.(
        chatBackgroundOverlayOpacityFromTransparency(draftOverlayTransparency)
      )
    }
  }, [committedOverlayTransparency, draftOverlayTransparency, onOverlayOpacityChange])

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
          {backgroundPath ? (
            <>
              <img
                className="chat-bg-preview-img"
                src={backgroundPath}
                alt={t('settings.chat_background', '聊天背景')}
                style={{
                  filter: draftBlur > 0 ? `blur(${draftBlur}px)` : undefined,
                  transform: draftBlur > 0 ? 'scale(1.08)' : undefined
                }}
              />
              {draftOverlayAlpha > 0 ? (
                <div
                  className="chat-bg-preview-scrim"
                  style={{ backgroundColor: `rgba(0, 0, 0, ${draftOverlayAlpha})` }}
                />
              ) : null}
            </>
          ) : (
            <div className="chat-bg-preview-placeholder">
              <MdWallpaper size={32} />
              <span>{t('settings.chat_background_pick_hint', '点击选择背景')}</span>
            </div>
          )}
          <div className="chat-bg-preview-overlay">
            <span>{t('settings.chat_background_change', '更换背景')}</span>
          </div>
        </div>

        {backgroundPath ? (
          <>
            <div className="chat-bg-slider-section" onClick={stopRowClick}>
              <div className="chat-bg-slider-row">
                <span className="chat-bg-slider-label">
                  {t('settings.chat_background_blur', '背景模糊')}
                </span>
                <span className="chat-bg-slider-value">{draftBlur}px</span>
              </div>
              <input
                type="range"
                className="chat-bg-range-input"
                min={CHAT_BACKGROUND_BLUR_MIN}
                max={CHAT_BACKGROUND_BLUR_MAX}
                step={1}
                value={draftBlur}
                onChange={(e) => setDraftBlur(Number(e.target.value))}
                onMouseUp={commitBlur}
                onPointerUp={commitBlur}
                onKeyUp={commitBlur}
                style={{
                  backgroundSize: `${(draftBlur / CHAT_BACKGROUND_BLUR_MAX) * 100}% 100%`
                }}
              />

              <div className="chat-bg-slider-row">
                <span className="chat-bg-slider-label">
                  {t('settings.chat_background_overlay', '遮罩透明度')}
                </span>
                <span className="chat-bg-slider-value">{draftOverlayTransparency}%</span>
              </div>
              <input
                type="range"
                className="chat-bg-range-input"
                min={CHAT_BACKGROUND_OVERLAY_TRANSPARENCY_MIN}
                max={CHAT_BACKGROUND_OVERLAY_TRANSPARENCY_MAX}
                step={1}
                value={draftOverlayTransparency}
                onChange={(e) => setDraftOverlayTransparency(Number(e.target.value))}
                onMouseUp={commitOverlay}
                onPointerUp={commitOverlay}
                onKeyUp={commitOverlay}
                style={{
                  backgroundSize: `${chatBackgroundOverlayTransparencyProgress(draftOverlayTransparency) * 100}% 100%`
                }}
              />
            </div>

            <button type="button" className="chat-bg-reset-btn" onClick={onClearBackground}>
              <MdDelete size={16} />
              <span>{t('settings.chat_background_reset', '清除背景')}</span>
            </button>
          </>
        ) : null}
      </SettingsExpansionTile>
    </div>
  )
}
