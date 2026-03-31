import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './AIModelServicesView.module.css';

// ─── Types ──────────────────────────────────────────────────

export interface AIProviderConfig {
  id: string;
  name: string;
  isEnabled: boolean;
  apiKey: string;
  baseUrl: string;
  customModels: string[];
}

export interface AIModelServicesViewProps {
  providers: AIProviderConfig[];
  onUpdateProvider: (provider: AIProviderConfig) => void;
  onToggleProvider: (id: string, enabled: boolean) => void;
}

// ─── Component ──────────────────────────────────────────────

export const AIModelServicesView: React.FC<AIModelServicesViewProps> = ({
  providers,
  onUpdateProvider,
  onToggleProvider,
}) => {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleEditClick = (id: string) => {
    setEditingId(editingId === id ? null : id);
  };

  const handleKeyChange = (provider: AIProviderConfig, apiKey: string) => {
    onUpdateProvider({ ...provider, apiKey });
  };

  const handleBaseUrlChange = (provider: AIProviderConfig, baseUrl: string) => {
    onUpdateProvider({ ...provider, baseUrl });
  };

  const handleCustomModelsChange = (provider: AIProviderConfig, value: string) => {
    const models = value.split(',').map(s => s.trim()).filter(Boolean);
    onUpdateProvider({ ...provider, customModels: models });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t('settings.ai.services', 'AI 模型服务')}</h2>
        <p className={styles.desc}>
          {t('settings.ai.services_desc', '配置各家 API Key 与代理接口')}
        </p>
      </div>

      <div className={styles.list}>
        {providers.map((p) => {
          const isEditing = editingId === p.id;
          
          return (
            <div key={p.id} className={`${styles.providerCard} ${isEditing ? styles.expanded : ''}`}>
              <div className={styles.cardHeader} onClick={() => handleEditClick(p.id)}>
                <div className={styles.cardInfo}>
                  <div className={styles.cardNameRow}>
                    <span className={styles.providerName}>{p.name}</span>
                    <span className={styles.providerId}>{p.id}</span>
                  </div>
                  <div className={styles.cardStatus}>
                    <div className={styles.statusIndicator} data-active={p.isEnabled} />
                    <span className={styles.statusText}>
                      {p.isEnabled 
                        ? (p.apiKey ? t('settings.ai.configured', '已配置') : t('settings.ai.need_key', '未配置 Key'))
                        : t('settings.ai.disabled', '已禁用')}
                    </span>
                  </div>
                </div>

                <div className={styles.cardActions}>
                  <div 
                    className={styles.switch} 
                    data-on={p.isEnabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleProvider(p.id, !p.isEnabled);
                    }}
                  >
                    <div className={styles.switchHandle} />
                  </div>
                  <div className={`${styles.chevron} ${isEditing ? styles.chevronOpen : ''}`}>
                    ›
                  </div>
                </div>
              </div>

              {isEditing && (
                <div className={styles.editForm}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>API Key {p.id === 'openai' ? '(可选本地)' : ''}</label>
                    <input 
                      type="password"
                      className={styles.formInput}
                      value={p.apiKey}
                      placeholder={`sk-...`}
                      onChange={(e) => handleKeyChange(p, e.target.value)}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>
                      API Base URL
                      <span className={styles.labelHint}>(可选)</span>
                    </label>
                    <input 
                      type="text"
                      className={styles.formInput}
                      value={p.baseUrl}
                      placeholder="https://api.openai.com/v1"
                      onChange={(e) => handleBaseUrlChange(p, e.target.value)}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>
                      {t('settings.ai.custom_models', '自定义模型')}
                      <span className={styles.labelHint}>(逗号分隔)</span>
                    </label>
                    <input 
                      type="text"
                      className={styles.formInput}
                      value={p.customModels.join(', ')}
                      placeholder="gpt-4o-mini, o1-preview"
                      onChange={(e) => handleCustomModelsChange(p, e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
