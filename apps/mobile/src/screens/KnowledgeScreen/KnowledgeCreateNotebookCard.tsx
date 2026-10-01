import React from 'react'
import { View, Text, Pressable } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react-native'
import { Card, useNativeTheme } from '@baishou/ui/native'
import { createKnowledgeScreenStyles } from './knowledge-screen.styles'

export interface KnowledgeCreateNotebookCardProps {
  busy?: boolean
  onPress: () => void
}

export function KnowledgeCreateNotebookCard({ busy, onPress }: KnowledgeCreateNotebookCardProps) {
  const { t } = useTranslation()
  const { colors, tokens, isDark } = useNativeTheme()
  const styles = createKnowledgeScreenStyles(colors, tokens, isDark)

  return (
    <View style={styles.notebookCardWrapper}>
      <Pressable
        onPress={onPress}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={t('knowledge.new_notebook', '新建笔记本')}
      >
        <Card style={styles.createCardInner}>
          <View style={styles.createCardIcon}>
            <Plus size={22} color={colors.primary} strokeWidth={2.5} />
          </View>
          <Text style={styles.createCardTitle}>{t('knowledge.new_notebook', '新建笔记本')}</Text>
          <Text style={styles.createCardDesc}>
            {t('knowledge.create_card_hint', '创建主题容器')}
          </Text>
        </Card>
      </Pressable>
    </View>
  )
}
