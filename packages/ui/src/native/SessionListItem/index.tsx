import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface SessionData {
  id: string;
  title: string;
  isPinned: boolean;
}

interface SessionListItemProps {
  session: SessionData;
  isSelected?: boolean;
  onTap: () => void;
}

export const SessionListItem: React.FC<SessionListItemProps> = ({
  session,
  isSelected,
  onTap
}) => {
  return (
    <TouchableOpacity 
      onPress={onTap} 
      style={[styles.container, isSelected && styles.containerSelected]}
      activeOpacity={0.7}
    >
       <View style={styles.content}>
         {session.isPinned && <Text style={styles.pinIcon}>📌</Text>}
         <Text 
           style={[styles.title, isSelected && styles.titleSelected]}
           numberOfLines={1}
         >
           {session.title || '新对话'}
         </Text>
       </View>
       <Text style={styles.moreIcon}>⋮</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEE',
    backgroundColor: '#FFFFFF',
  },
  containerSelected: {
    backgroundColor: 'rgba(91, 168, 245, 0.1)',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pinIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  title: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
  },
  titleSelected: {
    color: '#5BA8F5',
    fontWeight: '600',
  },
  moreIcon: {
    fontSize: 18,
    color: '#999',
    paddingHorizontal: 8,
  }
});
