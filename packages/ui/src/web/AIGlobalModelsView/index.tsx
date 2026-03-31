import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './AIGlobalModelsView.module.css';

// ─── Types ──────────────────────────────────────────────────

export interface GlobalModelsConfig {
  defaultProviderId?: string;
  defaultModelId?: string;
  reasoningProviderId?: string;
  reasoningModelId?: string;
}

export interface ProviderModelMap {
  [providerId: string]: string[];
}

export interface AIGlobalModelsViewProps {
  config: GlobalModelsConfig;
  availableModels: ProviderModelMap;
  onChange: (config: GlobalModelsConfig) => void;
}

// ─── Component ──────────────────────────────────────────────

export const AIGlobalModelsView: React.FC<AIGlobalModelsViewProps> = ({
  config,
  availableModels,
  onChange,
}) => {
  const { t } = useTranslation();

  const providerIds = Object.keys(availableModels);

  const handleProviderChange = (type: 'default' | 'reasoning', providerId: string) => {
    const defaultModel = availableModels[providerId]?.[0] || '';
    if (type === 'default') {
      onChange({ ...config, defaultProviderId: providerId, defaultModelId: defaultModel });
    } else {
      onChange({ ...config, reasoningProviderId: providerId, reasoningModelId: defaultModel });
    }
  };

  const handleModelChange = (type: 'default' | 'reasoning', modelId: string) => {
    if (type === 'default') {
      onChange({ ...config, defaultModelId: modelId });
    } else {
      onChange({ ...config, reasoningModelId: modelId });
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t('settings.ai.global_models', 'AI 全局模型')}</h2>
        <p className={styles.desc}>
          {t('settings.ai.global_desc', '设置系统默认使用的模型，当未绑定专属模型的 Agent 被选中时，将使用这里的默认配置。')}
        </p>
      </div>

      <div className={styles.card}>
        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <span className={styles.settingIcon}>✨</span>
            <div className={styles.settingText}>
              <span className={styles.settingLabel}>{t('settings.ai.default_model', '默认模型')}</span>
              <span className={styles.settingHint}>{t('settings.ai.default_hint', '用于日常对话和基础文本处理')}</span>
            </div>
          </div>
          <div className={styles.settingSelects}>
            <select 
              className={styles.select}
              value={config.defaultProviderId || ''}
              onChange={(e) => handleProviderChange('default', e.target.value)}
            >
              <option value="" disabled>选择 Provider</option>
              {providerIds.map(p => <option key={`p-${p}`} value={p}>{p}</option>)}
            </select>
            
            <select
              className={styles.select}
              value={config.defaultModelId || ''}
              onChange={(e) => handleModelChange('default', e.target.value)}
              disabled={!config.defaultProviderId}
            >
              <option value="" disabled>选择 Model</option>
              {(availableModels[config.defaultProviderId || ''] || []).map(m => (
                <option key={`m-${m}`} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.divider} />

        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <span className={styles.settingIcon}>🧠</span>
            <div className={styles.settingText}>
              <span className={styles.settingLabel}>{t('settings.ai.reasoning_model', '推理模型 (Agent)')}</span>
              <span className={styles.settingHint}>{t('settings.ai.reasoning_hint', '用于工具调用、月度总结等复杂长思考任务')}</span>
            </div>
          </div>
          <div className={styles.settingSelects}>
            <select 
              className={styles.select}
              value={config.reasoningProviderId || ''}
              onChange={(e) => handleProviderChange('reasoning', e.target.value)}
            >
              <option value="" disabled>选择 Provider</option>
              {providerIds.map(p => <option key={`p-${p}`} value={p}>{p}</option>)}
            </select>
            
            <select
              className={styles.select}
              value={config.reasoningModelId || ''}
              onChange={(e) => handleModelChange('reasoning', e.target.value)}
              disabled={!config.reasoningProviderId}
            >
              <option value="" disabled>选择 Model</option>
              {(availableModels[config.reasoningProviderId || ''] || []).map(m => (
                <option key={`m-${m}`} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
