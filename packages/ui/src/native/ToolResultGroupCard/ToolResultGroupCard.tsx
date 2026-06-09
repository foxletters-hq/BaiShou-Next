import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Linking
} from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { CollapsibleAncillaryBlock } from '../CollapsibleAncillaryBlock'
import { CollapsibleHeight } from '../CollapsibleHeight'
import { useNativeTheme } from '../theme'
import {
  getToolDisplayName,
  getToolResultRawContent,
  isToolResultError,
  parseToolResultJson
} from '../../shared/tool-result.util'

interface ToolInvocation {
  toolCallId: string
  toolName: string
  result: unknown
}

export interface ToolResultGroupCardProps {
  invocations: ToolInvocation[]
}

function StructuredDataView({ data, colors }: { data: unknown; colors: ReturnType<typeof useNativeTheme>['colors'] }) {
  if (Array.isArray(data)) {
    return (
      <View style={styles.structGrid}>
        {data.map((item, i) => (
          <View
            key={i}
            style={[
              styles.structItem,
              { borderColor: colors.borderSubtle, backgroundColor: colors.bgSurface }
            ]}
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
            {item &&
            !item.title &&
            !item.snippet &&
            typeof item === 'object' &&
            Object.keys(item).length > 0
              ? Object.keys(item).map((k) => (
                  <View key={k} style={[styles.structValueRow, { borderBottomColor: colors.borderSubtle }]}>
                    <Text style={[styles.structKey, { color: colors.primary }]}>{k}</Text>
                    <Text style={[styles.structVal, { color: colors.textSecondary }]} numberOfLines={2}>
                      {String(item[k])}
                    </Text>
                  </View>
                ))
              : null}
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
        <View
          style={[
            styles.structItem,
            { borderColor: colors.borderSubtle, backgroundColor: colors.bgSurface }
          ]}
        >
          {Object.keys(obj)
            .filter((k) => k !== 'title' && k !== 'snippet')
            .map((k) => (
              <View key={k} style={[styles.structValueRow, { borderBottomColor: colors.borderSubtle }]}>
                <Text style={[styles.structKey, { color: colors.primary }]}>{k}</Text>
                <Text style={[styles.structVal, { color: colors.textSecondary }]} numberOfLines={2}>
                  {String(obj[k])}
                </Text>
              </View>
            ))}
        </View>
      </View>
    )
  }

  return (
    <Text style={[styles.resultTextLog, { color: colors.textSecondary }]} selectable>
      {JSON.stringify(data, null, 2)}
    </Text>
  )
}

const RESULT_MAX_HEIGHT = 280

const ToolResultItem: React.FC<{
  invocation: ToolInvocation
  colors: ReturnType<typeof useNativeTheme>['colors']
}> = ({ invocation, colors }) => {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const [contentHeight, setContentHeight] = useState(0)

  const rawContent = getToolResultRawContent(invocation)
  const isError = isToolResultError(invocation)
  const toolName = getToolDisplayName(invocation, t)
  const parsedJson = parseToolResultJson(invocation)
  const viewportHeight = Math.min(contentHeight || RESULT_MAX_HEIGHT, RESULT_MAX_HEIGHT)
  const scrollEnabled = contentHeight > RESULT_MAX_HEIGHT

  return (
    <View style={[styles.itemCard, { backgroundColor: colors.bgSurface }]}>
      <TouchableOpacity
        style={styles.itemHeader}
        onPress={() => setExpanded((prev) => !prev)}
        activeOpacity={0.7}
      >
        <View style={styles.itemStatusWrap}>
          {isError ? (
            <MaterialCommunityIcons name="close-circle" size={14} color="#F44336" />
          ) : (
            <MaterialCommunityIcons name="check-circle" size={14} color={colors.primary} />
          )}
        </View>
        <Text style={[styles.itemName, { color: colors.textSecondary }]} numberOfLines={1}>
          {toolName}
        </Text>
      </TouchableOpacity>

      <CollapsibleHeight expanded={expanded} animation="ease" durationMs={300}>
        <View
          style={[
            styles.contentWrapper,
            {
              height: viewportHeight,
              backgroundColor: isError ? 'rgba(244, 67, 54, 0.06)' : colors.bgSurfaceNormal,
              borderColor: isError ? 'rgba(244, 67, 54, 0.3)' : colors.borderSubtle
            }
          ]}
        >
          <ScrollView
            style={[styles.resultScroll, { height: viewportHeight }]}
            contentContainerStyle={styles.resultScrollInner}
            nestedScrollEnabled
            scrollEnabled={scrollEnabled}
            showsVerticalScrollIndicator={scrollEnabled}
            onContentSizeChange={(_, height) => {
              if (height !== contentHeight) setContentHeight(height)
            }}
          >
            {parsedJson && !isError ? (
              <StructuredDataView data={parsedJson} colors={colors} />
            ) : (
              <Text
                style={[
                  styles.resultTextLog,
                  { color: isError ? colors.error : colors.textSecondary }
                ]}
                selectable
              >
                {rawContent}
              </Text>
            )}
          </ScrollView>
        </View>
      </CollapsibleHeight>
    </View>
  )
}

/** 对齐 desktop ToolResultGroup — 🎧 外壳 + CheckCircle / XCircle + 0.3s 展开动画 */
export const ToolResultGroupCard: React.FC<ToolResultGroupCardProps> = ({ invocations }) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [expanded, setExpanded] = useState(false)

  if (!invocations || invocations.length === 0) return null

  return (
    <CollapsibleAncillaryBlock
      headerIcon="🎧"
      title={t('agent.tools.tool_call_results', '工具调用 · {{count}} 个结果', {
        count: invocations.length
      })}
      open={expanded}
      onToggle={() => setExpanded((prev) => !prev)}
      bodyPadding={false}
    >
      <View
        style={[
          styles.childrenArea,
          { backgroundColor: `${colors.borderSubtle}33` }
        ]}
      >
        {invocations.map((inv, index) => (
          <ToolResultItem key={inv.toolCallId || String(index)} invocation={inv} colors={colors} />
        ))}
      </View>
    </CollapsibleAncillaryBlock>
  )
}

const styles = StyleSheet.create({
  childrenArea: {
    gap: 1
  },
  itemCard: {
    flexDirection: 'column'
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  itemStatusWrap: {
    marginRight: 10
  },
  itemName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'monospace'
  },
  contentWrapper: {
    marginHorizontal: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden'
  },
  resultScroll: {
    flexGrow: 0
  },
  resultScrollInner: {
    padding: 10
  },
  resultTextLog: {
    fontSize: 11,
    lineHeight: 15.4,
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
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2
  },
  structLink: {
    fontSize: 11
  },
  structSnippet: {
    fontSize: 11,
    lineHeight: 16.5
  },
  structValueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8
  },
  structKey: {
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 0
  },
  structVal: {
    fontSize: 11,
    fontFamily: 'monospace',
    flex: 1,
    textAlign: 'right'
  }
})
