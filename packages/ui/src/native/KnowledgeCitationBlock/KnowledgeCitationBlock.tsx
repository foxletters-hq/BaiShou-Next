import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  formatKnowledgeCitationLocation,
  type KnowledgeCitationView
} from '@baishou/shared'
import { useNativeTheme } from '../theme'

export function KnowledgeCitationBlock({
  citations
}: {
  citations: KnowledgeCitationView[]
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  if (citations.length === 0) return null

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: colors.textSecondary }]}>
        {t('knowledge.citations', '引用')}
      </Text>
      {citations.map((citation, index) => {
        const location = formatKnowledgeCitationLocation(citation)
        const notebook = citation.notebookName.trim()
        return (
          <View key={`${citation.sourceId || citation.title}-${index}`} style={styles.item}>
            <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>
              [{index + 1}] {notebook ? `${notebook} · ` : ''}
              {citation.title}
              {location ? `（${location}）` : ''}
            </Text>
            {citation.excerpt ? (
              <Text style={[styles.excerpt, { color: colors.textSecondary }]}>{citation.excerpt}</Text>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    gap: 8
  },
  title: {
    fontSize: 12,
    fontWeight: '600'
  },
  item: {
    gap: 4
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18
  },
  excerpt: {
    fontSize: 13,
    lineHeight: 18
  }
})
