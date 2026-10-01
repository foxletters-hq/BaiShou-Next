import React from 'react'
import { Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Button, useNativeTheme } from '@baishou/ui/native'
import { styles } from './GraphScreen.styles'
import type { GraphCostEstimate } from './graph-screen.types'

export function GraphScreenEmptyGuide(props: {
  estimate: GraphCostEstimate | null
  pendingCount: number
  onStartOrganize: () => void
  onDismissGuide: () => void
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  return (
    <View style={styles.guide}>
      <Text style={[styles.guideTitle, { color: colors.textPrimary }]}>
        {t('graph.empty_guide_title', '还没有开始整理你的人生关系图')}
      </Text>
      <Text style={[styles.guideBody, { color: colors.textSecondary }]}>
        {t(
          'graph.empty_guide_body',
          '有 {{count}} 篇还没整理。点「开始整理记忆」会补齐向量并整理关系图谱。',
          {
            count: props.estimate?.entryCount ?? props.pendingCount
          }
        )}
      </Text>
      <View style={styles.row}>
        <Button onPress={props.onStartOrganize}>
          {t('memory.start_organize', '开始整理记忆')}
        </Button>
        <Button variant="outlined" onPress={props.onDismissGuide}>
          {t('graph.later', '以后再说')}
        </Button>
      </View>
    </View>
  )
}
