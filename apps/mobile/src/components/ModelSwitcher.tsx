import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput } from 'react-native';
import { useNativeTheme } from '@baishou/ui/native';
import { useBaishou } from '../providers/BaishouProvider';

interface Provider {
  id: string;
  name: string;
  type: string;
  models: string[];
  enabledModels: string[];
}

interface ModelSwitcherProps {
  isVisible: boolean;
  onClose: () => void;
  onSelect: (providerId: string, modelId: string) => void;
  currentProviderId?: string;
  currentModelId?: string;
}

export const ModelSwitcher: React.FC<ModelSwitcherProps> = ({
  isVisible,
  onClose,
  onSelect,
  currentProviderId,
  currentModelId,
}) => {
  const { colors } = useNativeTheme();
  const { services, dbReady } = useBaishou();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const loadProviders = async () => {
    if (!dbReady || !services) return;
    try {
      const providerList = await services.settingsManager.get<Provider[]>('ai_providers') || [];
      setProviders(providerList);
    } catch (e) {
      console.warn('Failed to load providers', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isVisible) {
      loadProviders();
    }
  }, [isVisible, dbReady, services]);

  const filteredProviders = providers.map(provider => {
    const modelList = provider.enabledModels.length > 0 ? provider.enabledModels : provider.models;
    const matchedModels = searchQuery.trim() === '' 
      ? modelList 
      : modelList.filter(m => m.toLowerCase().includes(searchQuery.toLowerCase()));
      
    return { ...provider, matchedModels };
  }).filter(p => p.matchedModels.length > 0);

  const renderItem = ({ item }: { item: Provider }) => (
    <View style={styles.providerSection}>
      <Text style={[styles.providerName, { color: colors.textSecondary }]}>{item.name}</Text>
      {item.matchedModels.map(modelId => (
        <TouchableOpacity
          key={`${item.id}-${modelId}`}
          style={[
            styles.modelItem,
            { backgroundColor: colors.bgSurfaceHighest },
            item.id === currentProviderId && modelId === currentModelId && { backgroundColor: colors.primary + '20' }
          ]}
          onPress={() => onSelect(item.id, modelId)}
        >
          <Text style={[styles.modelName, { color: colors.textPrimary }]}>{modelId}</Text>
          {item.id === currentProviderId && modelId === currentModelId && (
            <Text style={[styles.checkmark, { color: colors.primary }]}>✓</Text>
          )}
        </TouchableOpacity>
      ))}
    </View>
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
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>切换模型</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.closeButton, { color: colors.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <View style={[styles.searchContainer, { backgroundColor: colors.bgSurfaceHighest }]}>
            <Text style={[styles.searchIcon, { color: colors.textSecondary }]}>🔍</Text>
            <TextInput
              style={[styles.searchInput, { color: colors.textPrimary }]}
              placeholder="搜索模型..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>加载中...</Text>
            </View>
          ) : filteredProviders.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>暂无可用模型</Text>
              <Text style={[styles.emptySubText, { color: colors.textSecondary }]}>请先在设置中配置AI供应商</Text>
            </View>
          ) : (
            <FlatList
              data={filteredProviders}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
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
  providerSection: {
    marginBottom: 16,
  },
  providerName: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingVertical: 8,
    textTransform: 'uppercase',
  },
  modelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  modelName: {
    fontSize: 16,
    fontWeight: '500',
  },
  checkmark: {
    fontSize: 18,
    fontWeight: '600',
  },
});