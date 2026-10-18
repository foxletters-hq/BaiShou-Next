import React from 'react'
import { type StyleProp, type ViewStyle } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { sharedTokens } from '../../theme/tokens'

export interface SegmentedContentProps {
  /** Active segment value; changing it remounts and fades in the selected pane. */
  value: string
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
}

export function SegmentedContent({
  value,
  children,
  style
}: SegmentedContentProps): React.ReactElement {
  return (
    <Animated.View
      key={value}
      entering={FadeIn.duration(sharedTokens.animation.swift)}
      style={style}
    >
      {children}
    </Animated.View>
  )
}
