import React from 'react'
import { useTranslation } from 'react-i18next'
import styles from './MemoryCenterPage.module.css'

export type MemoryOnboardingCardProps = {
  onConfigureEmbedding: () => void
  onStartIndex: () => void
  onStartOrganize: () => void
  onDismiss: () => void
}

export const MemoryOnboardingCard: React.FC<MemoryOnboardingCardProps> = ({
  onConfigureEmbedding,
  onStartIndex,
  onStartOrganize,
  onDismiss
}) => {
  const { t } = useTranslation()

  return (
    <section
      className={styles.onboarding}
      aria-label={t('memory.onboarding_title', '开始建立记忆')}
    >
      <div className={styles.onboardingHead}>
        <h2 className={styles.onboardingTitle}>{t('memory.onboarding_title', '开始建立记忆')}</h2>
        <button type="button" className={styles.noticeLink} onClick={onDismiss}>
          {t('memory.onboarding_dismiss', '以后再说')}
        </button>
      </div>
      <ol className={styles.onboardingSteps}>
        <li>
          <span>{t('memory.onboarding_step_embed', '配置嵌入模型')}</span>
          <button type="button" className={styles.stepBtn} onClick={onConfigureEmbedding}>
            {t('memory.go_configure', '去配置')}
          </button>
        </li>
        <li>
          <span>{t('memory.onboarding_step_vector', '建立向量片段')}</span>
          <button type="button" className={styles.stepBtn} onClick={onStartIndex}>
            {t('memory.start_index', '开始索引')}
          </button>
        </li>
        <li>
          <span>{t('memory.onboarding_step_graph', '整理关系图谱')}</span>
          <button type="button" className={styles.stepBtn} onClick={onStartOrganize}>
            {t('memory.start_organize', '开始整理')}
          </button>
        </li>
      </ol>
    </section>
  )
}
