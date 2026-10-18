import React from 'react'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '@baishou/ui/native'
import { GraphDesktopOnlyNotice } from './GraphDesktopOnlyNotice'
import { styles } from './GraphScreen.styles'
import { StackScreenLayout } from '../../components/StackScreenLayout'
import { getStackScreenChrome } from '../../components/stackScreenChrome'

export function GraphCanvasScreen() {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const chrome = getStackScreenChrome(colors)

  return (
    <StackScreenLayout
      title={t('graph.title', '人生关系图')}
      {...chrome}
      contentStyle={styles.layoutContent}
    >
      <GraphDesktopOnlyNotice />
    </StackScreenLayout>
  )
}
