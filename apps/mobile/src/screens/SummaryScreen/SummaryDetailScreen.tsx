import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, StatusBar, Alert, TextInput } from 'react-native';
import { useNativeTheme } from '@baishou/ui/src/native/theme';
import { MarkdownRenderer } from '@baishou/ui/src/native/MarkdownRenderer';
import { useBaishou } from '../../providers/BaishouProvider';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';

interface SummaryDetail {
  id?: number;
  type: string;
  startDate: string;
  endDate: string;
  content: string;
  sourceIds?: string | null;
  generatedAt?: string;
}

interface SummaryDetailScreenProps {
  summaryId: string;
  onBack: () => void;
}

export const SummaryDetailScreen: React.FC<SummaryDetailScreenProps> = ({
  summaryId,
  onBack,
}) => {
  const { t } = useTranslation();
  const { colors, isDark } = useNativeTheme();
  const { services, dbReady } = useBaishou();
  const [summary, setSummary] = useState<SummaryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchSummary = async () => {
      if (!dbReady || !services) return;
      setLoading(true);
      try {
        const summaryList = await services.summaryManager.list();
        const found = summaryList.find(s => String(s.id) === summaryId);
        if (found) {
          setSummary({
            id: found.id,
            type: found.type,
            startDate: found.startDate,
            endDate: found.endDate,
            content: found.content,
            sourceIds: found.sourceIds,
            generatedAt: found.generatedAt,
          });
        } else {
          Alert.alert(t('common.error', '错误'), t('summary.not_found', '总结未找到'));
          onBack();
        }
      } catch (e) {
        console.error('[SummaryDetail] fetch error:', e);
        Alert.alert(t('common.error', '错误'), t('summary.load_failed', '加载失败'));
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, [summaryId, dbReady, services, onBack, t]);

  const handleCopy = async () => {
    if (!summary?.content) return;
    try {
      await Clipboard.setStringAsync(summary.content);
      Alert.alert(t('common.success', '成功'), t('summary.copied', '内容已复制'));
    } catch (e) {
      console.error('[SummaryDetail] copy error:', e);
      Alert.alert(t('common.error', '错误'), t('summary.copy_failed', '复制失败'));
    }
  };

  const handleEdit = () => {
    if (!summary) return;
    setEditContent(summary.content);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent('');
  };

  const handleSave = async () => {
    if (!summary || !summary.id || !services) return;
    setIsSaving(true);
    try {
      const startDate = new Date(summary.startDate);
      const endDate = new Date(summary.endDate);
      await services.summaryManager.update(
        summary.id,
        summary.type as any,
        startDate,
        endDate,
        { content: editContent }
      );
      setSummary({ ...summary, content: editContent });
      setIsEditing(false);
      Alert.alert(t('common.success', '成功'), t('summary.saved', '保存成功'));
    } catch (e) {
      console.error('[SummaryDetail] save error:', e);
      Alert.alert(t('common.error', '错误'), t('summary.save_failed', '保存失败'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!summary || !services) return;
    Alert.alert(
      t('common.confirm_delete', '确认删除'),
      t('summary.delete_confirm', '确定要删除这个总结吗？此操作不可撤销。'),
      [
        { text: t('common.cancel', '取消'), style: 'cancel' },
        {
          text: t('common.delete', '删除'),
          style: 'destructive',
          onPress: async () => {
            try {
              const startDate = new Date(summary.startDate);
              const endDate = new Date(summary.endDate);
              await services.summaryManager.delete(summary.type as any, startDate, endDate);
              Alert.alert(t('common.success', '成功'), t('summary.deleted', '已删除'));
              onBack();
            } catch (e) {
              console.error('[SummaryDetail] delete error:', e);
              Alert.alert(t('common.error', '错误'), t('summary.delete_failed', '删除失败'));
            }
          }
        },
      ]
    );
  };

  const formatDate = (d: string) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  };

  const formatGeneratedAt = (d?: string) => {
    if (!d) return '';
    try {
      const date = new Date(d);
      if (isNaN(date.getTime())) return '';
      const year = date.getFullYear();
      if (year < 2000 || year > 2100) return '';
      return date.toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return '';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'weekly': return t('summary.stats_week', '周总结');
      case 'monthly': return t('summary.stats_month', '月总结');
      case 'quarterly': return t('summary.stats_quarter', '季总结');
      case 'yearly': return t('summary.stats_year', '年总结');
      default: return t('summary.stats_week', '周总结');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bgApp }]}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.bgApp} />
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            {t('common.loading', '加载中...')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!summary) return null;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bgApp }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.bgApp} />

      <View style={[styles.header, { backgroundColor: colors.bgSurface, borderBottomColor: colors.borderSubtle }]}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={[styles.backButtonText, { color: colors.primary }]}>
            ← {t('common.back', '返回')}
          </Text>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          {isEditing ? (
            <>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.primary }]}
                onPress={handleSave}
                disabled={isSaving}
              >
                <Text style={[styles.actionButtonText, { color: colors.textOnPrimary }]}>
                  {isSaving ? t('common.saving', '保存中...') : t('common.save', '保存')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.bgSurfaceHighest }]}
                onPress={handleCancelEdit}
              >
                <Text style={[styles.actionButtonText, { color: colors.textSecondary }]}>
                  {t('common.cancel', '取消')}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.primary }]}
                onPress={handleEdit}
              >
                <Text style={[styles.actionButtonText, { color: colors.textOnPrimary }]}>
                  {t('common.edit', '编辑')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.bgSurfaceHighest }]}
                onPress={handleCopy}
              >
                <Text style={[styles.actionButtonText, { color: colors.textSecondary }]}>
                  {t('common.copy', '复制')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.error }]}
                onPress={handleDelete}
              >
                <Text style={[styles.actionButtonText, { color: colors.textOnPrimary }]}>
                  {t('common.delete', '删除')}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <ScrollView style={styles.content} indicatorStyle="white">
        <View style={[styles.typeBadge, { backgroundColor: colors.primary + '20' }]}>
          <Text style={[styles.typeBadgeText, { color: colors.primary }]}>
            {getTypeLabel(summary.type)}
          </Text>
        </View>

        <View style={styles.dateContainer}>
          <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>
            {t('summary.date_range', '时间范围')}
          </Text>
          <Text style={[styles.dateText, { color: colors.textPrimary }]}>
            {formatDate(summary.startDate)} - {formatDate(summary.endDate)}
          </Text>
        </View>

        {summary.generatedAt && (
          <View style={styles.dateContainer}>
            <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>
              {t('summary.generated_at', '生成时间')}
            </Text>
            <Text style={[styles.dateText, { color: colors.textPrimary }]}>
              {formatGeneratedAt(summary.generatedAt)}
            </Text>
          </View>
        )}

        <View style={styles.contentContainer}>
          <Text style={[styles.contentLabel, { color: colors.textSecondary }]}>
            {t('summary.content', '总结内容')}
          </Text>
          {isEditing ? (
            <TextInput
              style={[styles.contentInput, {
                backgroundColor: colors.bgSurfaceHighest,
                color: colors.textPrimary,
                borderColor: colors.borderSubtle,
              }]}
              value={editContent}
              onChangeText={setEditContent}
              multiline
              textAlignVertical="top"
            />
          ) : (
            <MarkdownRenderer
              content={summary.content}
              style={styles.contentText}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
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
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 16,
  },
  typeBadgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dateContainer: {
    marginBottom: 16,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  dateText: {
    fontSize: 16,
  },
  contentContainer: {
    marginBottom: 16,
  },
  contentLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  contentText: {
    fontSize: 16,
    lineHeight: 24,
  },
  contentInput: {
    fontSize: 16,
    lineHeight: 24,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    minHeight: 200,
  },
});
