import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../Button/Button'
import { Modal } from '../Modal/Modal'
import { RagMemoryHighlightedText } from './RagMemoryHighlightedText'
import styles from './RagMemoryView.module.css'

export function RagMemoryEntryPreviewModal({
  open,
  text,
  keyword,
  onClose
}: {
  open: boolean
  text: string
  keyword?: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) setCopied(false)
  }, [open])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      closeOnOverlayClick
      animation="fade"
      zIndex={3200}
      className={styles.entryPreviewModal}
      title={t('settings.rag_view_entry_title', '记忆片段')}
    >
      <div className={styles.entryPreviewBody}>
        <RagMemoryHighlightedText text={text} keyword={keyword} />
      </div>
      <div className={styles.entryPreviewActions}>
        <Button type="button" variant="outlined" size="small" onClick={() => void handleCopy()}>
          {copied ? t('settings.rag_copy_entry_done', '已复制') : t('common.copy', '复制')}
        </Button>
        <Button type="button" variant="outlined" size="small" onClick={onClose}>
          {t('common.close', '关闭')}
        </Button>
      </div>
    </Modal>
  )
}
