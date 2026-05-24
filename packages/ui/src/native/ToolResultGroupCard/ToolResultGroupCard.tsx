import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet
} from 'react-native'
import { useNativeTheme } from '../theme'

interface ToolInvocation {
  toolCallId: string
  toolName: string
  result: any
}

export interface ToolResultGroupCardProps {
  invocations: ToolInvocation[]
}

const ToolResultItem: React.FC<{
  invocation: ToolInvocation
  colors: any
}> = ({ invocation, colors }) => {
  const [expanded, setExpanded] = useState(false)
  const resultStr =
    typeof invocation.result === 'string'
      ? invocation.result
      : JSON.stringify(invocation.result, null, 2)

  const isError =
    typeof invocation.result === 'object' &&
    invocation.result !== null &&
    'error' in invocation.result

  return (
    <View
      style={[styles.toolItem, { borderColor: colors.borderSubtle }]}
    >
      <TouchableOpacity
        style={styles.toolItemHeader}
        onPress={() => setExpanded((prev) => !prev)}
        activeOpacity={0.7}
      >
        <View style={styles.toolItemLeft}>
          <Text style={styles.statusIcon}>{isError ? '✗' : '✓'}</Text>
          <Text style={[styles.toolName, { color: isError ? colors.error : colors.textPrimary }]}>
            {invocation.toolName}
          </Text>
        </View>
        <Text style={[styles.expandArrow, { color: colors.textTertiary }]}>
          {expanded ? '▼' : '▶'}
        </Text>
      </TouchableOpacity>
      {expanded && (
        <ScrollView
          style={[
            styles.resultContent,
            {
              backgroundColor: colors.bgSurfaceNormal,
              borderColor: colors.borderSubtle
            }
          ]}
          horizontal
          nestedScrollEnabled
        >
          <Text
            style={[styles.resultText, { color: colors.textPrimary }]}
            selectable
          >
            {resultStr}
          </Text>
        </ScrollView>
      )}
    </View>
  )
}

export const ToolResultGroupCard: React.FC<ToolResultGroupCardProps> = ({
  invocations
}) => {
  const { colors, tokens } = useNativeTheme()
  const [expanded, setExpanded] = useState(true)

  if (!invocations || invocations.length === 0) return null

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.bgSurface,
          borderColor: colors.borderSubtle,
          borderRadius: tokens.radius.md
        }
      ]}
    >
      <TouchableOpacity
        style={styles.groupHeader}
        onPress={() => setExpanded((prev) => !prev)}
        activeOpacity={0.7}
      >
        <Text style={[styles.groupTitle, { color: colors.textPrimary }]}>
          工具调用结果 ({invocations.length})
        </Text>
        <Text style={[styles.groupArrow, { color: colors.textTertiary }]}>
          {expanded ? '▼' : '▶'}
        </Text>
      </TouchableOpacity>
      {expanded && (
        <View style={styles.itemsContainer}>
          {invocations.map((inv) => (
            <ToolResultItem
              key={inv.toolCallId}
              invocation={inv}
              colors={colors}
            />
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    overflow: 'hidden'
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: '600'
  },
  groupArrow: {
    fontSize: 12
  },
  itemsContainer: {
    paddingHorizontal: 14,
    paddingBottom: 12
  },
  toolItem: {
    borderTopWidth: 1,
    paddingVertical: 8
  },
  toolItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  toolItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  statusIcon: {
    fontSize: 14,
    marginRight: 8
  },
  toolName: {
    fontSize: 13,
    fontWeight: '500'
  },
  expandArrow: {
    fontSize: 10
  },
  resultContent: {
    marginTop: 8,
    padding: 10,
    borderWidth: 1,
    borderRadius: 6,
    maxHeight: 200
  },
  resultText: {
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: 18
  }
})
