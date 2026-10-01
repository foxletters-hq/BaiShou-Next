import React from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Sparkles, Database } from 'lucide-react-native'
import { useNativeTheme } from '@baishou/ui/native'
import { createKnowledgeScreenStyles } from './knowledge-screen.styles'
import { formatKnowledgeBytesMb } from './knowledge-screen.util'

export interface KnowledgeHeroBannerProps {
  notebookCount: number
  totalSources: number
  totalChunks: number
  totalBytes: number
  totalPendingJobs: number
}

export function KnowledgeHeroBanner({
  notebookCount,
  totalSources,
  totalChunks,
  totalBytes,
  totalPendingJobs
}: KnowledgeHeroBannerProps) {
  const { t } = useTranslation()
  const { colors, tokens, isDark } = useNativeTheme()
  const styles = createKnowledgeScreenStyles(colors, tokens, isDark)

  return (
    <View style={styles.heroCard}>
      <View style={styles.heroHeader}>
        <View style={styles.heroBrandWrap}>
          <View style={styles.heroIconBadge}>
            <Sparkles size={18} color={colors.primary} />
          </View>
          <View>
            <Text style={styles.heroTitle}>{t('knowledge.vault_title', '知识库')}</Text>
            <Text style={styles.heroSubtitle}>
              {t('knowledge.vault_desc', '结构化管理专属 AI 知识库')}
            </Text>
          </View>
        </View>

        {totalPendingJobs > 0 ? (
          <View style={styles.indexingPill}>
            <View style={styles.indexingDot} />
            <Text style={styles.indexingText}>
              {t('knowledge.indexing_count', '索引中 {{count}}', {
                count: totalPendingJobs
              })}
            </Text>
          </View>
        ) : (
          <View style={styles.indexingPill}>
            <Database size={12} color={colors.primary} />
            <Text style={styles.indexingText}>{t('knowledge.vault_ready', '就绪')}</Text>
          </View>
        )}
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{notebookCount}</Text>
          <Text style={styles.statLabel}>{t('knowledge.stat_notebooks', '笔记本')}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{totalSources}</Text>
          <Text style={styles.statLabel}>{t('knowledge.stat_sources', '资料文档')}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{totalChunks}</Text>
          <Text style={styles.statLabel}>{t('knowledge.stat_chunks', '切片片段')}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatKnowledgeBytesMb(totalBytes)}</Text>
          <Text style={styles.statLabel}>MB</Text>
        </View>
      </View>
    </View>
  )
}
