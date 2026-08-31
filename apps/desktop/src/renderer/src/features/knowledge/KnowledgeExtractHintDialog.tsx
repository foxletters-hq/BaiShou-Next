import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { KnowledgeExtractHintChoice, VisionExtractHintReason } from '@baishou/shared'
import { KnowledgeDialog } from './KnowledgeDialog'
import { describeVisionExtractHint } from './extract-engine-hint.util'
import {
  isNotebookHeavyConfirmReady,
  notebookHeavyConfirmSecondsLeft
} from './notebook-heavy-confirm.util'
import styles from './KnowledgePage.module.css'

export interface KnowledgeExtractHintDialogProps {
  open: boolean
  fileNames: string[]
  reason: VisionExtractHintReason | null
  currentEngine: 'simple' | 'ocr' | 'vision'
  visionConfigured: boolean
  visionModelId?: string | null
  onCancel: () => void
  onChoose: (choice: Exclude<KnowledgeExtractHintChoice, 'cancel'>) => void
  onOpenVisionSettings: () => void
}

export const KnowledgeExtractHintDialog: React.FC<KnowledgeExtractHintDialogProps> = ({
  open,
  fileNames,
  reason,
  currentEngine,
  visionConfigured,
  visionModelId,
  onCancel,
  onChoose,
  onOpenVisionSettings
}) => {
  const { t } = useTranslation()
  const [startedAt, setStartedAt] = useState(0)
  const [now, setNow] = useState(0)

  useEffect(() => {
    if (!open) return
    const start = Date.now()
    setStartedAt(start)
    setNow(start)
    const timer = window.setInterval(() => setNow(Date.now()), 200)
    return () => window.clearInterval(timer)
  }, [open, fileNames.join('\n')])

  const ready = startedAt > 0 && isNotebookHeavyConfirmReady(startedAt, now)
  const secondsLeft = startedAt > 0 ? notebookHeavyConfirmSecondsLeft(startedAt, now) : 3
  const title =
    reason === 'garbled-text-layer'
      ? t('knowledge.extract_hint_title_garbled', '文字层已损坏')
      : t('knowledge.extract_hint_title', '几乎没有文字层')
  const showKeepTextLayer = currentEngine === 'simple'
  const modelName = visionModelId || t('knowledge.extract_hint_vision_model', '视觉模型')

  return (
    <KnowledgeDialog
      open={open}
      onClose={onCancel}
      title={title}
      aria-label={title}
      className={styles.dialogSettings}
    >
      <p className={styles.guideHint}>{describeVisionExtractHint(reason)}</p>
      {fileNames.length > 0 ? (
        <ul className={styles.extractHintFiles}>
          {fileNames.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      ) : null}
      {visionConfigured ? (
        <p className={styles.guideHint}>
          {t(
            'knowledge.extract_hint_vision_ready',
            '视觉提取会按页调用 {{model}}；本地 OCR 在本机识别，不调用模型。',
            { model: modelName }
          )}
        </p>
      ) : (
        <p className={styles.guideHint}>
          {t(
            'knowledge.extract_hint_vision_missing',
            '还没有配置视觉模型。可以先去知识库设置里配置，或先用本地 OCR。'
          )}
        </p>
      )}
      <div className={styles.extractHintActions}>
        <button type="button" className={styles.dialogCancelBtn} onClick={onCancel}>
          {t('common.cancel', '取消')}
        </button>
        {showKeepTextLayer ? (
          <button type="button" className={styles.dialogCancelBtn} onClick={() => onChoose('keep')}>
            {t('knowledge.extract_hint_keep', '仍用文字层')}
          </button>
        ) : null}
        <button type="button" className={styles.dialogCancelBtn} onClick={() => onChoose('ocr')}>
          {currentEngine === 'ocr'
            ? t('knowledge.extract_hint_ocr_current', '继续用本地 OCR')
            : t('knowledge.extract_hint_ocr', '使用本地 OCR')}
        </button>
        {visionConfigured ? (
          <button
            type="button"
            className={styles.dialogConfirmBtn}
            disabled={!ready}
            onClick={() => onChoose('vision')}
          >
            {ready
              ? t('knowledge.extract_hint_vision', '使用视觉提取')
              : t('knowledge.extract_hint_vision_wait', '使用视觉提取（{{seconds}}）', {
                  seconds: secondsLeft
                })}
          </button>
        ) : (
          <button type="button" className={styles.dialogConfirmBtn} onClick={onOpenVisionSettings}>
            {t('knowledge.extract_hint_open_settings', '去配置视觉模型')}
          </button>
        )}
      </div>
    </KnowledgeDialog>
  )
}
