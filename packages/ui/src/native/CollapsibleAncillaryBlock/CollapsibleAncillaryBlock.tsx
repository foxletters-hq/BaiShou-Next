import React, { useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated'
import { useNativeTheme } from '../theme'
import { CollapsibleHeight } from '../CollapsibleHeight'

const CHEVRON_MS = 250

export interface CollapsibleAncillaryBlockProps {
  headerIcon: string
  title: string
  open: boolean
  onToggle: () => void
  children?: React.ReactNode
  /** 折叠态下展示的预览（如思考流式预览） */
  preview?: React.ReactNode
  /** 流式工具条等场景：仅展示、不可折叠 */
  collapsible?: boolean
}

/** 对齐 desktop CollapsibleAncillaryBlock — 思考过程 / 工具调用等附属块外壳 */
export const CollapsibleAncillaryBlock: React.FC<CollapsibleAncillaryBlockProps> = ({
  headerIcon,
  title,
  open,
  onToggle,
  children,
  preview,
  collapsible = true
}) => {
  const { colors } = useNativeTheme()
  const chevronRotation = useSharedValue(open ? 1 : 0)

  useEffect(() => {
    const target = collapsible && !open ? 0 : 1
    chevronRotation.value = withTiming(target, {
      duration: CHEVRON_MS,
      easing: Easing.bezier(0.25, 0.8, 0.25, 1)
    })
  }, [open, collapsible, chevronRotation])

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-90 + chevronRotation.value * 90}deg` }]
  }))

  const bodyExpanded = collapsible
    ? open
      ? Boolean(children)
      : Boolean(preview)
    : Boolean(children)
  const bodyContent = open ? children : preview

  return (
    <View
      style={[
        styles.shell,
        {
          borderColor: colors.borderSubtle,
          backgroundColor: colors.bgSurface,
          borderRadius: 12
        }
      ]}
    >
      <TouchableOpacity
        style={[styles.header, { backgroundColor: colors.bgSurfaceNormal }]}
        onPress={collapsible ? onToggle : undefined}
        activeOpacity={collapsible ? 0.7 : 1}
        disabled={!collapsible}
      >
        <Text style={styles.headerIcon}>{headerIcon}</Text>
        <Text style={[styles.headerTitle, { color: colors.textSecondary }]} numberOfLines={1}>
          {title}
        </Text>
        <Animated.View style={chevronStyle}>
          <MaterialIcons name="expand-more" size={18} color={colors.textTertiary} />
        </Animated.View>
      </TouchableOpacity>

      <CollapsibleHeight expanded={bodyExpanded} animation="ease" durationMs={300}>
        {bodyContent ? (
          <View style={[styles.body, { borderTopColor: colors.borderSubtle }]}>{bodyContent}</View>
        ) : (
          <View />
        )}
      </CollapsibleHeight>
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    marginBottom: 8,
    borderWidth: 1.5,
    overflow: 'hidden'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 42
  },
  headerIcon: {
    fontSize: 14,
    width: 24,
    textAlign: 'center',
    marginRight: 8,
    lineHeight: 16
  },
  headerTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19
  },
  body: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth
  }
})
