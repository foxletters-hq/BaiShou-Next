import React from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { BookOpen, Plus } from 'lucide-react-native'
import { Button, useNativeTheme } from '@baishou/ui/native'
import { createKnowledgeScreenStyles } from './knowledge-screen.styles'

export interface KnowledgeEmptyStateProps {
  busy?: boolean
  onCreateOpen: () => void
}

export function KnowledgeEmptyState({ busy, onCreateOpen }: KnowledgeEmptyStateProps) {
  const { t } = useTranslation()
  const { colors, tokens, isDark } = useNativeTheme()
  const styles = createKnowledgeScreenStyles(colors, tokens, isDark)

  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle}>
        <BookOpen size={38} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>{t('knowledge.empty_vault_title', '开启你的知识库')}</Text>
      <Text style={styles.emptyDesc}>
        {t('knowledge.empty_notebooks', '还没有笔记本，先新建一个主题容器。')}
      </Text>
      <Button isDisabled={busy} onPress={onCreateOpen}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Plus size={16} color={colors.textOnPrimary} />
          <Text style={{ color: colors.textOnPrimary, fontWeight: '600' }}>
            {t('knowledge.new_notebook', '新建笔记本')}
          </Text>
        </View>
      </Button>
    </View>
  )
}
