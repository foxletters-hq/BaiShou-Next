import React, { useState, useMemo } from 'react';
import styles from './ModelSwitcher.module.css';
import { MockAiProviderModel } from '@baishou/shared/src/mock/agent.mock';
import { useTranslation } from 'react-i18next';
import { ArrowLeftRight, Search, CheckCircle2, Cpu, Banknote, Settings, Blocks, Sparkles, PlusCircle } from 'lucide-react';

interface ModelSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
  providers: MockAiProviderModel[];
  currentProviderId?: string | null;
  currentModelId?: string | null;
  onSelect: (providerId: string, modelId: string) => void;
  onManageProviders?: () => void;
}

// 模拟的 ModelPricingService 字典 (仅用于 UI Presentation 填充感)
const MOCK_MODEL_PRICING: Record<string, { price: string, context: string }> = {
  'gpt-4o': { price: '$5.00/1M', context: '128K' },
  'gpt-4-turbo': { price: '$10.00/1M', context: '128K' },
  'gpt-3.5-turbo': { price: '$0.50/1M', context: '16K' },
  'claude-3-opus': { price: '$15.00/1M', context: '200K' },
  'claude-3-sonnet': { price: '$3.00/1M', context: '200K' },
  'claude-3-haiku': { price: '$0.25/1M', context: '200K' },
  'gemini-1.5-pro': { price: '$3.50/1M', context: '1M+' },
  'gemini-1.5-flash': { price: '$0.35/1M', context: '1M+' },
};

export const ModelSwitcher: React.FC<ModelSwitcherProps> = ({
  isOpen,
  onClose,
  providers,
  currentProviderId,
  currentModelId,
  onSelect,
  onManageProviders
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
               <span className={styles.titleIcon}><ArrowLeftRight size={20} strokeWidth={2.5}/></span>
               <span>{t('agent.switchModel', '切换心智核心')}</span>
            </div>
         </div>

         {/* Search Box */}
         <div className={styles.searchBox}>
           <div className={styles.searchInputWrapper}>
              <span className={styles.searchIcon}><Search size={16} /></span>
              <input 
                type="text"
                className={styles.searchInput}
                placeholder={t('common.search', '搜索模型 ...')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
           </div>
         </div>

         {/* List Container */}
         <div className={styles.listContainer}>
            {filteredProviders.length === 0 ? (
              <div className={styles.emptyState}>
                 <Sparkles size={32} opacity={0.3} />
                 <span>{t('agent.noMatchModel', '未发现可搭载的模型')}</span>
                 <button className={styles.manageBtn} onClick={onManageProviders} type="button">
                    <Settings size={14} /> {t('models.goto_settings', '配置供应商')}
                 </button>
              </div>
            ) : (
              filteredProviders.map(provider => {
                 const models = filteredModels[provider.id] || [];
                 const isCurrentProvider = provider.id === currentProviderId;

                 return (
                   <div key={provider.id} className={styles.providerGroup}>
                      <div className={styles.providerHeader}>
                         <div className={styles.providerIconPlaceholder}><Blocks size={14} /></div>
                         <span className={styles.providerName}>{provider.name}</span>
                         <span className={styles.modelCountBadge}>{models.length}</span>
                      </div>

                      <div className={styles.modelList}>
                         {models.map(modelId => {
                            const isSelected = isCurrentProvider && modelId === currentModelId;
                            const modelMeta = MOCK_MODEL_PRICING[modelId];
                            
                            return (
                               <div 
                                 key={modelId}
                                 className={`${styles.modelItem} ${isSelected ? styles.modelItemSelected : ''}`}
                                 onClick={() => {
                                    onSelect(provider.id, modelId);
                                    onClose();
                                 }}
                               >
                                  <div className={styles.modelItemIcon}><Cpu size={18} /></div>
                                  <div className={styles.modelItemCenter}>
                                     <span className={styles.modelItemName}>{modelId}</span>
                                     {modelMeta && (
                                       <div className={styles.modelPricingBar}>
                                          <span className={styles.modelBadge}>
                                            <Banknote size={10} /> {modelMeta.price}
                                          </span>
                                          <span className={`${styles.modelBadge} ${styles.modelBadgeHighlighted}`}>
                                            {modelMeta.context} ctx
                                          </span>
                                       </div>
                                     )}
                                  </div>
                                  {isSelected && <div className={styles.checkIcon}><CheckCircle2 size={18} strokeWidth={2.5}/></div>}
                               </div>
                            );
                         })}
                      </div>
                   </div>
                 );
              })
            )}
         </div>

         {/* Footer - Only show if not fully empty or if there is something to manage */}
         {onManageProviders && filteredProviders.length > 0 && (
           <div className={styles.manageFooter}>
              <button className={styles.manageBtn} onClick={() => { onManageProviders(); onClose(); }} type="button">
                 <Settings size={14} /> {t('agent.manageProviders', '管理模型与供应商')}
              </button>
           </div>
         )}
      </div>
    </div>
  );
};
