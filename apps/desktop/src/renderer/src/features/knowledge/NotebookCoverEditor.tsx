import React from 'react'
import type { NotebookCardTone } from '@baishou/shared'
import { SegmentedControl } from '@baishou/ui'
import { NotebookCoverTonePicker } from './NotebookCoverTonePicker'
import type { NotebookCoverMode } from './notebook-cover-mode'
import styles from './KnowledgePage.module.css'

export type NotebookCoverEditorLabels = {
  cover: string
  emoji: string
  pickIcon: string
  uploadImage: string
  clearImage: string
}

export const NotebookCoverEditor: React.FC<{
  mode: NotebookCoverMode
  onModeChange: (mode: NotebookCoverMode) => void
  tone: NotebookCardTone | ''
  onToneChange: (tone: NotebookCardTone) => void
  icon?: string
  onPickIcon: () => void
  onUploadImage: () => void
  onClearImage?: () => void
  imageName?: string
  hasImage?: boolean
  disabled?: boolean
  className?: string
  labelClassName?: string
  labels: NotebookCoverEditorLabels
}> = ({
  mode,
  onModeChange,
  tone,
  onToneChange,
  icon,
  onPickIcon,
  onUploadImage,
  onClearImage,
  imageName,
  hasImage,
  disabled,
  className,
  labelClassName,
  labels
}) => {
  return (
    <div className={className}>
      <span className={labelClassName}>{labels.cover}</span>
      <SegmentedControl
        stretch
        value={mode}
        disabled={disabled}
        aria-label={labels.cover}
        options={[
          { value: 'emoji', label: labels.emoji },
          { value: 'image', label: labels.uploadImage }
        ]}
        onChange={onModeChange}
      />
      {mode === 'emoji' ? (
        <div className={styles.coverEditorBody}>
          <NotebookCoverTonePicker value={tone} onChange={onToneChange} disabled={disabled} />
          <button
            type="button"
            className={styles.coverIconTrigger}
            onClick={onPickIcon}
            disabled={disabled}
          >
            {icon ? (
              <span className={styles.coverIconPreview} aria-hidden>
                {icon}
              </span>
            ) : null}
            {labels.pickIcon}
          </button>
        </div>
      ) : (
        <div className={styles.coverEditorBody}>
          <div className={styles.coverImageActions}>
            <button
              type="button"
              className={styles.coverImageBtn}
              onClick={onUploadImage}
              disabled={disabled}
            >
              {labels.uploadImage}
            </button>
            {hasImage && onClearImage ? (
              <button
                type="button"
                className={styles.coverImageBtn}
                onClick={onClearImage}
                disabled={disabled}
              >
                {labels.clearImage}
              </button>
            ) : null}
          </div>
          {imageName ? <p className={styles.coverImageName}>{imageName}</p> : null}
        </div>
      )}
    </div>
  )
}
