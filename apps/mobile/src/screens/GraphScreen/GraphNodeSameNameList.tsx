import React from 'react'
import { Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Button, useNativeTheme } from '@baishou/ui/native'
import type { GraphRegisteredSameNameEntity } from '@/src/services/graph-name-candidates.util'

export function GraphDiscriminatorLabel(props: { value?: string | null }) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const text = (props.value ?? '').trim()
  if (!text) return null
  return (
    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
      {t('graph.discriminator_label', '区分')} {text}
    </Text>
  )
}

export function GraphNodeSameNameList(props: {
  entities: GraphRegisteredSameNameEntity[]
  onOpen: (nodeId: string) => void
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  if (props.entities.length === 0) return null
  return (
    <View style={{ gap: 8, marginTop: 4 }}>
      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
        {t('graph.same_name_entities', '同名实体')}
      </Text>
      {props.entities.map((entity) => (
        <View key={entity.nodeId} style={{ gap: 4 }}>
          <Button variant="outlined" onPress={() => props.onOpen(entity.nodeId)}>
            {entity.name}
          </Button>
          <GraphDiscriminatorLabel value={entity.label || entity.discriminator} />
        </View>
      ))}
    </View>
  )
}
