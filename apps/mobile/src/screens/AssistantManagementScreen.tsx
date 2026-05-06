import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, StatusBar, Alert } from 'react-native';
import { useNativeTheme } from '@baishou/ui/src/native/theme';
import { useBaishou } from '../providers/BaishouProvider';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

interface Assistant {
  id: string;
  name: string;
  emoji: string;
  description?: string;
  systemPrompt?: string;
  isDefault: boolean;
  isPinned: boolean;
  providerId?: string;
  modelId?: string;
}

export const AssistantManagementScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors, isDark } = useNativeTheme();
  const { services, dbReady } = useBaishou();
  const router = useRouter();

  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAssistants = useCallback(async () => {
    if (!dbReady || !services) return;
    try {
      const assistantList = await services.settingsManager.get<Assistant[]>('assistants') || [];
      setAssistants(assistantList);
    } catch (e) {
      console.error('Failed to load assistants', e);
    } finally {
      setLoading(false);
    }
  }, [dbReady, services]);

  useEffect(() => {
    loadAssistants();
  }, [loadAssistants]);

  const handleCreateAssistant = () => {
    router.push('/assistants/new');
  };

  const handleEditAssistant = (assistant: Assistant) => {
    router.push(`/assistants/${assistant.id}`);
  };

  const handleDeleteAssistant = async (assistant: Assistant) => {
    if (assistant.isDefault) {
      Alert.alert('错误', '不能删除默认助手');
      return;
    }

    Alert.alert(
      '确认删除',
      `确定要删除助手「${assistant.name}」吗？此操作不可逆转。`,
      [
        { text: '取消', style: 'cancel' },
        { 
          text: '删除', 
          style: 'destructive',
          onPress: async () => {
            try {
              const newAssistants = assistants.filter(a => a.id !== assistant.id);
              await services?.settingsManager.set('assistants', newAssistants);
              setAssistants(newAssistants);
            } catch (e) {
              console.error('Failed to delete assistant', e);
            }
          }
        },
      ]
    );
  };

  const handleTogglePin = async (assistant: Assistant) => {
    try {
      const newAssistants = assistants.map(a => 
        a.id === assistant.id ? { ...a, isPinned: !a.isPinned } : a
      );
      await services?.settingsManager.set('assistants', newAssistants);
      setAssistants(newAssistants);
    } catch (e) {
      console.error('Failed to toggle pin', e);
    }
  };

  const handleSetDefault = async (assistant: Assistant) => {
    try {
      const newAssistants = assistants.map(a => ({
        ...a,
        isDefault: a.id === assistant.id,
      }));
      await services?.settingsManager.set('assistants', newAssistants);
      setAssistants(newAssistants);
    } catch (e) {
      console.error('Failed to set default', e);
    }
  };

  const pinnedAssistants = assistants.filter(a => a.isPinned);
  const unpinnedAssistants = assistants.filter(a => !a.isPinned);

  const renderAssistantItem = ({ item }: { item: Assistant }) => (
    <TouchableOpacity
      style={[styles.assistantItem, { backgroundColor: colors.bgSurfaceHighest }]}
      onPress={() => handleEditAssistant(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.assistantEmoji, { backgroundColor: colors.primary + '20' }]}>
        <Text style={styles.emojiText}>{item.emoji}</Text>
      </View>
      
      <View style={styles.assistantInfo}>
        <View style={styles.assistantHeader}>
          <Text style={[styles.assistantName, { color: colors.textPrimary }]}>{item.name}</Text>
          {item.isDefault && (
            <View style={[styles.defaultBadge, { backgroundColor: colors.primary + '20' }]}>
              <Text style={[styles.defaultText, { color: colors.primary }]}>默认</Text>
            </View>
          )}
          {item.isPinned && <Text style={styles.pinIcon}>📌</Text>}
        </View>
        
        {item.description && (
          <Text style={[styles.assistantDesc, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.description}
          </Text>
        )}
      </View>

      <View style={styles.assistantActions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleTogglePin(item)}
        >
          <Text style={[styles.actionText, { color: colors.textSecondary }]}>
            {item.isPinned ? '取消置顶' : '置顶'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleSetDefault(item)}
        >
          <Text style={[styles.actionText, { color: colors.textSecondary }]}>
            {item.isDefault ? '已是默认' : '设为默认'}
          </Text>
        </TouchableOpacity>
        {!item.isDefault && (
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleDeleteAssistant(item)}
          >
            <Text style={[styles.actionText, { color: '#EF4444' }]}>删除</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

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
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>伙伴管理</Text>
            <TouchableOpacity onPress={handleCreateAssistant}>
              <Text style={[styles.createButton, { color: colors.primary }]}>+ 新建</Text>
            </TouchableOpacity>
          </View>

          {/* 助手列表 */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>加载中...</Text>
            </View>
          ) : assistants.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🤖</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>暂无助手</Text>
              <Text style={[styles.emptySubText, { color: colors.textSecondary }]}>点击右上角创建第一个助手</Text>
              <TouchableOpacity 
                style={[styles.createFirstButton, { backgroundColor: colors.primary }]}
                onPress={handleCreateAssistant}
              >
                <Text style={styles.createFirstText}>创建助手</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={[...pinnedAssistants, ...unpinnedAssistants]}
              renderItem={renderAssistantItem}
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
  createButton: {
    fontSize: 16,
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
    marginBottom: 24,
  },
  createFirstButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  createFirstText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  assistantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  assistantEmoji: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  emojiText: {
    fontSize: 24,
  },
  assistantInfo: {
    flex: 1,
  },
  assistantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  assistantName: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  defaultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  defaultText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pinIcon: {
    fontSize: 14,
  },
  assistantDesc: {
    fontSize: 14,
  },
  assistantActions: {
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