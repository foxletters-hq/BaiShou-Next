import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNativeTheme } from '@baishou/ui/native';

// 工具管理器属性
interface ToolManagerDialogProps {
  visible: boolean;
  onClose: () => void;
}

export const ToolManagerDialog: React.FC<ToolManagerDialogProps> = ({
  visible,
  onClose,
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
            {t('agent.tools.title', '工具管理')}
          </Text>
          <Text style={[styles.dialogDescription, { color: colors.textSecondary }]}>
            {t('agent.tools.description', '管理Agent可用的工具')}
          </Text>
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
    width: '80%',
    borderRadius: 24,
    padding: 24,
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  dialogDescription: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  closeButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
