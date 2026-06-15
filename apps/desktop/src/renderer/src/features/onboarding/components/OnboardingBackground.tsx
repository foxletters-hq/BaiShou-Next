import React from 'react'
import styles from './OnboardingBackground.module.css'

export const OnboardingBackground: React.FC = () => {
  return (
    <div className={styles.root}>
      <div className={styles.gradient} />
      <div className={styles.orbTop} />
      <div className={styles.orbBottom} />
    </div>
  )
}
