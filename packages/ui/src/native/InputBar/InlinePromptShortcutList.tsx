import React from 'react'
import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native'
import type { PromptShortcut } from '@baishou/shared'
import { getShortcutCommand, getDefaultShortcutLabelsFromT, localizePromptShortcut } from '@baishou/shared'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'

export interface InlinePromptShortcutListProps {
  visible: boolean
  shortcuts: PromptShortcut[]
  selectedIndex: number
  onSelect: (shortcut: PromptShortcut) => void
}

export const InlinePromptShortcutList: React.FC<InlinePromptShortcutListProps> = ({
  visible,
  shortcuts,
  selectedIndex,
  onSelect
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const labels = getDefaultShortcutLabelsFromT(t)

  if (!visible) return null

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.bgSurfaceHigh,
          borderColor: colors.borderMuted
        }
      ]}
    >
      <Text style={[styles.header, { color: colors.textSecondary }]}>
        {t('shortcut.title', '快捷指令')}
      </Text>
      <FlatList
        data={shortcuts}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        style={styles.list}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.textTertiary }]}>
            {t('shortcut.no_match', '找不到任何匹配的快捷指令...')}
          </Text>
        }
        renderItem={({ item, index }) => {
          const localized = localizePromptShortcut(item, labels)
          const selected = index === selectedIndex
          const command = getShortcutCommand(localized)
          return (
            <Pressable
              onPress={() => onSelect(localized)}
              style={[
                styles.row,
                {
                  backgroundColor: selected ? colors.primaryContainer : 'transparent',
                  borderColor: selected ? colors.primary : 'transparent'
                }
              ]}
            >
              <Text style={styles.icon}>{localized.icon || '⚡'}</Text>
              <View style={styles.meta}>
                <Text style={[styles.command, { color: colors.textPrimary }]}>/{command}</Text>
                {localized.name ? (
                  <Text style={[styles.name, { color: colors.textSecondary }]} numberOfLines={1}>
                    {localized.name}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          )
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: 220,
    overflow: 'hidden'
  },
  header: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6
  },
  list: {
    maxHeight: 180
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 10,
    marginHorizontal: 8,
    marginBottom: 6
  },
  icon: {
    fontSize: 16,
    width: 22,
    textAlign: 'center'
  },
  meta: {
    flex: 1,
    minWidth: 0
  },
  command: {
    fontSize: 14,
    fontWeight: '700'
  },
  name: {
    fontSize: 12,
    marginTop: 2
  },
  empty: {
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 16
  }
})
