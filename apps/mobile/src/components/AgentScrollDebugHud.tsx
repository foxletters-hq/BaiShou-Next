import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { getRecentAgentScrollEvents } from '../utils/agent-scroll-diagnostics'

const HIGHLIGHT =
  /programmatic_scroll|suspect_clamp|content_handoff_end|stream_end|pin_offset|layout_scroll_to_end|focus_bottom/

/** 开发态：屏幕左下角显示最近滚动事件，便于真机无 Metro 时排查结束拽底 */
export function AgentScrollDebugHud() {
  const [lines, setLines] = useState<string[]>([])

  useEffect(() => {
    if (typeof __DEV__ === 'undefined' || !__DEV__) return

    const tick = () => {
      const events = getRecentAgentScrollEvents()
      setLines(events.slice(-8))
    }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [])

  if (typeof __DEV__ === 'undefined' || !__DEV__ || lines.length === 0) {
    return null
  }

  return (
    <View pointerEvents="none" style={styles.wrap}>
      {lines.map((line, index) => {
        const hot = HIGHLIGHT.test(line)
        return (
          <Text
            key={`${index}-${line.slice(0, 24)}`}
            style={[styles.line, hot && styles.hot]}
            numberOfLines={2}
          >
            {line}
          </Text>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 4,
    bottom: 148,
    right: 56,
    zIndex: 20,
    opacity: 0.9
  },
  line: {
    fontSize: 9,
    lineHeight: 11,
    color: '#334155',
    fontFamily: 'monospace',
    backgroundColor: 'rgba(255,255,255,0.92)',
    marginBottom: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3
  },
  hot: {
    color: '#b91c1c',
    fontWeight: '700',
    backgroundColor: 'rgba(254,226,226,0.96)'
  }
})
