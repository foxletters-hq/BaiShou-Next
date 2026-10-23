import React from 'react'
import { Text, View, type ViewStyle } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Button, useNativeTheme } from '@baishou/ui/native'
import { GraphDiscriminatorLabel } from './GraphNodeSameNameList'
import { styles } from './GraphScreen.styles'

export function GraphCanvasNodePeek(props: {
  name: string
  discriminator?: string | null
  onOpenInOps?: () => void
  onOpenDetail?: () => void
  style?: ViewStyle
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const onOpen = props.onOpenDetail ?? props.onOpenInOps
  return (
    <View
      style={[
        styles.peekCard,
        { backgroundColor: colors.bgSurface, borderColor: colors.borderMuted },
        props.style
      ]}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.peekName, { color: colors.textPrimary }]} numberOfLines={1}>
          {props.name}
        </Text>
        <GraphDiscriminatorLabel value={props.discriminator} />
      </View>
      <Button variant="outlined" size="sm" onPress={onOpen}>
        {t('graph.open_node_detail', '打开节点详情')}
      </Button>
    </View>
  )
}
