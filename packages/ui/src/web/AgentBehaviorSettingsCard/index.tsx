import React from 'react';
import styles from './AgentBehaviorSettingsCard.module.css';
import { useTranslation } from 'react-i18next';


export interface AgentBehaviorConfig {
  defaultSystemPrompt: string;
  defaultTemperature: number;
}

interface AgentBehaviorSettingsCardProps {
  config: AgentBehaviorConfig;
  onChange: (config: AgentBehaviorConfig) => void;
}

export const AgentBehaviorSettingsCard: React.FC<AgentBehaviorSettingsCardProps> = ({ config, onChange }) => {
  const { t } = useTranslation();
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>{t('settings.agent_identity', '系统核心设定 (Identity & Mind)')}</h3>
        <p className={styles.subtitle}>{t('settings.agent_identity_desc', '这些指令将作用于每一轮对话的最顶层。您可调整滑动条来控制回答的发散度。')}</p>
      </div>

      <div className={styles.row}>
        <div className={styles.inputGroup} style={{ flex: 1 }}>
          <label className={styles.label}>
            {t('settings.system_prompt', '底层 System Prompt')}
            <span className={styles.labelBadge}>{t('settings.advanced', '高级')}</span>
          </label>
          <textarea 
            className={styles.textarea}
            value={config.defaultSystemPrompt}
            onChange={(e) => onChange({ ...config, defaultSystemPrompt: e.target.value })}
            placeholder={t('settings.system_prompt_hint', '例如: 你是一个无所不知但只说重点的AI助手...')}
            rows={4}
          />
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.sliderGroup}>
          <div className={styles.sliderHeader}>
            <label className={styles.label}>{t('settings.temperature', '创造力/发散度 (Temperature)')}</label>
            <span className={styles.valBadge}>{config.defaultTemperature.toFixed(2)}</span>
          </div>
          <div className={styles.sliderTrackWrapper}>
            <input 
              type="range" 
              className={styles.rangeInput}
              min="0" 
              max="2" 
              step="0.1" 
              value={config.defaultTemperature}
              onChange={(e) => onChange({ ...config, defaultTemperature: parseFloat(e.target.value) })}
            />
          </div>
          <div className={styles.sliderScale}>
            <span>{t('settings.temp_low', '0.0 (严谨/确定)')}</span>
            <span>{t('settings.temp_mid', '1.0 (平衡)')}</span>
            <span>{t('settings.temp_high', '2.0 (发散/创造)')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
