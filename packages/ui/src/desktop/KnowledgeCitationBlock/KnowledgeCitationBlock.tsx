import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  formatKnowledgeCitationHeading,
  knowledgeCitationAnchorKey,
  parseKnowledgeCitationHref,
  type KnowledgeCitationView
} from '@baishou/shared'
import { Button } from '../Button/Button'
import { Modal } from '../Modal/Modal'
import styles from './KnowledgeCitationBlock.module.css'

type KnowledgeCitationOpener = {
  openFromHref: (href: string) => boolean
}

const KnowledgeCitationContext = createContext<KnowledgeCitationOpener>({
  openFromHref: () => false
})

export function useKnowledgeCitationOpener(): KnowledgeCitationOpener {
  return useContext(KnowledgeCitationContext)
}

export function KnowledgeCitationBlock({
  citations,
  anchorKey = 'turn',
  children
}: {
  citations: KnowledgeCitationView[]
  anchorKey?: string
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const expectedKey = knowledgeCitationAnchorKey(anchorKey)
  const openFromHref = useCallback(
    (href: string) => {
      const parsed = parseKnowledgeCitationHref(href)
      if (!parsed || parsed.anchorKey !== expectedKey) return false
      if (parsed.index < 1 || parsed.index > citations.length) return false
      setOpenIndex(parsed.index)
      return true
    },
    [citations.length, expectedKey]
  )
  const value = useMemo(() => ({ openFromHref }), [openFromHref])
  const citation = openIndex != null ? (citations[openIndex - 1] ?? null) : null

  if (citations.length === 0) return <>{children}</>

  return (
    <KnowledgeCitationContext.Provider value={value}>
      {children}
      <Modal
        isOpen={citation != null}
        onClose={() => setOpenIndex(null)}
        title={citation && openIndex != null ? formatKnowledgeCitationHeading(citation, openIndex) : ''}
        closeOnOverlayClick
        animation="fade"
        className={styles.dialog}
      >
        {citation?.excerpt ? <div className={styles.excerpt}>{citation.excerpt}</div> : null}
        <div className={styles.actions}>
          <Button type="button" onClick={() => setOpenIndex(null)}>
            {t('common.close', '关闭')}
          </Button>
        </div>
      </Modal>
    </KnowledgeCitationContext.Provider>
  )
}
