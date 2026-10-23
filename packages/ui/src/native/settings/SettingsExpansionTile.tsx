import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated'
import { useNativeTheme } from '../theme'
import { settingsHubListStyles as hubStyles } from './settings-hub.styles'
import { SettingsListLeadingIcon } from './SettingsListLeadingIcon'
import { CollapsibleHeight } from '../CollapsibleHeight'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

const SLIDE_MS = sharedTokens.animation.moderate

export type SettingsExpansionFrame = 'primary' | 'subtle' | 'none'

export interface SettingsExpansionTileProps {
  icon?: React.ReactNode
  title: string
  titleAddon?: React.ReactNode
  subtitle?: string
  children: React.ReactNode
  embedded?: boolean
  isLast?: boolean
  /**
   * 折叠时是否仍挂载 body。折叠区块里的卡片/Markdown 在 Android 上会穿过
   * overflow 裁剪并盖住标题，导致无法点击；原文片段这类重内容应关掉。
   */
  keepMounted?: boolean
  /**
   * 展开时 body 的外框样式：
   * - 'subtle'：灰色细线边框 + 微圆角，无底色（默认）
   * - 'primary'：主题色边框 + 浅色填充 + 轻微光晕
   * - 'none'：不绘制边框
   */
  frame?: SettingsExpansionFrame
}

export const SettingsExpansionTile: React.FC<SettingsExpansionTileProps> = ({
  icon,
  title,
  titleAddon,
  subtitle,
  children,
  embedded = false,
  isLast = false,
  keepMounted = true,
  frame = 'subtle'
}) => {
  const { colors, tokens } = useNativeTheme()
  const [open, setOpen] = useState(false)
  const chevronRotation = useSharedValue(0)
  const frameOpacity = useSharedValue(0)

  useEffect(() => {
    chevronRotation.value = withTiming(open ? 1 : 0, {
      duration: SLIDE_MS,
      easing: Easing.bezier(0.4, 0, 0.2, 1)
    })
  }, [open, chevronRotation])

  useEffect(() => {
    frameOpacity.value = withTiming(open ? 1 : 0, {
      duration: SLIDE_MS,
      easing: Easing.bezier(0.4, 0, 0.2, 1)
    })
  }, [open, frameOpacity])

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value * 90}deg` }]
  }))

  const frameStyle = useAnimatedStyle(() => ({
    opacity: frameOpacity.value
  }))

  const toggle = () => {
    setOpen((prev) => !prev)
  }

  const showRowDivider = embedded && (!isLast || open)
  const showFrame = frame !== 'none'

  const header = (
    <TouchableOpacity
      onPress={toggle}
      activeOpacity={0.65}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      style={[
        hubStyles.row,
        embedded &&
          showRowDivider && [hubStyles.rowDivider, { borderBottomColor: colors.borderSubtle }],
        !embedded && {
          paddingHorizontal: sharedTokens.spacing.mdSnug,
          paddingVertical: sharedTokens.spacing.mdSnug
        }
      ]}
    >
      {icon ? <SettingsListLeadingIcon>{icon}</SettingsListLeadingIcon> : null}
      <View style={{ flex: 1 }}>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: sharedTokens.spacing.xsPlus }}
        >
          <Text style={[hubStyles.rowTitle, { color: colors.textPrimary }]}>{title}</Text>
          {titleAddon}
        </View>
        {subtitle ? (
          <Text
            style={{
              fontSize: mobileTypography.secondary.fontSize,
              color: colors.textSecondary,
              marginTop: sharedTokens.spacing.xxs,
              fontWeight: '400'
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Animated.Text style={[hubStyles.hubChevron, { color: colors.textTertiary }, chevronStyle]}>
        ›
      </Animated.Text>
    </TouchableOpacity>
  )

  // body 内层 padding：frame 模式用紧凑 padding（外层已自带 margin），
  // 否则沿用原本的 embedded / standalone padding
  const innerPadding = showFrame
    ? styles.bodyFramedPadding
    : embedded
      ? styles.embeddedBody
      : styles.standaloneBody

  // body 最末行底边线：仅在 embedded 且非最后一项时显示
  const lastRowDivider =
    embedded && !isLast
      ? {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.borderSubtle
        }
      : null

  const bodyInner = showFrame ? (
    <Animated.View style={frameStyle}>
      <Animated.View
        style={[
          styles.bodyFramedOuter,
          frame === 'primary' ? styles.bodyFramedOuterPrimary : styles.bodyFramedOuterSubtle,
          {
            borderColor: frame === 'primary' ? colors.primary : colors.borderStrong,
            backgroundColor: frame === 'primary' ? colors.primaryContainer : 'transparent',
            borderRadius: tokens.radius.md
          }
        ]}
      >
        <View style={[innerPadding, lastRowDivider]}>{children}</View>
      </Animated.View>
    </Animated.View>
  ) : (
    <View style={[innerPadding, lastRowDivider]}>{children}</View>
  )

  const mountedBody = keepMounted || open ? bodyInner : null

  if (embedded) {
    return (
      <View>
        {header}
        <CollapsibleHeight expanded={open}>{mountedBody}</CollapsibleHeight>
      </View>
    )
  }

  return (
    <View
      style={{
        marginBottom: sharedTokens.spacing.mdTight,
        backgroundColor: colors.bgSurface,
        borderRadius: tokens.radius.lg,
        overflow: 'hidden'
      }}
    >
      {header}
      <CollapsibleHeight expanded={open}>{mountedBody}</CollapsibleHeight>
    </View>
  )
}

const styles = StyleSheet.create({
  embeddedBody: {
    paddingHorizontal: sharedTokens.spacing.mdSnug,
    paddingBottom: sharedTokens.spacing.mdSnug
  },
  standaloneBody: {
    paddingHorizontal: sharedTokens.spacing.md,
    paddingBottom: sharedTokens.spacing.md
  },
  // frame 模式：外层带边框、阴影、margin；内层仅 padding
  bodyFramedOuter: {
    marginHorizontal: sharedTokens.spacing.sm,
    marginBottom: sharedTokens.spacing.sm,
    marginTop: sharedTokens.spacing.xs
  },
  bodyFramedOuterSubtle: {
    borderWidth: 1
  },
  bodyFramedOuterPrimary: {
    borderWidth: 1.5
  },
  bodyFramedPadding: {
    paddingHorizontal: sharedTokens.spacing.mdTight,
    paddingVertical: sharedTokens.spacing.smPlus
  }
})
