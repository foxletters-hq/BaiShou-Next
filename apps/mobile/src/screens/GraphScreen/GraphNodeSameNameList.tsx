import React from 'react'
import { Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Button, useNativeTheme } from '@baishou/ui/native'
import type { GraphRegisteredSameNameEntity } from '@/src/services/graph-name-candidates.util'
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'

export function GraphDiscriminatorLabel(props: { value?: string | null }) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const text = (props.value ?? '').trim()
  if (!text) return null
  return (
    <Text style={{ color: colors.textSecondary, fontSize: mobileTypography.caption.fontSize }}>
      {t('graph.discriminator_label', '区分')} {text}
    </Text>
  )
}

export function GraphNodeSameNameList(props: {
  entities: GraphRegisteredSameNameEntity[]
  onOpen: (nodeId: string) => void
  onRevertSplit?: (discriminator: string) => void
  busy?: boolean
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  if (props.entities.length === 0) return null
  return (
    <View style={{ gap: sharedTokens.spacing.sm, marginTop: sharedTokens.spacing.xs }}>
      <Text style={{ color: colors.textSecondary, fontSize: mobileTypography.caption.fontSize }}>
        {t('graph.same_name_siblings', '同名节点')}
      </Text>
      {props.entities.map((entity) => (
        <View key={entity.nodeId} style={{ gap: sharedTokens.spacing.xs }}>
          <Button variant="outlined" onPress={() => props.onOpen(entity.nodeId)}>
            {entity.name}
          </Button>
          {entity.discriminator && props.onRevertSplit ? (
            <Button
              variant="outlined"
              isDisabled={props.busy}
              onPress={() => props.onRevertSplit?.(entity.discriminator)}
            >
              {t('graph.revert_split', '撤回拆分')}
            </Button>
          ) : null}
          {entity.discriminator ? (
            <GraphDiscriminatorLabel value={entity.label || entity.discriminator} />
          ) : (
            <Text
              style={{ color: colors.textSecondary, fontSize: mobileTypography.caption.fontSize }}
            >
              {t('graph.bare_entity', '原实体')}
            </Text>
          )}
        </View>
      ))}
    </View>
  )
}
