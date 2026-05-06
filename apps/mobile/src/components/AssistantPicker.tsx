import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal } from 'react-native';
import { useNativeTheme } from '@baishou/ui/src/native/theme';
import { useBaishou } from '../providers/BaishouProvider';

interface Assistant {
  id: string;
  name: string;
  emoji: string;
  isDefault: boolean;
  isPinned: boolean;
  systemPrompt?: string;
  providerId?: string;
  modelId?: string;
}

interface AssistantPickerProps {
  isVisible: boolean;
  onClose: () => void;
  onSelect: (assistant: Assistant) => void;
  selectedAssistantId?: string;
}

export const AssistantPicker: React.FC<AssistantPickerProps> = ({
  isVisible,
  onClose,
  onSelect,
  selectedAssistantId,
}) => {
  const { colors } = useNativeTheme();
  const { services, dbReady } = useBaishou();
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAssistants = async () => {
    if (!dbReady || !services) return;
    try {
      // 这里需要从服务中获取助手列表
      // 由于mobile应用中没有assistantService，我们需要从settingsManager中获取
      const assistantList = await services.settingsManager.get<Assistant[]>('assistants') || [];
      setAssistants(assistantList);
    } catch (e) {
      console.warn('Failed to load assistants', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isVisible) {
      loadAssistants();
    }
  }, [isVisible, dbReady, services]);

  const renderItem = ({ item }: { item: Assistant }) => (
    <TouchableOpacity
      style={[
        styles.assistantItem,
        { backgroundColor: colors.bgSurfaceHighest },
        item.id === selectedAssistantId && { backgroundColor: colors.primary + '20' }
      ]}
      onPress={() => onSelect(item)}
    >
      <Text style={styles.emoji}>{item.emoji}</Text>
      <View style={styles.assistantInfo}>
        <Text style={[styles.assistantName, { color: colors.textPrimary }]}>{item.name}</Text>
        {item.isDefault && <Text style={[styles.defaultBadge, { color: colors.accentGreen }]}>默认</Text>}
      </View>
      {item.isPinned && <Text style={styles.pinIcon}>📌</Text>}
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.bgSurface }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>选择助手</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.closeButton, { color: colors.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          </View>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>加载中...</Text>
            </View>
          ) : assistants.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>暂无助手</Text>
              <Text style={[styles.emptySubText, { color: colors.textSecondary }]}>请先在设置中创建助手</Text>
            </View>
          ) : (
            <FlatList
              data={assistants}
              renderItem={renderItem}
              keyExtractor={item => item.id}
              style={styles.list}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  closeButton: {
    fontSize: 24,
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
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
  assistantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  emoji: {
    fontSize: 24,
    marginRight: 12,
  },
  assistantInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  assistantName: {
    fontSize: 16,
    fontWeight: '500',
  },
  defaultBadge: {
    fontSize: 12,
    marginLeft: 8,
    fontWeight: '600',
  },
  pinIcon: {
    fontSize: 16,
  },
});