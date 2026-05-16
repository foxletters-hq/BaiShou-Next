import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, StatusBar, Alert, TextInput } from 'react-native';
import { useNativeTheme } from '@baishou/ui/native';
import { useBaishou } from '../providers/BaishouProvider';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

interface Session {
  id: string;
  title: string;
  assistantId?: string;
  isPinned: boolean;
  updatedAt: string;
  inputTokens: number;
  outputTokens: number;
  totalCostMicros: number;
}

export const SessionManagementScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors, isDark } = useNativeTheme();
  const { services, dbReady } = useBaishou();
  const router = useRouter();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);

  const loadSessions = useCallback(async () => {
    if (!dbReady || !services) return;
    try {
      const sessionList = await services.sessionManager.list();
      setSessions(sessionList.map(s => ({
        id: s.id,
        title: s.title || '新对话',
        assistantId: s.assistantId,
        isPinned: s.isPinned || false,
        updatedAt: s.updatedAt || new Date().toISOString(),
        inputTokens: s.inputTokens || 0,
        outputTokens: s.outputTokens || 0,
        totalCostMicros: s.totalCostMicros || 0,
      })));
    } catch (e) {
      console.error('Failed to load sessions', e);
    } finally {
      setLoading(false);
    }
  }, [dbReady, services]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleDeleteSession = async (sessionId: string) => {
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
    } catch (e) {
      console.error('Failed to pin session', e);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedSessions.size === 0) return;
    
    Alert.alert(
      '确认删除',
      `确定要删除选中的 ${selectedSessions.size} 个会话吗？此操作不可逆转。`,
      [
        { text: '取消', style: 'cancel' },
        { 
          text: '删除', 
          style: 'destructive',
          onPress: async () => {
            try {
              for (const sessionId of selectedSessions) {
                await services?.sessionManager.delete(sessionId);
              }
              setSelectedSessions(new Set());
              setIsMultiSelectMode(false);
              await loadSessions();
            } catch (e) {
              console.error('Failed to delete sessions', e);
            }
          }
        },
      ]
    );
  };

  const handleSelectSession = (sessionId: string) => {
    if (isMultiSelectMode) {
      const newSelected = new Set(selectedSessions);
      if (newSelected.has(sessionId)) {
        newSelected.delete(sessionId);
      } else {
        newSelected.add(sessionId);
      }
      setSelectedSessions(newSelected);
    } else {
      router.push(`/(tabs)/agent?sessionId=${sessionId}`);
    }
  };

  const handleLongPress = (sessionId: string) => {
    setIsMultiSelectMode(true);
    setSelectedSessions(new Set([sessionId]));
  };

  const formatCost = (costMicros: number) => {
    if (costMicros === 0) return '';
    const dollars = costMicros / 1000000;
    if (dollars < 0.01) {
      return `$${dollars.toFixed(4)}`;
    }
    return `$${dollars.toFixed(2)}`;
  };

  const formatTokens = (tokens: number) => {
    if (tokens === 0) return '';
    if (tokens < 1000) return `${tokens}`;
    if (tokens < 1000000) return `${(tokens / 1000).toFixed(1)}K`;
    return `${(tokens / 1000000).toFixed(1)}M`;
  };

  const filteredSessions = sessions.filter(s => 
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pinnedSessions = filteredSessions.filter(s => s.isPinned);
  const unpinnedSessions = filteredSessions.filter(s => !s.isPinned);

  const renderSessionItem = ({ item }: { item: Session }) => {
    const isSelected = selectedSessions.has(item.id);
    
    return (
      <TouchableOpacity
        style={[
          styles.sessionItem, 
          { backgroundColor: colors.bgSurfaceHighest },
          isSelected && { backgroundColor: colors.primary + '20' }
        ]}
        onPress={() => handleSelectSession(item.id)}
        onLongPress={() => handleLongPress(item.id)}
        activeOpacity={0.7}
      >
        {isMultiSelectMode && (
          <View style={[
            styles.checkbox, 
            { borderColor: colors.primary },
            isSelected && { backgroundColor: colors.primary }
          ]}>
            {isSelected && <Text style={styles.checkmark}>✓</Text>}
          </View>
        )}
        
        <View style={styles.sessionInfo}>
          <View style={styles.sessionHeader}>
            {item.isPinned && <Text style={styles.pinIcon}>📌</Text>}
            <Text style={[styles.sessionTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              {item.title}
            </Text>
          </View>
          
          <View style={styles.sessionMeta}>
            <Text style={[styles.sessionDate, { color: colors.textSecondary }]}>
              {new Date(item.updatedAt).toLocaleDateString()}
            </Text>
            {(item.inputTokens > 0 || item.outputTokens > 0) && (
              <Text style={[styles.sessionTokens, { color: colors.textSecondary }]}>
                {formatTokens(item.inputTokens + item.outputTokens)} tokens
              </Text>
            )}
            {item.totalCostMicros > 0 && (
              <Text style={[styles.sessionCost, { color: colors.textSecondary }]}>
                {formatCost(item.totalCostMicros)}
              </Text>
            )}
          </View>
        </View>

        {!isMultiSelectMode && (
          <View style={styles.sessionActions}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => handlePinSession(item.id, item.isPinned)}
            >
              <Text style={[styles.actionText, { color: colors.textSecondary }]}>
                {item.isPinned ? '取消置顶' : '置顶'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => handleDeleteSession(item.id)}
            >
              <Text style={[styles.actionText, { color: '#EF4444' }]}>删除</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.bgApp} />
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bgApp }]}>
        <View style={[styles.container, { backgroundColor: colors.bgApp }]}>
          {/* 头部 */}
          <View style={[styles.header, { backgroundColor: colors.bgSurface, borderBottomColor: colors.borderSubtle }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Text style={[styles.backText, { color: colors.primary }]}>← 返回</Text>
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>会话管理</Text>
            <TouchableOpacity 
              onPress={() => {
                if (isMultiSelectMode) {
                  setIsMultiSelectMode(false);
                  setSelectedSessions(new Set());
                }
              }}
            >
              <Text style={[styles.headerAction, { color: colors.primary }]}>
                {isMultiSelectMode ? '取消' : '编辑'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* 搜索栏 */}
          <View style={[styles.searchBar, { backgroundColor: colors.bgSurface }]}>
            <TextInput
              style={[styles.searchInput, { 
                backgroundColor: colors.bgSurfaceHighest,
                color: colors.textPrimary,
                borderColor: colors.borderSubtle,
              }]}
              placeholder="搜索会话..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* 批量操作栏 */}
          {isMultiSelectMode && selectedSessions.size > 0 && (
            <View style={[styles.batchBar, { backgroundColor: colors.bgSurface }]}>
              <Text style={[styles.batchText, { color: colors.textSecondary }]}>
                已选择 {selectedSessions.size} 个会话
              </Text>
              <TouchableOpacity 
                style={[styles.batchDeleteButton, { backgroundColor: '#EF4444' }]}
                onPress={handleDeleteSelected}
              >
                <Text style={styles.batchDeleteText}>删除选中</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 会话列表 */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>加载中...</Text>
            </View>
          ) : filteredSessions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>暂无会话</Text>
              <Text style={[styles.emptySubText, { color: colors.textSecondary }]}>开始对话后会话将显示在这里</Text>
            </View>
          ) : (
            <FlatList
              data={[...pinnedSessions, ...unpinnedSessions]}
              renderItem={renderSessionItem}
              keyExtractor={item => item.id}
              style={styles.list}
              contentContainerStyle={styles.listContent}
            />
          )}
        </View>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerAction: {
    fontSize: 16,
    fontWeight: '600',
  },
  searchBar: {
    padding: 16,
  },
  searchInput: {
    height: 40,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  batchBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  batchText: {
    fontSize: 14,
    fontWeight: '600',
  },
  batchDeleteButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  batchDeleteText: {
    color: '#FFF',
    fontSize: 14,
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
    padding: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    textAlign: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkmark: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  sessionInfo: {
    flex: 1,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  pinIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  sessionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sessionDate: {
    fontSize: 12,
  },
  sessionTokens: {
    fontSize: 12,
  },
  sessionCost: {
    fontSize: 12,
  },
  sessionActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
  },
});