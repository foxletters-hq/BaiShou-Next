import React, { useState } from 'react';
import styles from './ModelSwitcherPopup.module.css';

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
  const [searchQuery, setSearchQuery] = useState('');

  // Filter providers and models
  const filteredData = providers.map(provider => {
    const modelList = provider.enabledModels.length > 0 ? provider.enabledModels : provider.models;
    const matchedModels = searchQuery.trim() === '' 
      ? modelList 
      : modelList.filter(m => m.toLowerCase().includes(searchQuery.toLowerCase()));
      
    return { ...provider, matchedModels };
  }).filter(p => p.matchedModels.length > 0);

  const ProviderIcon = ({ type }: { type: string }) => {
    // Determine icon based on type mimicking Flutter getProviderIcon logic
    return <span className={styles.providerIcon}>⚙️</span>; 
  };

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.dialog}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <span className={styles.headerIcon}>🔃</span>
            <h2>切换模型</h2>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Search Bar */}
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>🔍</span>
          <input 
            type="text" 
            placeholder="搜索模型..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
            autoFocus
          />
        </div>

        {/* Lists */}
        <div className={styles.listContainer}>
          {filteredData.length === 0 ? (
            <div className={styles.emptyState}>没有匹配的模型</div>
          ) : (
            filteredData.map(provider => (
              <div key={provider.id} className={styles.providerGroup}>
                <div className={styles.providerHeader}>
                  <ProviderIcon type={provider.type} />
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
                         <ProviderIcon type={provider.type} />
                         <span className={styles.modelIdText}>{modelId}</span>
                         {isSelected && <span className={styles.checkIcon}>✅</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};
