import React, { useMemo, useState } from 'react'
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native'
import { resolveToolResultPresentation, type ToolInvocationLike } from '../../shared/tool-result.util'
import { AgentMarkdownRenderer } from '../AgentMarkdown'
import { useNativeTheme } from '../theme'

const RESULT_MAX_HEIGHT = 320

export const ToolResultContent = React.memo(function ToolResultContent({
  invocation
}: {
  invocation: ToolInvocationLike
}) {
  const { colors } = useNativeTheme()
  const presentation = useMemo(() => resolveToolResultPresentation(invocation), [invocation])
  const isError = presentation.mode === 'error'
  const [contentHeight, setContentHeight] = useState(0)
  const viewportHeight = Math.min(contentHeight || RESULT_MAX_HEIGHT, RESULT_MAX_HEIGHT)
  const scrollEnabled = contentHeight > RESULT_MAX_HEIGHT

  return (
    <View
      style={[
        styles.viewport,
        {
          height: viewportHeight,
          backgroundColor: isError ? 'rgba(244, 67, 54, 0.06)' : colors.bgSurfaceNormal,
          borderColor: isError ? 'rgba(244, 67, 54, 0.3)' : colors.borderSubtle
        }
      ]}
    >
      <ScrollView
        style={{ height: viewportHeight }}
        contentContainerStyle={styles.scrollInner}
        nestedScrollEnabled
        scrollEnabled={scrollEnabled}
        showsVerticalScrollIndicator={scrollEnabled}
        onContentSizeChange={(_, height) => {
          if (height !== contentHeight) setContentHeight(height)
        }}
      >
        {presentation.mode === 'structured' ? (
          <StructuredToolResult data={presentation.data} colors={colors} />
        ) : (
          <>
            {presentation.sourceUrl ? (
              <Text
                style={[styles.sourceUrl, { color: colors.primary }]}
                onPress={() => Linking.openURL(presentation.sourceUrl!).catch(() => {})}
              >
                {presentation.sourceUrl}
              </Text>
            ) : null}
            {presentation.mode === 'plain' && presentation.renderAsMarkdown ? (
              <AgentMarkdownRenderer content={presentation.text} variant="ancillary" />
            ) : (
              <Text
                style={[styles.plainText, { color: isError ? colors.error : colors.textSecondary }]}
                selectable
              >
                {presentation.text}
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </View>
  )
})

function StructuredToolResult({
  data,
  colors
}: {
  data: unknown
  colors: ReturnType<typeof useNativeTheme>['colors']
}) {
  if (Array.isArray(data)) {
    return (
      <View style={styles.structGrid}>
        {data.map((item, i) => (
          <View
            key={i}
            style={[styles.structItem, { borderColor: colors.borderSubtle, backgroundColor: colors.bgSurface }]}
          >
            {item?.title ? (
              <Text style={[styles.structTitle, { color: colors.textPrimary }]}>{item.title}</Text>
            ) : null}
            {item?.url ? (
              <Text
                style={[styles.structLink, { color: colors.primary }]}
                onPress={() => Linking.openURL(item.url).catch(() => {})}
              >
                {item.url}
              </Text>
            ) : null}
            {item?.snippet ? (
              <Text style={[styles.structSnippet, { color: colors.textSecondary }]}>{item.snippet}</Text>
            ) : null}
            {item?.summary ? (
              <Text style={[styles.structSnippet, { color: colors.textSecondary }]}>{item.summary}</Text>
            ) : null}
          </View>
        ))}
      </View>
    )
  }

  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>
    return (
      <View style={styles.structGrid}>
        {obj.title ? (
          <Text style={[styles.structTitle, { color: colors.textPrimary }]}>{String(obj.title)}</Text>
        ) : null}
        {obj.snippet ? (
          <Text style={[styles.structSnippet, { color: colors.textSecondary }]}>{String(obj.snippet)}</Text>
        ) : null}
        <View style={[styles.structItem, { borderColor: colors.borderSubtle, backgroundColor: colors.bgSurface }]}>
          {Object.keys(obj)
            .filter((k) => k !== 'title' && k !== 'snippet')
            .map((k) => (
              <View key={k} style={[styles.structValueRow, { borderBottomColor: colors.borderSubtle }]}>
                <Text style={[styles.structKey, { color: colors.primary }]}>{k}</Text>
                <Text style={[styles.structVal, { color: colors.textSecondary }]} numberOfLines={3}>
                  {String(obj[k])}
                </Text>
              </View>
            ))}
        </View>
      </View>
    )
  }

  return (
    <Text style={[styles.plainText, { color: colors.textSecondary }]} selectable>
      {JSON.stringify(data, null, 2)}
    </Text>
  )
}

const styles = StyleSheet.create({
  viewport: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden'
  },
  scrollInner: {
    padding: 10
  },
  sourceUrl: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 8
  },
  plainText: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: 'monospace'
  },
  structGrid: {
    gap: 8
  },
  structItem: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4
  },
  structTitle: {
    fontSize: 13,
    fontWeight: '600'
  },
  structLink: {
    fontSize: 12
  },
  structSnippet: {
    fontSize: 12,
    lineHeight: 17
  },
  structValueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 2,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  structKey: {
    fontSize: 12,
    fontWeight: '600'
  },
  structVal: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'monospace',
    textAlign: 'right'
  }
})
