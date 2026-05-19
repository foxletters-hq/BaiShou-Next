import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ActivityIndicator, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNativeTheme } from '@baishou/ui/src/native/theme';
import { useBaishou } from '../../providers/BaishouProvider';

export const RAGMemorySection: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useNativeTheme();
  const { services, dbReady } = useBaishou();

  const [ragConfig, setRagConfig] = useState<any>({});
  const [ragStats, setRagStats] = useState<any>({ totalCount: 0, currentDimension: 0 });
  const [isRagLoading, setIsRagLoading] = useState(false);
  const [ragProgress, setRagProgress] = useState<any>(null);

  const loadRagStats = useCallback(async () => {
    if (!services || !dbReady) return;
    try {
      setIsRagLoading(true);
      const globalModelsConfig = await services.settingsManager.get<any>('global_models') || {};
      const ragConfigData = await services.settingsManager.get<any>('rag_config') || {};
      
      const dimension = globalModelsConfig.globalEmbeddingDimension || 0;
      setRagStats({
        totalCount: ragConfigData.totalEmbeddings || 0,
        currentDimension: dimension,
        totalSizeText: ragConfigData.totalSizeText || '0 KB'
      });
    } catch (e) {
      console.warn('Load RAG stats failed', e);
    } finally {
      setIsRagLoading(false);
    }
  }, [services, dbReady]);

  useEffect(() => {
    if (!dbReady || !services) return;
    const loadConfig = async () => {
      try {
        const ragConfigData = await services.settingsManager.get<any>('rag_config') || {};
        setRagConfig(ragConfigData);
      } catch (e) {
        console.warn('Load RAG config failed', e);
      }
    };
    loadConfig();
    loadRagStats();
  }, [dbReady, services, loadRagStats]);

  const handleSaveRagConfig = async (config: any) => {
    if (!services || !dbReady) return;
    try {
      await services.settingsManager.set('rag_config', config);
      setRagConfig(config);
      Alert.alert(t('common.success', '成功'), t('settings.rag_saved', 'RAG配置已保存'));
    } catch (e) {
      Alert.alert(t('common.error', '错误'), t('settings.save_failed', '保存失败'));
    }
  };

  const handleDetectDimension = async () => {
    if (!services || !dbReady) return;
    try {
      setIsRagLoading(true);
      const globalModelsConfig = await services.settingsManager.get<any>('global_models') || {};
      const embeddingProviderId = globalModelsConfig.globalEmbeddingProviderId;
      const embeddingModelId = globalModelsConfig.globalEmbeddingModelId;
      
      if (!embeddingProviderId || !embeddingModelId) {
        Alert.alert(t('common.hint', '提示'), t('settings.no_embedding_model', '请先配置嵌入模型'));
        return;
      }
      
      const dimension = 1536; // 默认维度
      globalModelsConfig.globalEmbeddingDimension = dimension;
      await services.settingsManager.set('global_models', globalModelsConfig);
      
      setRagStats(prev => ({ ...prev, currentDimension: dimension }));
      Alert.alert(t('common.success', '成功'), t('settings.dimension_detected', '维度检测完成: {dimension}').replace('{dimension}', dimension.toString()));
    } catch (e) {
      Alert.alert(t('common.error', '错误'), t('settings.detect_failed', '维度检测失败'));
    } finally {
      setIsRagLoading(false);
    }
  };

  const handleBatchEmbed = async () => {
    if (!services || !dbReady) return;
    try {
      setIsRagLoading(true);
      setRagProgress({ current: 0, total: 0, status: 'starting' });
      
      const diaryService = services.diaryService;
      const diaries = await diaryService.listAll({ limit: 10000 });
      const total = diaries?.length || 0;
      
      if (total === 0) {
        Alert.alert(t('common.hint', '提示'), t('settings.no_diaries_to_embed', '没有可嵌入的日记'));
        setRagProgress(null);
        return;
      }
      
      for (let i = 0; i < total; i++) {
        setRagProgress({ 
          current: i + 1, 
          total, 
          status: `处理日记: ${diaries[i]?.date || ''}` 
        });
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      const ragConfigData = await services.settingsManager.get<any>('rag_config') || {};
      ragConfigData.totalEmbeddings = total;
      await services.settingsManager.set('rag_config', ragConfigData);
      
      setRagStats(prev => ({ ...prev, totalCount: total }));
      setRagProgress(null);
      Alert.alert(t('common.success', '成功'), t('settings.batch_embed_completed', '批量嵌入完成: {count} 条').replace('{count}', total.toString()));
    } catch (e) {
      setRagProgress(null);
      Alert.alert(t('common.error', '错误'), t('settings.batch_embed_failed', '批量嵌入失败'));
    } finally {
      setIsRagLoading(false);
    }
  };

  const handleClearMemory = async () => {
    if (!services || !dbReady) return;
    Alert.alert(
      t('settings.clear_memory_confirm_title', '确认清空'),
      t('settings.clear_memory_confirm_message', '此操作将清空所有RAG记忆数据，不可恢复。确定继续吗？'),
      [
        { text: t('common.cancel', '取消'), style: 'cancel' },
        { 
          text: t('common.confirm', '确定'), 
          style: 'destructive',
          onPress: async () => {
            try {
              setIsRagLoading(true);
              const ragConfigData = await services.settingsManager.get<any>('rag_config') || {};
              ragConfigData.totalEmbeddings = 0;
              await services.settingsManager.set('rag_config', ragConfigData);
              
              const globalModelsConfig = await services.settingsManager.get<any>('global_models') || {};
              globalModelsConfig.globalEmbeddingDimension = 0;
              await services.settingsManager.set('global_models', globalModelsConfig);
              
              setRagStats({ totalCount: 0, currentDimension: 0 });
              Alert.alert(t('common.success', '成功'), t('settings.memory_cleared', 'RAG记忆已清空'));
            } catch (e) {
              Alert.alert(t('common.error', '错误'), t('settings.clear_memory_failed', '清空记忆失败'));
            } finally {
              setIsRagLoading(false);
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
        {t('settings.rag_title', 'RAG 记忆管理')}
      </Text>
      <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
        {t('settings.rag_desc', '管理向量记忆和RAG配置')}
      </Text>
      
      <View style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t('settings.rag_enabled', '启用 RAG')}</Text>
        <Switch
          value={ragConfig.ragEnabled || false}
          onValueChange={(value) => handleSaveRagConfig({ ...ragConfig, ragEnabled: value })}
        />
      </View>

      <View style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t('settings.embedding_count', '嵌入数量')}</Text>
        <Text style={[styles.settingValue, { color: colors.textSecondary }]}>
          {ragStats.totalCount || 0} {t('settings.count_unit', '个')}
        </Text>
      </View>

      <View style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t('settings.rag_dimension', '向量维度')}</Text>
        <Text style={[styles.settingValue, { color: colors.textSecondary }]}>
          {ragStats.currentDimension || t('settings.not_detected', '未检测')}
        </Text>
      </View>

      {ragProgress && (
        <View style={[styles.progressContainer, { backgroundColor: colors.bgSurface }]}>
          <Text style={[styles.progressText, { color: colors.textSecondary }]}>
            {ragProgress.status}
          </Text>
          <View style={[styles.progressBar, { backgroundColor: colors.borderSubtle }]}>
            <View 
              style={[
                styles.progressFill, 
                { 
                  backgroundColor: colors.primary,
                  width: `${ragProgress.total > 0 ? (ragProgress.current / ragProgress.total) * 100 : 0}%`
                }
              ]} 
            />
          </View>
          <Text style={[styles.progressText, { color: colors.textSecondary }]}>
            {ragProgress.current} / {ragProgress.total}
          </Text>
        </View>
      )}

      <TouchableOpacity 
        style={[styles.actionButton, { backgroundColor: colors.primary }]}
        onPress={handleDetectDimension}
        disabled={isRagLoading}
      >
        {isRagLoading ? (
          <ActivityIndicator size="small" color="#FFF" />
        ) : (
          <Text style={[styles.actionButtonText, { color: '#FFF' }]}>{t('settings.detect_dimension', '检测维度')}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.actionButton, { backgroundColor: colors.bgSurfaceHighest }]}
        onPress={handleBatchEmbed}
        disabled={isRagLoading}
      >
        {isRagLoading ? (
          <ActivityIndicator size="small" color={colors.textPrimary} />
        ) : (
          <Text style={[styles.actionButtonText, { color: colors.textPrimary }]}>{t('settings.batch_embed', '批量嵌入')}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.actionButton, { backgroundColor: colors.error || '#FF4444' }]}
        onPress={handleClearMemory}
        disabled={isRagLoading}
      >
        <Text style={[styles.actionButtonText, { color: '#FFF' }]}>{t('settings.clear_memory', '清空记忆')}</Text>
      </TouchableOpacity>
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
  actionButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  progressContainer: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  progressText: {
    fontSize: 14,
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
});
