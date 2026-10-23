import React from 'react'
import { Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '@baishou/ui/native'
import { styles } from './GraphScreen.styles'

export function GraphDesktopOnlyNotice() {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  return (
    <View style={[styles.guide, { flex: 1, justifyContent: 'center' }]}>
      <Text style={[styles.guideTitle, { color: colors.textPrimary }]}>
        {t('graph.mobile_canvas_paused_title', '图谱画布暂不在移动端显示')}
      </Text>
      <Text style={[styles.guideBody, { color: colors.textSecondary }]}>
        {t(
          'graph.mobile_canvas_paused_body',
          '节点关系图请到桌面端查看。移动端仍可整理、复核待确认的关系。'
        )}
      </Text>
    </View>
  )
}
