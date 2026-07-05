import React from 'react'
import { getMoodEmoji, resolveMoodId } from '@baishou/shared'
import { getMoodFluentIconSrc } from '../../shared/mood-fluent-assets'

export interface MoodEmojiProps {
  mood: string
  size?: number
  className?: string
}

/** Fluent Emoji 3D 离线图标，未知心情回退系统 emoji */
export const MoodEmoji: React.FC<MoodEmojiProps> = ({ mood, size = 18, className }) => {
  const id = resolveMoodId(mood)
  if (!id) return null

  const src = getMoodFluentIconSrc(id)
  const fallback = getMoodEmoji(id)

  if (!src) {
    return (
      <span
        className={className}
        style={{ fontSize: size * 0.85, lineHeight: `${size}px`, width: size, height: size }}
        aria-hidden
      >
        {fallback}
      </span>
    )
  }

  return (
    <img
      src={src}
      alt=""
      className={className}
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: 'contain' }}
      draggable={false}
    />
  )
}
