import React from 'react'
import { View, StyleSheet } from 'react-native'
import { useNativeTheme } from '../../native/theme'
import { sharedTokens } from '../../theme/tokens'

interface TimelineNodeProps {
  children: React.ReactNode
  isLast?: boolean
  isFirst?: boolean
}

export const TimelineNode: React.FC<TimelineNodeProps> = ({
  children,
  isLast,
  isFirst: _isFirst
}) => {
  const { colors } = useNativeTheme()

  return (
    <View style={styles.container}>
      <View style={styles.track}>
        {!isLast && <View style={[styles.line, { backgroundColor: colors.borderSubtle }]} />}
        <View
          style={[
            styles.indicator,
            {
              backgroundColor: colors.primary,
              borderColor: colors.textOnPrimary
            }
          ]}
        />
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row'
  },
  track: {
    width: 40,
    alignItems: 'center' // Center child horizontally somewhat, but absolute is safer
  },
  line: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 20,
    width: 2
  },
  indicator: {
    position: 'absolute',
    top: 24,
    left: 15, // 20 - 5
    width: 10,
    height: 10,
    borderRadius: sharedTokens.radius.xs,
    borderWidth: 2
  },
  content: {
    flex: 1
  }
})
