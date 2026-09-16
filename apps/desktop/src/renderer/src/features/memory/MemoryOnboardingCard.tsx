import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@baishou/ui'
import { buildMemoryOnboardingModel, type MemoryOnboardingStep } from './memory-center-tab.util'
import styles from './MemoryCenterPage.module.css'

export type MemoryOnboardingCardProps = {
  embeddingConfigured: boolean
  pendingEmbedCount: number
  pendingGraphCount: number
  onConfigureEmbedding: () => void
  onStartMemory: () => void
  onDismiss: () => void
}

function stepTitle(
  id: MemoryOnboardingStep['id'],
  t: (key: string, fallback: string) => string
): string {
  switch (id) {
    case 'embed':
      return t('memory.onboarding_step_embed', '配置嵌入模型')
    case 'vector':
      return t('memory.onboarding_step_vector', '索引向量片段')
    case 'graph':
      return t('memory.onboarding_step_graph', '整理关系图谱')
  }
}

function stepMeta(
  step: MemoryOnboardingStep,
  t: (key: string, fallback: string, options?: Record<string, unknown>) => string
): string {
  if (step.status === 'blocked') {
    return t('memory.readiness_need_embedding', '需要先配置嵌入模型')
  }
  if (step.id === 'embed') {
    return step.status === 'done'
      ? t('memory.onboarding_step_done', '已完成')
      : t('memory.readiness_not_configured', '未配置')
  }
  if (step.id === 'vector') {
    return step.status === 'done'
      ? t('memory.readiness_vector_done', '已全部整理')
      : t('memory.readiness_vector_pending', '未整理 {{count}} 篇', { count: step.count ?? 0 })
  }
  return step.status === 'done'
    ? t('memory.readiness_graph_done', '已全部整理')
    : t('memory.readiness_graph_pending', '待整理 {{count}} 篇', { count: step.count ?? 0 })
}

export const MemoryOnboardingCard: React.FC<MemoryOnboardingCardProps> = ({
  embeddingConfigured,
  pendingEmbedCount,
  pendingGraphCount,
  onConfigureEmbedding,
  onStartMemory,
  onDismiss
}) => {
  const { t } = useTranslation()
  const model = useMemo(
    () =>
      buildMemoryOnboardingModel({
        embeddingConfigured,
        pendingEmbedCount,
        pendingGraphCount
      }),
    [embeddingConfigured, pendingEmbedCount, pendingGraphCount]
  )

  return (
    <section
      className={styles.onboarding}
      aria-label={t('memory.onboarding_title', '开始整理记忆')}
    >
      <div className={styles.onboardingHead}>
        <h2 className={styles.onboardingTitle}>{t('memory.onboarding_title', '开始整理记忆')}</h2>
        <Button type="button" onClick={onDismiss}>
          {t('memory.onboarding_dismiss', '以后再说')}
        </Button>
      </div>
      <ol className={styles.onboardingSteps}>
        {model.steps.map((step) => (
          <li
            key={step.id}
            className={step.status === 'done' ? styles.stepDone : undefined}
            data-status={step.status}
          >
            <span>{stepTitle(step.id, t)}</span>
            <span className={styles.stepMeta}>{stepMeta(step, t)}</span>
          </li>
        ))}
      </ol>
      <div className={styles.onboardingActions}>
        <Button
          type="button"
          onClick={model.primaryKind === 'configure' ? onConfigureEmbedding : onStartMemory}
        >
          {model.primaryKind === 'configure'
            ? t('memory.onboarding_configure_primary', '去配置嵌入模型')
            : t('memory.onboarding_start', '开始整理记忆')}
        </Button>
      </div>
    </section>
  )
}
