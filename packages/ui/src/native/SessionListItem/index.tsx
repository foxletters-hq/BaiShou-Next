import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNativeTheme } from '../../native/theme';

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
  const { t } = useTranslation();
  const { colors } = useNativeTheme();

  return (
    <TouchableOpacity 
      onPress={onTap} 
      style={[
        styles.container, 
        { backgroundColor: colors.bgSurface, borderBottomColor: colors.borderSubtle },
        isSelected && { backgroundColor: colors.primaryLight }
      ]}
      activeOpacity={0.7}
    >
       <View style={styles.content}>
         {session.isPinned && <Text style={styles.pinIcon}>📌</Text>}
         <Text 
           style={[styles.title, { color: colors.textPrimary }, isSelected && { color: colors.primary, fontWeight: '600' }]}
           numberOfLines={1}
         >
           {session.title || t('chat.new_session', '新对话')}
         </Text>
       </View>
       <Text style={[styles.moreIcon, { color: colors.textTertiary }]}>⋮</Text>
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
  },
  moreIcon: {
    fontSize: 18,
    paddingHorizontal: 8,
  }
});
