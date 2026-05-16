import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { SessionListItem } from '@baishou/ui/native';
import { useNativeTheme } from '@baishou/ui/native';
import { useBaishou } from '../providers/BaishouProvider';

interface Session {
  id: string;
  title: string;
  isPinned: boolean;
  updatedAt: string;
  assistantId?: string;
}

interface SessionListProps {
  selectedSessionId?: string;
  onSelectSession: (sessionId: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (sessionId: string) => void;
  onPinSession: (sessionId: string, isPinned: boolean) => void;
}

export const SessionList: React.FC<SessionListProps> = ({
  selectedSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  onPinSession,
}) => {
  const { colors } = useNativeTheme();
  const { services, dbReady } = useBaishou();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSessions = async () => {
    if (!dbReady || !services) return;
    try {
      const sessionList = await services.sessionManager.list();
      setSessions(sessionList.map(s => ({
        id: s.id,
        title: s.title || '新对话',
        isPinned: s.isPinned || false,
        updatedAt: s.updatedAt || new Date().toISOString(),
        assistantId: s.assistantId,
      })));
    } catch (e) {
      console.warn('Failed to load sessions', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [dbReady, services]);

  const handleDeleteSession = (sessionId: string) => {
    Alert.alert(
      '确认删除',
      '确定要删除这个会话吗？此操作不可逆转。',
      [
        { text: '取消', style: 'cancel' },
        { 
          text: '删除', 
          style: 'destructive',
          onPress: async () => {
            try {
              await services?.sessionManager.delete(sessionId);
              await loadSessions();
              onDeleteSession(sessionId);
            } catch (e) {
              console.error('Failed to delete session', e);
            }
          }
        },
      ]
    );
  };

  const handlePinSession = async (sessionId: string, isPinned: boolean) => {
    try {
      await services?.sessionManager.update(sessionId, { isPinned: !isPinned });
      await loadSessions();
      onPinSession(sessionId, !isPinned);
    } catch (e) {
      console.error('Failed to pin session', e);
    }
  };

  const renderItem = ({ item }: { item: Session }) => (
    <SessionListItem
      session={item}
      isSelected={item.id === selectedSessionId}
      onTap={() => onSelectSession(item.id)}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bgSurface }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>会话列表</Text>
        <TouchableOpacity 
          style={[styles.createButton, { backgroundColor: colors.primary }]}
          onPress={onCreateSession}
        >
          <Text style={styles.createButtonText}>+</Text>
        </TouchableOpacity>
      </View>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>加载中...</Text>
        </View>
      ) : sessions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>暂无会话</Text>
          <Text style={[styles.emptySubText, { color: colors.textSecondary }]}>点击 + 创建新会话</Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          style={styles.list}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  createButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
  },
  list: {
    flex: 1,
  },
});