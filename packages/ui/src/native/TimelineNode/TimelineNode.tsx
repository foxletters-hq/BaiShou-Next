import React from 'react';
import { View, StyleSheet } from 'react-native';

interface TimelineNodeProps {
  children: React.ReactNode;
  isLast?: boolean;
  isFirst?: boolean;
}

export const TimelineNode: React.FC<TimelineNodeProps> = ({ children, isLast, isFirst }) => {
  return (
    <View style={styles.container}>
      <View style={styles.track}>
        {!isLast && <View style={styles.line} />}
        <View style={styles.indicator} />
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
    backgroundColor: 'rgba(148, 163, 184, 0.2)', // var(--bg-surface-highlight) mockup
  },
  indicator: {
    position: 'absolute',
    top: 24,
    left: 15, // 20 - 5
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#5BA8F5', // var(--color-primary) mockup
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#5BA8F5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    flex: 1,
  }
});
