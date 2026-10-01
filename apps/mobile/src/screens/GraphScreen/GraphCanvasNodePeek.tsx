import React from 'react'
import { Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Button, useNativeTheme } from '@baishou/ui/native'
import { GraphDiscriminatorLabel } from './GraphNodeSameNameList'
import { styles } from './GraphScreen.styles'

export function GraphCanvasNodePeek(props: {
  name: string
  discriminator?: string | null
  onOpenInOps: () => void
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  return (
    <View
      style={[
        styles.peekCard,
        { backgroundColor: colors.bgSurface, borderColor: colors.borderMuted }
      ]}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.peekName, { color: colors.textPrimary }]} numberOfLines={1}>
          {props.name}
        </Text>
        <GraphDiscriminatorLabel value={props.discriminator} />
      </View>
      <Button onPress={props.onOpenInOps}>{t('graph.open_in_ops', '在操作台打开')}</Button>
    </View>
  )
}
