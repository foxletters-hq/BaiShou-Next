import React from 'react'
import { resolveDesktopAssistantAvatarSrc } from '../assistant-avatar.util'
import styles from './AssistantAvatar.module.css'

export interface AssistantAvatarProps {
  avatarPath?: string | null
  size?: number
  className?: string
  borderRadius?: number | string
}

export const AssistantAvatar: React.FC<AssistantAvatarProps> = ({
  avatarPath,
  size = 40,
  className,
  borderRadius
}) => {
  const src = resolveDesktopAssistantAvatarSrc(avatarPath)
  const radius = borderRadius ?? Math.round(size * 0.25)

  return (
    <img
      key={avatarPath ?? 'default'}
      src={src}
      alt=""
      className={`${styles.avatar} ${className ?? ''}`}
      style={{ width: size, height: size, borderRadius: radius }}
      draggable={false}
    />
  )
}
