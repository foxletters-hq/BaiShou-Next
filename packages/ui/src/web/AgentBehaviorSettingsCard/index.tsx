import React from 'react';
import styles from './AgentBehaviorSettingsCard.module.css';

export interface AgentBehaviorConfig {
  defaultSystemPrompt: string;
  defaultTemperature: number;
}

interface AgentBehaviorSettingsCardProps {
  config: AgentBehaviorConfig;
  onChange: (config: AgentBehaviorConfig) => void;
}

export const AgentBehaviorSettingsCard: React.FC<AgentBehaviorSettingsCardProps> = ({ config, onChange }) => {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>系统核心人设与心智参数 (Identity & Mind)</h3>
        <p className={styles.subtitle}>这些底层指令将注入每一轮对话的最顶层。可使用滑块控制其思想的发散程度。</p>
      </div>

      <div className={styles.row}>
        <div className={styles.inputGroup} style={{ flex: 1 }}>
          <label className={styles.label}>
            底层 System Prompt
            <span className={styles.labelBadge}>高级</span>
          </label>
          <textarea 
            className={styles.textarea}
            value={config.defaultSystemPrompt}
            onChange={(e) => onChange({ ...config, defaultSystemPrompt: e.target.value })}
            placeholder="例如: 你是一个无所不知但只说重点的数字生命..."
            rows={4}
          />
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.sliderGroup}>
          <div className={styles.sliderHeader}>
            <label className={styles.label}>创造力沸点 (Temperature)</label>
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
            <span>0.0 (极度严谨/确定性)</span>
            <span>1.0 (平衡)</span>
            <span>2.0 (极度发散/极富创造)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
