import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { GRAPH_FOCUS_DEPTH_OPTIONS, type GraphFocusDepth } from '@baishou/shared'
import { useNativeTheme } from '@baishou/ui/native'
import { styles } from './GraphScreen.styles'
import { mobileTypography } from '@baishou/ui/theme/tokens'

import type { StyleProp, ViewStyle } from 'react-native'

export function GraphScreenDepthChips(props: {
  focusDepth: GraphFocusDepth
  onChange: (depth: GraphFocusDepth) => void
  showLabel?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  return (
    <View style={[styles.depthRow, props.style]}>
      {props.showLabel !== false ? (
        <Text style={[styles.depthLabel, { color: colors.textSecondary }]}>
          {t('graph.focus_depth', '展开')}
        </Text>
      ) : null}
      {GRAPH_FOCUS_DEPTH_OPTIONS.map((d) => {
        const active = props.focusDepth === d
        return (
          <Pressable
            key={d}
            onPress={() => props.onChange(d)}
            style={[
              styles.depthChip,
              {
                backgroundColor: active ? colors.primary : 'transparent',
                borderColor: active ? colors.primary : colors.borderSubtle
              }
            ]}
          >
            <Text
              style={{
                color: active ? colors.textOnPrimary : colors.textSecondary,
                fontSize: mobileTypography.caption.fontSize,
                fontWeight: active ? '700' : '500'
              }}
            >
              {d}
              {t('graph.focus_depth_unit', '级')}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
