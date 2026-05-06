import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useNativeTheme } from '@baishou/ui/src/native/theme';
import { useBaishou } from '../providers/BaishouProvider';

interface PromptShortcut {
  id: string;
  icon: string;
  name: string;
  content: string;
}

interface ShortcutManagerProps {
  isVisible: boolean;
  onClose: () => void;
  onSelect: (shortcut: PromptShortcut) => void;
}

export const ShortcutManager: React.FC<ShortcutManagerProps> = ({
  isVisible,
  onClose,
  onSelect,
}) => {
  const { colors } = useNativeTheme();
  const { services, dbReady } = useBaishou();
  const [shortcuts, setShortcuts] = useState<PromptShortcut[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingShortcut, setEditingShortcut] = useState<PromptShortcut | null>(null);
  const [editName, setEditName] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editIcon, setEditIcon] = useState('⚡');

  const loadShortcuts = async () => {
    if (!dbReady || !services) return;
    try {
      const shortcutList = await services.settingsManager.get<PromptShortcut[]>('prompt_shortcuts') || [];
      setShortcuts(shortcutList);
    } catch (e) {
      console.warn('Failed to load shortcuts', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isVisible) {
      loadShortcuts();
    }
  }, [isVisible, dbReady, services]);

  const handleAdd = () => {
    setEditingShortcut(null);
    setEditName('');
    setEditContent('');
    setEditIcon('⚡');
    setShowEditDialog(true);
  };

  const handleEdit = (shortcut: PromptShortcut) => {
    setEditingShortcut(shortcut);
    setEditName(shortcut.name);
    setEditContent(shortcut.content);
    setEditIcon(shortcut.icon);
    setShowEditDialog(true);
  };

  const handleDelete = (shortcut: PromptShortcut) => {
    Alert.alert(
      '确认删除',
      `确定要删除快捷方式「${shortcut.name}」吗？`,
      [
        { text: '取消', style: 'cancel' },
        { 
          text: '删除', 
          style: 'destructive',
          onPress: async () => {
            try {
              const newShortcuts = shortcuts.filter(s => s.id !== shortcut.id);
              await services?.settingsManager.set('prompt_shortcuts', newShortcuts);
              setShortcuts(newShortcuts);
            } catch (e) {
              console.error('Failed to delete shortcut', e);
            }
          }
        },
      ]
    );
  };

  const handleSave = async () => {
    if (!editName.trim() || !editContent.trim()) {
      Alert.alert('错误', '名称和内容不能为空');
      return;
    }

    try {
      let newShortcuts: PromptShortcut[];
      
      if (editingShortcut) {
        // 编辑现有快捷方式
        newShortcuts = shortcuts.map(s => 
          s.id === editingShortcut.id 
            ? { ...s, name: editName, content: editContent, icon: editIcon }
            : s
        );
      } else {
        // 添加新快捷方式
        const newShortcut: PromptShortcut = {
          id: Date.now().toString(),
          icon: editIcon,
          name: editName,
          content: editContent,
        };
        newShortcuts = [...shortcuts, newShortcut];
      }

      await services?.settingsManager.set('prompt_shortcuts', newShortcuts);
      setShortcuts(newShortcuts);
      setShowEditDialog(false);
    } catch (e) {
      console.error('Failed to save shortcut', e);
      Alert.alert('错误', '保存失败');
    }
  };

  const handleSelect = (shortcut: PromptShortcut) => {
    onSelect(shortcut);
    onClose();
  };

  return (
    <>
      <Modal
        visible={isVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={onClose}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.bgSurface }]}>
            {/* 标题栏 */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Text style={styles.modalIcon}>⚡</Text>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>快捷指令</Text>
              </View>
              <TouchableOpacity onPress={handleAdd}>
                <Text style={[styles.addButton, { color: colors.primary }]}>+ 添加</Text>
              </TouchableOpacity>
            </View>

            {/* 列表区域 */}
            <ScrollView style={styles.list}>
              {loading ? (
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>加载中...</Text>
                </View>
              ) : shortcuts.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>暂无快捷指令</Text>
                </View>
              ) : (
                shortcuts.map((shortcut) => (
                  <TouchableOpacity
                    key={shortcut.id}
                    style={[styles.shortcutItem, { backgroundColor: colors.bgSurfaceHighest }]}
                    onPress={() => handleSelect(shortcut)}
                  >
                    <View style={[styles.shortcutIcon, { backgroundColor: colors.primary + '20' }]}>
                      <Text style={styles.shortcutIconText}>{shortcut.icon}</Text>
                    </View>
                    <View style={styles.shortcutInfo}>
                      <Text style={[styles.shortcutName, { color: colors.textPrimary }]}>{shortcut.name}</Text>
                      <Text style={[styles.shortcutContent, { color: colors.textSecondary }]} numberOfLines={1}>
                        {shortcut.content}
                      </Text>
                    </View>
                    <View style={styles.shortcutActions}>
                      <TouchableOpacity 
                        style={styles.shortcutActionButton}
                        onPress={() => handleEdit(shortcut)}
                      >
                        <Text style={[styles.shortcutActionText, { color: colors.textSecondary }]}>编辑</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.shortcutActionButton}
                        onPress={() => handleDelete(shortcut)}
                      >
                        <Text style={[styles.shortcutActionText, { color: '#EF4444' }]}>删除</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            {/* 关闭按钮 */}
            <TouchableOpacity 
              style={[styles.closeButton, { backgroundColor: colors.bgSurfaceHighest }]}
              onPress={onClose}
            >
              <Text style={[styles.closeButtonText, { color: colors.textSecondary }]}>关闭</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 编辑对话框 */}
      <Modal
        visible={showEditDialog}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowEditDialog(false)}
      >
        <View style={styles.editModalOverlay}>
          <View style={[styles.editModalContent, { backgroundColor: colors.bgSurface }]}>
            <Text style={[styles.editModalTitle, { color: colors.textPrimary }]}>
              {editingShortcut ? '编辑指令' : '新建指令'}
            </Text>

            <View style={styles.editForm}>
              <View style={styles.editIconRow}>
                <TextInput
                  style={[styles.editIconInput, { 
                    backgroundColor: colors.bgSurfaceHighest,
                    color: colors.textPrimary,
                    borderColor: colors.borderSubtle,
                  }]}
                  value={editIcon}
                  onChangeText={setEditIcon}
                  maxLength={2}
                  placeholder="图标"
                  placeholderTextColor={colors.textSecondary}
                />
                <TextInput
                  style={[styles.editNameInput, { 
                    backgroundColor: colors.bgSurfaceHighest,
                    color: colors.textPrimary,
                    borderColor: colors.borderSubtle,
                  }]}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="指令名称"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <TextInput
                style={[styles.editContentInput, { 
                  backgroundColor: colors.bgSurfaceHighest,
                  color: colors.textPrimary,
                  borderColor: colors.borderSubtle,
                }]}
                value={editContent}
                onChangeText={setEditContent}
                placeholder="输入将要发送给AI的Prompt模板..."
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.editActions}>
              <TouchableOpacity 
                style={[styles.editCancelButton, { backgroundColor: colors.bgSurfaceHighest }]}
                onPress={() => setShowEditDialog(false)}
              >
                <Text style={[styles.editCancelButtonText, { color: colors.textSecondary }]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.editSaveButton, { backgroundColor: colors.primary }]}
                onPress={handleSave}
              >
                <Text style={styles.editSaveButtonText}>确认</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingBottom: 16,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  addButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  list: {
    flex: 1,
    paddingHorizontal: 24,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
  },
  shortcutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  shortcutIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  shortcutIconText: {
    fontSize: 20,
  },
  shortcutInfo: {
    flex: 1,
  },
  shortcutName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  shortcutContent: {
    fontSize: 14,
  },
  shortcutActions: {
    flexDirection: 'row',
    gap: 8,
  },
  shortcutActionButton: {
    padding: 8,
  },
  shortcutActionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  closeButton: {
    margin: 24,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  editModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editModalContent: {
    width: '90%',
    borderRadius: 20,
    padding: 24,
  },
  editModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  editForm: {
    marginBottom: 24,
  },
  editIconRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  editIconInput: {
    width: 56,
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 20,
  },
  editNameInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  editContentInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 120,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  editCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  editCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  editSaveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  editSaveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});