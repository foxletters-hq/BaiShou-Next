import React, { useRef, useState } from 'react'
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutRectangle
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react-native'
import { formatReasoningEffortLabel, type ReasoningEffortSetting } from '@baishou/shared'
import { useNativeTheme } from '../theme'

const PANEL_WIDTH = 168

export function ReasoningEffortControl({
  value,
  options,
  onChange
}: {
  value: ReasoningEffortSetting
  options: ReasoningEffortSetting[]
  onChange: (value: ReasoningEffortSetting) => void
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const triggerRef = useRef<View>(null)
  const [anchor, setAnchor] = useState<LayoutRectangle | null>(null)
  const label = formatReasoningEffortLabel(value)
  const sectionLabel = t('agent.reasoning.effort_section', '思考强度')

  const open = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height })
    })
  }

  const close = () => setAnchor(null)

  const panelHeight = 36 + options.length * 30
  const panelLeft = anchor
    ? Math.min(
        Math.max(8, anchor.x + anchor.width - PANEL_WIDTH),
        Math.max(8, windowWidth - PANEL_WIDTH - 8)
      )
    : 0
  const panelTop = anchor
    ? Math.max(8, Math.min(anchor.y - panelHeight - 8, windowHeight - panelHeight - 8))
    : 0

  return (
    <>
      <View ref={triggerRef} collapsable={false}>
        <Pressable
          onPress={open}
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          accessibilityRole="button"
          accessibilityLabel={`${sectionLabel} ${label}`}
          style={({ pressed }) => [
            styles.trigger,
            pressed ? { backgroundColor: colors.bgSurfaceHigh } : null
          ]}
        >
          <Text style={[styles.triggerLabel, { color: colors.textSecondary }]} numberOfLines={1}>
            {label}
          </Text>
        </Pressable>
      </View>
      <Modal visible={anchor != null} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />
          <View
            style={[
              styles.panel,
              {
                top: panelTop,
                left: panelLeft,
                width: PANEL_WIDTH,
                backgroundColor: colors.bgSurface,
                borderColor: colors.borderMuted
              }
            ]}
          >
            <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>
              {sectionLabel}
            </Text>
            {options.map((option) => {
              const selected = option === value
              return (
                <Pressable
                  key={option}
                  onPress={() => {
                    onChange(option)
                    close()
                  }}
                  style={({ pressed }) => [
                    styles.row,
                    selected || pressed ? { backgroundColor: colors.bgSurfaceHigh } : null
                  ]}
                >
                  <Text style={[styles.rowLabel, { color: colors.textPrimary }]} numberOfLines={1}>
                    {formatReasoningEffortLabel(option)}
                  </Text>
                  {selected ? (
                    <Check size={14} color={colors.textPrimary} strokeWidth={2} />
                  ) : (
                    <View style={styles.checkSpacer} />
                  )}
                </Pressable>
              )
            })}
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  trigger: {
    height: 28,
    maxWidth: 96,
    paddingHorizontal: 10,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center'
  },
  triggerLabel: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18
  },
  backdrop: {
    flex: 1
  },
  panel: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 12,
    padding: 6,
    gap: 2
  },
  sectionLabel: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 4,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.2
  },
  row: {
    height: 28,
    minHeight: 28,
    paddingHorizontal: 10,
    borderRadius: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  rowLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18
  },
  checkSpacer: {
    width: 16,
    height: 16
  }
})
