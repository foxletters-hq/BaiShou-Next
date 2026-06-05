import React from 'react'
import { View, Text, ScrollView, StyleSheet, useWindowDimensions } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'

export interface McpToolListItem {
  name: string
  displayName?: string
  description: string
  category?: string
}

export const McpToolsListContent: React.FC<{ tools: McpToolListItem[] }> = ({ tools }) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const { height: screenHeight } = useWindowDimensions()
  const listMaxHeight = Math.min(400, Math.round(screenHeight * 0.5))

  return (
    <ScrollView
      style={[styles.list, { maxHeight: listMaxHeight }]}
      contentContainerStyle={styles.listContent}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      bounces
      overScrollMode="always"
    >
      {tools.map((tool, index) => {
        const cleanName = tool.displayName || tool.name.replace(/^baishou_/, '')
        const localizedTitle = t(`agent.tools.${cleanName}`, cleanName)
        const localizedDesc = t(`agent.tools.${cleanName}_desc`, tool.description)
        const isLast = index === tools.length - 1

        return (
          <View
            key={tool.name}
            style={[
              styles.item,
              !isLast && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: colors.borderSubtle
              }
            ]}
          >
            <View style={styles.titleRow}>
              <Text style={[styles.toolName, { color: colors.primary }]}>{tool.name}</Text>
              <Text style={[styles.localizedTitle, { color: colors.textPrimary }]}>
                {localizedTitle}
              </Text>
              {tool.category ? (
                <Text style={[styles.category, { color: colors.textTertiary }]}>
                  {tool.category}
                </Text>
              ) : null}
            </View>
            <Text style={[styles.desc, { color: colors.textSecondary }]}>{localizedDesc}</Text>
          </View>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  list: {
    flexGrow: 0
  },
  listContent: {
    paddingBottom: 2
  },
  item: {
    paddingVertical: 12
  },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 6
  },
  toolName: {
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: '600'
  },
  localizedTitle: {
    fontSize: 14,
    fontWeight: '600'
  },
  category: {
    fontSize: 12,
    fontWeight: '500'
  },
  desc: {
    fontSize: 13,
    lineHeight: 20
  }
})
