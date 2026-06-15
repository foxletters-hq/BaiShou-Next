import React, { useState } from 'react'
import { MdEditLocationAlt, MdFolderOpen } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import styles from './OnboardingStorageSlide.module.css'

interface OnboardingStorageSlideProps {
  rootPath: string
  onChangeStorage: () => Promise<void>
}

export const OnboardingStorageSlide: React.FC<OnboardingStorageSlideProps> = ({
  rootPath,
  onChangeStorage
}) => {
  const { t } = useTranslation()
  const [changing, setChanging] = useState(false)

  const handleChangeStorage = async () => {
    setChanging(true)
    try {
      await onChangeStorage()
    } finally {
      setChanging(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.pathBlock}>
        <div className={styles.pathHeader}>
          <MdFolderOpen size={16} color="#D4924A" />
          <span className={styles.pathLabel}>{t('onboarding.current_storage')}</span>
        </div>
        <div className={styles.pathValueWrap}>
          <div className={styles.pathValue}>{rootPath}</div>
        </div>
      </div>

      <button
        type="button"
        className={styles.changeButton}
        onClick={() => void handleChangeStorage()}
        disabled={changing}
      >
        {changing ? (
          <span>{t('common.loading')}</span>
        ) : (
          <>
            <MdEditLocationAlt size={18} color="#FFFFFF" />
            <span>{t('onboarding.change_storage')}</span>
          </>
        )}
      </button>
    </div>
  )
}
