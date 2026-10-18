import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  formatKnowledgeCitationHeading,
  knowledgeCitationAnchorKey,
  parseKnowledgeCitationHref,
  type KnowledgeCitationView
} from '@baishou/shared'
import { Button } from '../Button'
import { Modal, modalActionsStyle } from '../Modal'
import { useNativeTheme } from '../theme'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

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
  const { colors } = useNativeTheme()
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

  return (
    <KnowledgeCitationContext.Provider value={value}>
      {children}
      {citations.length > 0 ? (
        <Modal
          visible={citation != null}
          title={
            citation && openIndex != null ? formatKnowledgeCitationHeading(citation, openIndex) : ''
          }
          onClose={() => setOpenIndex(null)}
        >
          {citation?.excerpt ? (
            <ScrollView
              style={styles.excerptScroll}
              contentContainerStyle={styles.excerptContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={[styles.excerpt, { color: colors.textPrimary }]}>
                {citation.excerpt}
              </Text>
            </ScrollView>
          ) : null}
          <View style={modalActionsStyle}>
            <Button variant="outlined" size="sm" onPress={() => setOpenIndex(null)}>
              {t('common.close', '关闭')}
            </Button>
          </View>
        </Modal>
      ) : null}
    </KnowledgeCitationContext.Provider>
  )
}

const styles = StyleSheet.create({
  excerptScroll: {
    maxHeight: 360
  },
  excerptContent: {
    paddingRight: sharedTokens.spacing.mdTight
  },
  excerpt: {
    fontSize: mobileTypography.body.fontSize,
    lineHeight: 24
  }
})
