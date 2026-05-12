import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useNativeTheme } from '../../native/theme';

interface TimelineNodeProps {
  children: React.ReactNode;
  isLast?: boolean;
  isFirst?: boolean;
}

export const TimelineNode: React.FC<TimelineNodeProps> = ({ children, isLast, isFirst }) => {
  const { colors } = useNativeTheme();

  return (
    <View style={styles.container}>
      <View style={styles.track}>
        {!isLast && <View style={[styles.line, { backgroundColor: colors.borderSubtle }]} />}
        <View style={[styles.indicator, { backgroundColor: colors.primary, borderColor: colors.textOnPrimary, shadowColor: colors.primary }]} />
      </View>
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
  },
  track: {
    width: 40,
    alignItems: 'center', // Center child horizontally somewhat, but absolute is safer
  },
  line: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 20,
    width: 2,
  },
  indicator: {
    position: 'absolute',
    top: 24,
    left: 15, // 20 - 5
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    flex: 1,
  }
});
