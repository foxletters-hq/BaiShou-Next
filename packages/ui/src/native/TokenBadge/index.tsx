import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface TokenBadgeProps {
  tokenCount: number;
  costEstimate: number;
  onTap?: () => void;
}

export const TokenBadge: React.FC<TokenBadgeProps> = ({
  tokenCount,
  costEstimate,
  onTap
}) => {
  return (
    <TouchableOpacity onPress={onTap} style={styles.container} activeOpacity={0.7}>
       <View style={styles.dot} />
       <Text style={styles.text}>
         {tokenCount} tokens (~${costEstimate.toFixed(3)})
       </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(224, 224, 224, 0.5)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4CAF50',
    marginRight: 6,
  },
  text: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  }
});
