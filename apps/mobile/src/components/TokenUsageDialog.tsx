import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNativeTheme } from '@baishou/ui/native';

// Token 统计对话框属性
interface TokenUsageDialogProps {
  visible: boolean;
  onClose: () => void;
  currentModelId: string | null;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
}

export const TokenUsageDialog: React.FC<TokenUsageDialogProps> = ({
  visible,
  onClose,
  currentModelId,
  inputTokens,
  outputTokens,
  estimatedCost,
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
            {t('agent.token_usage', 'Token 使用统计')}
          </Text>
          <View style={styles.dialogRow}>
            <Text style={[styles.dialogLabel, { color: colors.textSecondary }]}>
              {t('agent.model', '模型')}:
            </Text>
            <Text style={[styles.dialogValue, { color: colors.textPrimary }]}>
              {currentModelId || t('common.unknown', '未知')}
            </Text>
          </View>
          <View style={styles.dialogRow}>
            <Text style={[styles.dialogLabel, { color: colors.textSecondary }]}>
              {t('agent.input_tokens', '输入 Token')}:
            </Text>
            <Text style={[styles.dialogValue, { color: colors.textPrimary }]}>{inputTokens}</Text>
          </View>
          <View style={styles.dialogRow}>
            <Text style={[styles.dialogLabel, { color: colors.textSecondary }]}>
              {t('agent.output_tokens', '输出 Token')}:
            </Text>
            <Text style={[styles.dialogValue, { color: colors.textPrimary }]}>{outputTokens}</Text>
          </View>
          <View style={styles.dialogRow}>
            <Text style={[styles.dialogLabel, { color: colors.textSecondary }]}>
              {t('agent.total_tokens', '总 Token')}:
            </Text>
            <Text style={[styles.dialogValue, { color: colors.textPrimary }]}>
              {inputTokens + outputTokens}
            </Text>
          </View>
          <View style={styles.dialogRow}>
            <Text style={[styles.dialogLabel, { color: colors.textSecondary }]}>
              {t('agent.estimated_cost', '预估费用')}:
            </Text>
            <Text style={[styles.dialogValue, { color: colors.textPrimary }]}>
              ${estimatedCost.toFixed(6)}
            </Text>
          </View>
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
    marginBottom: 20,
    textAlign: 'center',
  },
  dialogRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dialogLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  dialogValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    marginTop: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
