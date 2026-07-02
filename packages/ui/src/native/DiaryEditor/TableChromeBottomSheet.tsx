import React, { useEffect, useRef } from 'react'
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle
} from 'react-native'
import { useNativeTheme } from '../theme'
import { Button } from '../Button'
import type { DiaryCmTableSheetSectionPayload } from '../../shared/diary-codemirror/types'

export interface TableChromeBottomSheetProps {
  visible: boolean
  title: string
  sections: DiaryCmTableSheetSectionPayload[]
  /** 距屏幕底部的偏移（Markdown 工具栏 + 键盘） */
  bottomOffset: number
  onPick: (itemId: string) => void
  onDismiss: () => void
  style?: StyleProp<ViewStyle>
}

const SLIDE_MS = 340

export const TableChromeBottomSheet: React.FC<TableChromeBottomSheetProps> = ({
  visible,
  title,
  sections,
  bottomOffset,
  onPick,
  onDismiss,
  style
}) => {
  const { colors, tokens } = useNativeTheme()
  const translateY = useRef(new Animated.Value(320)).current
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!visible) {
      translateY.setValue(320)
      opacity.setValue(0)
      return
    }

    translateY.setValue(320)
    opacity.setValue(0)
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: SLIDE_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: SLIDE_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      })
    ]).start()
  }, [opacity, translateY, visible])

  const animateOut = (done: () => void) => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 320,
        duration: SLIDE_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: SLIDE_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true
      })
    ]).start(() => done())
  }

  const handleDismiss = () => {
    animateOut(onDismiss)
  }

  const handlePick = (itemId: string) => {
    animateOut(() => onPick(itemId))
  }

  if (!visible) return null

  return (
    <View style={[styles.host, style]} pointerEvents="box-none">
      <Pressable
        style={styles.dismiss}
        onPress={handleDismiss}
        accessibilityRole="button"
        accessibilityLabel="关闭菜单"
      />
      <Animated.View
        style={[
          styles.sheet,
          {
            marginBottom: bottomOffset,
            backgroundColor: colors.bgSurfaceNormal,
            borderColor: colors.borderSubtle,
            paddingHorizontal: tokens.spacing.md,
            paddingTop: tokens.spacing.sm,
            paddingBottom: tokens.spacing.md,
            opacity,
            transform: [{ translateY }]
          }
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: colors.borderSubtle }]} />
        {title ? (
          <Text
            style={[
              styles.title,
              { color: colors.textSecondary, marginBottom: tokens.spacing.sm }
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
        ) : null}
        <View style={[styles.body, { gap: tokens.spacing.sm }]}>
          {sections.map((section, sectionIndex) => (
            <View
              key={`section-${sectionIndex}`}
              style={sectionIndex > 0 ? { gap: tokens.spacing.sm, marginTop: tokens.spacing.sm } : { gap: tokens.spacing.sm }}
            >
              {section.items.map((item) => (
                <Button
                  key={item.id}
                  variant="outline"
                  destructive={Boolean(item.destructive)}
                  disabled={Boolean(item.disabled)}
                  onPress={() => handlePick(item.id)}
                  style={{
                    width: '100%',
                    backgroundColor: colors.bgSurface,
                    borderColor: colors.borderSubtle
                  }}
                >
                  {item.label}
                </Button>
              ))}
            </View>
          ))}
        </View>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    elevation: 40
  },
  dismiss: {
    flex: 1
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 16
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 999,
    alignSelf: 'center',
    marginBottom: 8
  },
  title: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 4
  },
  body: {}
})
