import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './ModelSwitcherPopup.module.css';
import { useTranslation } from 'react-i18next';

import openaiIcon from '../../assets/ai_provider_icon/openai.png';
import geminiIcon from '../../assets/ai_provider_icon/gemini-color.png';
import claudeIcon from '../../assets/ai_provider_icon/claude-color.png';
import deepseekIcon from '../../assets/ai_provider_icon/deepseek-color.png';
import kimiIcon from '../../assets/ai_provider_icon/moonshot.png';
import ollamaIcon from '../../assets/ai_provider_icon/ollama.png';
import dashscopeIcon from '../../assets/ai_provider_icon/dashscope.png';
import siliconflowIcon from '../../assets/ai_provider_icon/silicon.png';
import openrouterIcon from '../../assets/ai_provider_icon/openrouter.png';
import doubaoIcon from '../../assets/ai_provider_icon/doubao.png';
import grokIcon from '../../assets/ai_provider_icon/grok.png';
import mistralIcon from '../../assets/ai_provider_icon/mistral.png';
import lmstudioIcon from '../../assets/ai_provider_icon/lmstudio.png';
import { MdCloud, MdCheck, MdSearch } from 'react-icons/md';

const ICON_MAP: Record<string, string> = {
  openai: openaiIcon,
  gemini: geminiIcon,
  anthropic: claudeIcon,
  deepseek: deepseekIcon,
  kimi: kimiIcon,
  ollama: ollamaIcon,
  siliconflow: siliconflowIcon,
  openrouter: openrouterIcon,
  dashscope: dashscopeIcon,
  doubao: doubaoIcon,
  grok: grokIcon,
  mistral: mistralIcon,
  lmstudio: lmstudioIcon,
};
export interface AiProviderModel {
  id: string;
  name: string;
  type: string;
  models: string[];
  enabledModels: string[];
}

interface ModelSwitcherPopupProps {
  providers: AiProviderModel[];
  currentProviderId?: string;
  currentModelId?: string;
  onSelect: (providerId: string, modelId: string) => void;
  onClose: () => void;
}

export const ModelSwitcherPopup: React.FC<ModelSwitcherPopupProps> = ({
  providers,
  currentProviderId,
  currentModelId,
  onSelect,
  onClose
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');

  // Filter providers and models
  const filteredData = (providers || []).map(provider => {
  const modelList = provider.enabledModels.length > 0 ? provider.enabledModels : provider.models;
    const matchedModels = searchQuery.trim() === '' 
      ? modelList 
      : modelList.filter(m => m.toLowerCase().includes(searchQuery.toLowerCase()));
      
    return { ...provider, matchedModels };
  }).filter(p => p.matchedModels.length > 0);

  const ProviderIcon = ({ id, type }: { id: string, type: string }) => {
    const iconSrc = ICON_MAP[id] || ICON_MAP[type];
    if (iconSrc) {
      return <img src={iconSrc} alt={id || type} className={styles.providerIconImage} style={{ width: 18, height: 18, objectFit: 'contain' }} />;
    }
    return <MdCloud className={styles.providerIconPlaceholder} style={{ width: 18, height: 18, color: 'var(--text-tertiary, #999)' }} />;
  };

  return createPortal(
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.dialog}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <h2>{t('models.switch_model', '切换计算模型')}</h2>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Search Bar */}
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}><MdSearch /></span>
          <input 
            type="text" 
            placeholder={t('common.search_model', '搜索模型...')} 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
            autoFocus
          />
        </div>

        {/* Lists */}
        <div className={styles.listContainer}>
          {filteredData.length === 0 ? (
            <div className={styles.emptyState}>{t('common.no_match_model', '没有匹配的可用模型')}</div>
          ) : (
            filteredData.map(provider => (
              <div key={provider.id} className={styles.providerGroup}>
                <div className={styles.providerHeader}>
                  <ProviderIcon id={provider.id} type={provider.type} />
                  <span className={styles.providerName}>{provider.name}</span>
                  <span className={styles.modelCountBadge}>{provider.matchedModels.length}</span>
                </div>
                <div className={styles.modelsGrid}>
                  {provider.matchedModels.map(modelId => {


                    const isSelected = provider.id === currentProviderId && modelId === currentModelId;
                    return (
                      <div 
                        key={modelId}
                        className={`${styles.modelItem} ${isSelected ? styles.selected : ''}`}
                        onClick={() => onSelect(provider.id, modelId)}
                      >
                         <ProviderIcon id={provider.id} type={provider.type} />
                         <span className={styles.modelIdText}>{modelId}</span>
                         {isSelected && <span className={styles.checkIcon}><MdCheck /></span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>,
    document.body
  );
};
