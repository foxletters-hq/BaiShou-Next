import React from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNativeTheme } from '@baishou/ui/src/native/theme';

// 记忆召回项接口
interface RecallItem {
  id: string;
  type: string;
  title: string;
  snippet: string;
  date: string;
}

// 记忆召回答框属性
interface RecallDialogProps {
  visible: boolean;
  onClose: () => void;
  items: RecallItem[];
  isSearching: boolean;
  onSearch: (query: string, tab: 'diary' | 'memory') => void;
  onInject: (items: RecallItem[]) => void;
}

export const RecallDialog: React.FC<RecallDialogProps> = ({
  visible,
  onClose,
  items,
  isSearching,
  onSearch,
  onInject,
}) => {
  const { t } = useTranslation();
  const { colors } = useNativeTheme();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.dialogContent, { backgroundColor: colors.bgSurface }]}>
          <Text style={[styles.dialogTitle, { color: colors.textPrimary }]}>
            {t('agent.recall.title', '记忆召回')}
          </Text>
          <TextInput
            style={[styles.searchInput, {
              backgroundColor: colors.bgSurfaceHighest,
              color: colors.textPrimary,
              borderColor: colors.borderSubtle,
            }]}
            placeholder={t('agent.recall.search_placeholder', '搜索日记和记忆...')}
            placeholderTextColor={colors.textSecondary}
            onChangeText={(text) => onSearch(text, 'diary')}
          />
          <ScrollView style={styles.itemList}>
            {items.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.itemCard, { backgroundColor: colors.bgSurfaceHighest }]}
                onPress={() => onInject([item])}
              >
                <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>{item.title}</Text>
                <Text style={[styles.itemSnippet, { color: colors.textSecondary }]} numberOfLines={2}>
                  {item.snippet}
                </Text>
                <Text style={[styles.itemDate, { color: colors.textSecondary }]}>{item.date}</Text>
              </TouchableOpacity>
            ))}
            {items.length === 0 && !isSearching && (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {t('agent.recall.no_results', '暂无搜索结果')}
              </Text>
            )}
            {isSearching && (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {t('agent.recall.searching', '搜索中...')}
              </Text>
            )}
          </ScrollView>
          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: colors.primary }]}
            onPress={onClose}
          >
            <Text style={[styles.closeButtonText, { color: colors.textOnPrimary }]}>
              {t('common.close', '关闭')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialogContent: {
    width: '90%',
    height: '70%',
    borderRadius: 20,
    padding: 24,
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  itemList: {
    flex: 1,
  },
  itemCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  itemSnippet: {
    fontSize: 14,
    marginTop: 8,
  },
  itemDate: {
    fontSize: 12,
    marginTop: 4,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 40,
  },
  closeButton: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
