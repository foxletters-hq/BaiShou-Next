import React from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsSection } from '../SettingsSection/SettingsSection';
import styles from './FeatureSettingsView.module.css';

// ─── Types ──────────────────────────────────────────────────

export interface FeatureSettingsConfig {
  ragEnabled: boolean;
  ragSimilarityThreshold: number; /* 0.0 - 1.0 */
  searchMaxResults: number;
  searchIncludeDiary: boolean;
  summaryAutoGenerate: boolean;
  devModeEnabled: boolean;
}

export interface FeatureSettingsViewProps {
  config: FeatureSettingsConfig;
  onChange: (config: FeatureSettingsConfig) => void;
}

// ─── Component ──────────────────────────────────────────────

export const FeatureSettingsView: React.FC<FeatureSettingsViewProps> = ({
  config,
  onChange,
}) => {
  const { t } = useTranslation();
  const handleToggle = (key: keyof FeatureSettingsConfig) => {
  onChange({ ...config, [key]: !config[key] });
  };

  const handleChange = (key: keyof FeatureSettingsConfig, value: number) => {


    onChange({ ...config, [key]: value });
  };

  return (
    <div className={styles.container}>
      {/* ─── RAG Settings ─── */}
      <SettingsSection 
        title={t('settings.features.rag_title', 'RAG 记忆检索')} 
        description={t('settings.features.rag_desc', '配置 AI 在对话时如何从历史日记和记忆中召回上下文。')}
      >
        <div className={styles.settingItem}>
          <div className={styles.settingInfo}>
            <div className={styles.settingLabel}>{t('settings.features.rag_enable', '启用自动关联检索')}</div>
            <div className={styles.settingHint}>{t('settings.features.rag_enable_hint', '发送消息时自动搜索相关知识点')}</div>
          </div>
          <div 
            className={styles.switch} 
            data-on={config.ragEnabled}
            onClick={() => handleToggle('ragEnabled')}
          >
            <div className={styles.switchHandle} />
          </div>
        </div>
        
        <div className={styles.settingItem}>
          <div className={styles.settingInfo}>
            <div className={styles.settingLabel}>{t('settings.features.rag_threshold', '相似度匹配阈值')}</div>
            <div className={styles.settingHint}>{t('settings.features.rag_threshold_hint', '数值越高，召回的关联内容越精准，但数量越少。')}</div>
          </div>
          <div className={styles.controlGroup}>
            <span className={styles.valueDisplay}>{config.ragSimilarityThreshold.toFixed(2)}</span>
            <input 
              type="range" 
              className={styles.rangeInput}
              min="0.50" 
              max="0.95" 
              step="0.01" 
              value={config.ragSimilarityThreshold}
              onChange={(e) => handleChange('ragSimilarityThreshold', parseFloat(e.target.value))}
            />
          </div>
        </div>
      </SettingsSection>

      {/* ─── Web Search Settings ─── */}
      <SettingsSection title={t('settings.features.search_title', '网络搜索 API')}>
        <div className={styles.settingItem}>
          <div className={styles.settingInfo}>
            <div className={styles.settingLabel}>{t('settings.features.search_max', '最大搜索结果数')}</div>
            <div className={styles.settingHint}>{t('settings.features.search_max_hint', '单次搜索时返回的最大网页数量 (影响部分模型的上下文窗口)')}</div>
          </div>
          <div className={styles.controlGroup}>
            <span className={styles.valueDisplay}>{config.searchMaxResults}</span>
            <input 
              type="range" 
              className={styles.rangeInput}
              min="3" 
              max="20" 
              step="1" 
              value={config.searchMaxResults}
              onChange={(e) => handleChange('searchMaxResults', parseInt(e.target.value))}
            />
          </div>
        </div>
        
        <div className={styles.settingItem}>
          <div className={styles.settingInfo}>
            <div className={styles.settingLabel}>{t('settings.features.search_diary', '站内搜索引擎')}</div>
            <div className={styles.settingHint}>{t('settings.features.search_diary_hint', '允许搜索工具顺带检索本地日记内容')}</div>
          </div>
          <div 
            className={styles.switch} 
            data-on={config.searchIncludeDiary}
            onClick={() => handleToggle('searchIncludeDiary')}
          >
            <div className={styles.switchHandle} />
          </div>
        </div>
      </SettingsSection>

      {/* ─── Summary Settings ─── */}
      <SettingsSection title={t('settings.features.summary_title', '自动总结服务')}>
        <div className={styles.settingItem}>
          <div className={styles.settingInfo}>
            <div className={styles.settingLabel}>{t('settings.features.summary_auto', '每周/每月自动生成总结')}</div>
            <div className={styles.settingHint}>{t('settings.features.summary_auto_hint', '会在后台静默使用推理模型生成周期性回顾')}</div>
          </div>
          <div 
            className={styles.switch} 
            data-on={config.summaryAutoGenerate}
            onClick={() => handleToggle('summaryAutoGenerate')}
          >
            <div className={styles.switchHandle} />
          </div>
        </div>
      </SettingsSection>

      {/* ─── Dev Settings ─── */}
      <SettingsSection title={t('settings.features.dev_title', '高级选项')}>
        <div className={styles.settingItem}>
          <div className={styles.settingInfo}>
            <div className={styles.settingLabel}>{t('settings.features.dev_mode', '开发者模式')}</div>
            <div className={styles.settingHint}>{t('settings.features.dev_mode_hint', '开启日志诊断、伙伴 工具链调用追踪与 MCP 调试')}</div>
          </div>
          <div 
            className={styles.switch} 
            data-on={config.devModeEnabled}
            onClick={() => handleToggle('devModeEnabled')}
          >
            <div className={styles.switchHandle} />
          </div>
        </div>
      </SettingsSection>

    </div>
  );
};
