import React from 'react'
import { useTranslation } from 'react-i18next'
import { NOTEBOOK_CARD_TONES, type NotebookCardTone } from '@baishou/shared'
import styles from './KnowledgePage.module.css'

export const TONE_CLASS: Record<NotebookCardTone, string> = {
  lavender: styles.toneLavender,
  cream: styles.toneCream,
  peach: styles.tonePeach,
  mint: styles.toneMint,
  sky: styles.toneSky,
  rose: styles.toneRose,
  lilac: styles.toneLilac,
  sand: styles.toneSand
}

const TONE_LABEL_KEY: Record<NotebookCardTone, string> = {
  lavender: 'knowledge.cover_tone_lavender',
  cream: 'knowledge.cover_tone_cream',
  peach: 'knowledge.cover_tone_peach',
  mint: 'knowledge.cover_tone_mint',
  sky: 'knowledge.cover_tone_sky',
  rose: 'knowledge.cover_tone_rose',
  lilac: 'knowledge.cover_tone_lilac',
  sand: 'knowledge.cover_tone_sand'
}

const TONE_LABEL_FALLBACK: Record<NotebookCardTone, string> = {
  lavender: '淡紫',
  cream: '奶油',
  peach: '蜜桃',
  mint: '薄荷',
  sky: '天空',
  rose: '玫瑰',
  lilac: '丁香',
  sand: '沙色'
}

export interface NotebookCoverTonePickerProps {
  value: NotebookCardTone | ''
  onChange: (tone: NotebookCardTone) => void
  disabled?: boolean
}

export const NotebookCoverTonePicker: React.FC<NotebookCoverTonePickerProps> = ({
  value,
  onChange,
  disabled
}) => {
  const { t } = useTranslation()

  return (
    <div className={styles.tonePicker} role="radiogroup" aria-label={t('knowledge.cover_tone', '封面颜色')}>
      {NOTEBOOK_CARD_TONES.map((tone) => {
        const selected = value === tone
        const label = t(TONE_LABEL_KEY[tone], TONE_LABEL_FALLBACK[tone])
        return (
          <button
            key={tone}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            title={label}
            disabled={disabled}
            className={`${styles.toneSwatch} ${TONE_CLASS[tone]} ${
              selected ? styles.toneSwatchSelected : ''
            }`}
            onClick={() => onChange(tone)}
          />
        )
      })}
    </div>
  )
}
