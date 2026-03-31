import React, { useState, useMemo } from 'react';
import styles from './ModelSwitcher.module.css';
import { MockAiProviderModel } from '@baishou/shared/src/mock/agent.mock';
import { useTranslation } from 'react-i18next';

interface ModelSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
  providers: MockAiProviderModel[];
  currentProviderId?: string | null;
  currentModelId?: string | null;
  onSelect: (providerId: string, modelId: string) => void;
}

export const ModelSwitcher: React.FC<ModelSwitcherProps> = ({
  isOpen,
  onClose,
  providers,
  currentProviderId,
  currentModelId,
  onSelect
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');

  const { filteredProviders, filteredModels } = useMemo(() => {
    const pList: MockAiProviderModel[] = [];
    const mDict: Record<string, string[]> = {};

    const query = searchQuery.toLowerCase();

    for (const provider of providers) {
      const modelList = provider.enabledModels.length > 0 ? provider.enabledModels : provider.models;
      const matched = query ? modelList.filter(m => m.toLowerCase().includes(query)) : modelList;

      if (matched.length > 0) {
        pList.push(provider);
        mDict[provider.id] = matched;
      }
    }

    return { filteredProviders: pList, filteredModels: mDict };
  }, [providers, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={e => e.stopPropagation()}>
          {/* Header */}
         <div className={styles.header}>
            <div className={styles.headerTitle}>
               <span className={styles.titleIcon}>⇄</span>
               <span>{t('agent.switchModel')}</span>
            </div>
         </div>

         {/* Search */}
         <div className={styles.searchBox}>
           <div className={styles.searchInputWrapper}>
              <span className={styles.searchIcon}>🔍</span>
              <input 
                type="text"
                className={styles.searchInput}
                placeholder="搜索模型..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
           </div>
         </div>

         {/* List */}
         <div className={styles.listContainer}>
            {filteredProviders.length === 0 ? (
              <div className={styles.emptyState}>{t('agent.noMatchModel')}</div>
            ) : (
              filteredProviders.map(provider => {
                 const models = filteredModels[provider.id] || [];
                 const isCurrentProvider = provider.id === currentProviderId;

                 return (
                   <div key={provider.id} className={styles.providerGroup}>
                      <div className={styles.providerHeader}>
                         <div className={styles.providerIconPlaceholder}>❖</div>
                         <span className={styles.providerName}>{provider.name}</span>
                         <span className={styles.modelCountBadge}>{models.length}</span>
                      </div>

                      <div className={styles.modelList}>
                         {models.map(modelId => {
                            const isSelected = isCurrentProvider && modelId === currentModelId;
                            
                            return (
                               <div 
                                 key={modelId}
                                 className={`${styles.modelItem} ${isSelected ? styles.modelItemSelected : ''}`}
                                 onClick={() => {
                                    onSelect(provider.id, modelId);
                                    onClose();
                                 }}
                               >
                                  <div className={styles.modelItemIcon}>❖</div>
                                  <span className={styles.modelItemName}>{modelId}</span>
                                  {isSelected && <span className={styles.checkIcon}>✅</span>}
                               </div>
                            );
                         })}
                      </div>
                   </div>
                 );
              })
            )}
         </div>
      </div>
    </div>
  );
};
