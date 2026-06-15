import React from 'react'
import type { SlideTheme } from '../onboarding-theme'
import styles from './OnboardingGlowIcon.module.css'

interface OnboardingGlowIconProps {
  theme: SlideTheme
  size?: number
}

export const OnboardingGlowIcon: React.FC<OnboardingGlowIconProps> = ({ theme, size = 72 }) => {
  const Icon = theme.icon
  const shellSize = size + 8
  const ringSize = size + 40

  return (
    <div className={styles.glowRing} style={{ width: ringSize, height: ringSize }}>
      <div
        className={styles.iconShell}
        style={{
          width: shellSize,
          height: shellSize,
          borderColor: `${theme.iconColor}33`,
          boxShadow: `0 0 20px ${theme.iconColor}26`
        }}
      >
        <Icon size={size * 0.55} color={theme.iconColor} />
      </div>
    </div>
  )
}
