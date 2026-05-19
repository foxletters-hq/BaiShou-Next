import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNativeTheme } from '@baishou/ui/src/native/theme';
import { useBaishou } from '../../providers/BaishouProvider';

export const SummarySettingsSection: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useNativeTheme();
  const { services, dbReady } = useBaishou();

  const [summaryConfig, setSummaryConfig] = useState<any>({});
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [templateText, setTemplateText] = useState('');

  useEffect(() => {
    if (!dbReady || !services) return;
    const loadConfig = async () => {
      try {
        const summaryConfigData = await services.settingsManager.get<any>('summary_config') || {};
        setSummaryConfig(summaryConfigData);
      } catch (e) {
        console.warn('Load summary config failed', e);
      }
    };
    loadConfig();
  }, [dbReady, services]);

  const handleSaveSummaryConfig = async (config: any) => {
    if (!services || !dbReady) return;
    try {
      await services.settingsManager.set('summary_config', config);
      setSummaryConfig(config);
      Alert.alert(t('common.success', '成功'), t('settings.summary_saved', '总结配置已保存'));
    } catch (e) {
      Alert.alert(t('common.error', '错误'), t('settings.save_failed', '保存失败'));
    }
  };

  const handleEditTemplate = (templateType: string) => {
    const templateKey = `${templateType}Template`;
    const defaultTemplates: Record<string, string> = {
      weekly: '## 📋 本周回顾\n\n### 🎯 主要事件\n> 请按时间顺序列出本周发生的重要事件和经历。\n\n### 😊 情绪变化\n> 记录本周的情绪起伏，包括情绪触发因素 and 个人反思。\n\n### 💡 重要领悟\n> 总结本周获得的新见解、学到的经验或成长。\n\n### 📌 下周展望\n> 为下周设定目标或需要关注的事项。',
      monthly: '## 📅 本月总结\n\n### 🏆 重要里程碑\n> 回顾这个月达成的重要目标 and 成就。\n\n### 📈 成长轨迹\n> 分析个人成长 and 变化，包括技能提升、习惯养成等。\n\n### 🔄 关键转折\n> 记录本月发生的重大变化或决策节点。\n\n### 🎯 下月计划\n> 为下个月设定具体目标 and 行动方案。',
      quarterly: '## 📊 季度复盘\n\n### 🎯 目标达成情况\n> 对照季度初设定的目标，评估完成度。\n\n### 📉 数据分析\n> 基于日记数据，分析趋势 and 模式。\n\n### 🔍 深度反思\n> 对这段时间的经历进行深度思考 and 总结。\n\n### 🗺️ 下季度规划\n> 制定下个季度的战略方向 and 具体计划。',
      yearly: '## 🎊 年度回顾\n\n### 🏅 年度成就\n> 列出本年最重要的成就 and 突破。\n\n### 📚 年度学习\n> 总结今年学到的最重要的几件事。\n\n### 🌟 高光时刻\n> 回顾今年的闪光点 and 最值得纪念的时刻。\n\n### 🔮 新年愿景\n> 为新的一年设定主题 and 核心目标。',
    };
    setEditingTemplate(templateType);
    setTemplateText(summaryConfig[templateKey] || defaultTemplates[templateType] || '');
  };

  const handleResetTemplate = async (templateType: string) => {
    if (!services || !dbReady) return;
    const defaultTemplates: Record<string, string> = {
      weekly: '## 📋 本周回顾\n\n### 🎯 主要事件\n> 请按时间顺序列出本周发生的重要事件和经历。\n\n### 😊 情绪变化\n> 记录本周的情绪起伏，包括情绪触发因素 and 个人反思。\n\n### 💡 重要领悟\n> 总结本周获得的新见解、学到的经验或成长。\n\n### 📌 下周展望\n> 为下周设定目标或需要关注的事项。',
      monthly: '## 📅 本月总结\n\n### 🏆 重要里程碑\n> 回顾这个月达成的重要目标 and 成就。\n\n### 📈 成长轨迹\n> 分析个人成长 and 变化，包括技能提升、习惯养成等。\n\n### 🔄 关键转折\n> 记录本月发生的重大变化或决策节点。\n\n### 🎯 下月计划\n> 为下个月设定具体目标 and 行动方案。',
      quarterly: '## 📊 季度复盘\n\n### 🎯 目标达成情况\n> 对照季度初设定的目标，评估完成度。\n\n### 📉 数据分析\n> 基于日记数据，分析趋势 and 模式。\n\n### 🔍 深度反思\n> 对这段时间的经历进行深度思考 and 总结。\n\n### 🗺️ 下季度规划\n> 制定下个季度的战略方向 and 具体计划。',
      yearly: '## 🎊 年度回顾\n\n### 🏅 年度成就\n> 列出本年最重要的成就 and 突破。\n\n### 📚 年度学习\n> 总结今年学到的最重要的几件事。\n\n### 🌟 高光时刻\n> 回顾今年的闪光点 and 最值得纪念的时刻。\n\n### 🔮 新年愿景\n> 为新的一年设定主题 and 核心目标。',
    };
    const templateKey = `${templateType}Template`;
    const newConfig = { ...summaryConfig };
    newConfig[templateKey] = defaultTemplates[templateType] || '';
    await handleSaveSummaryConfig(newConfig);
    Alert.alert(t('common.success', '成功'), t('settings.template_reset', '模板已重置为默认'));
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate || !services || !dbReady) return;
    try {
      const templateKey = `${editingTemplate}Template`;
      const newConfig = { ...summaryConfig, [templateKey]: templateText };
      await handleSaveSummaryConfig(newConfig);
      setEditingTemplate(null);
      setTemplateText('');
    } catch (e) {
      console.error('Save template failed', e);
    }
  };

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
        {t('settings.summary_title', '回忆生成设置')}
      </Text>
      <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
        {t('settings.summary_desc', '配置周/月/季/年总结模板')}
      </Text>
      
      {editingTemplate && (
        <View style={[styles.templateEditor, { backgroundColor: colors.bgSurfaceHighest }]}>
          <Text style={[styles.templateEditorTitle, { color: colors.textPrimary }]}>
            {t('settings.edit_template', '编辑模板')} - {t(`settings.${editingTemplate}_template`, editingTemplate)}
          </Text>
          <TextInput
            style={[styles.templateInput, { 
              backgroundColor: colors.bgSurface,
              color: colors.textPrimary,
              borderColor: colors.borderSubtle,
            }]}
            value={templateText}
            onChangeText={setTemplateText}
            placeholder={t('settings.template_placeholder', '输入模板内容...')}
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
          <View style={styles.templateActions}>
            <TouchableOpacity 
              style={[styles.templateButton, { backgroundColor: colors.primary }]}
              onPress={handleSaveTemplate}
            >
              <Text style={[styles.templateButtonText, { color: '#FFF' }]}>{t('common.save', '保存')}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.templateButton, { backgroundColor: colors.bgSurface }]}
              onPress={() => setEditingTemplate(null)}
            >
              <Text style={[styles.templateButtonText, { color: colors.textPrimary }]}>{t('common.cancel', '取消')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {['weekly', 'monthly', 'quarterly', 'yearly'].map((type) => {
        const templateKey = `${type}Template`;
        return (
          <View key={type} style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
            <View style={styles.templateHeader}>
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t(`settings.${type}_template`, `${type}总结模板`)}</Text>
              <View style={styles.templateActions}>
                <TouchableOpacity onPress={() => handleEditTemplate(type)}>
                  <Text style={[styles.editButton, { color: colors.primary }]}>{t('common.edit', '编辑')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleResetTemplate(type)}>
                  <Text style={[styles.editButton, { color: colors.textSecondary }]}>{t('settings.reset', '重置')}</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={[styles.settingValue, { color: colors.textSecondary }]} numberOfLines={2}>
              {summaryConfig[templateKey]?.substring(0, 50) || t('settings.default_template', '默认模板')}...
            </Text>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionDescription: {
    fontSize: 14,
    marginBottom: 16,
  },
  settingItem: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  settingValue: {
    fontSize: 14,
  },
  templateEditor: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  templateEditorTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  templateInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    minHeight: 120,
    marginBottom: 12,
  },
  templateActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  templateButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  templateButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  editButton: {
    fontSize: 14,
    fontWeight: '600',
  },
});
