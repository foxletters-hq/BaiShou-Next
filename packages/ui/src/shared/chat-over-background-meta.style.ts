import type { TextStyle, ViewStyle } from 'react-native'

/** 叠在自定义聊天背景上时，用差值混合实现近似自动反色（桌面 CSS 同名策略） */
export const chatOverBackgroundMetaTextStyle: TextStyle = {
  color: '#ffffff',
  mixBlendMode: 'difference'
}

export const chatOverBackgroundMetaIconStyle: ViewStyle = {
  mixBlendMode: 'difference'
}

export const chatOverBackgroundMetaIconColor = '#ffffff'
