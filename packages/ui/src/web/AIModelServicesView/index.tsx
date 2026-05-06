import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis, restrictToWindowEdges } from '@dnd-kit/modifiers';
import styles from './AIModelServicesView.module.css';
import { useTranslation } from 'react-i18next';
import { useDialog } from '../Dialog';
import { useToast } from '../Toast/useToast';

import { getProviderIcon } from '../../utils/provider-icons';
import { useTheme } from '../../hooks';

import { 
  MdCloud, 
  MdVisibility, 
  MdVisibilityOff, 
  MdAdd, 
  MdDeleteOutline,
  MdApi,
  MdRestore,
  MdLink,
  MdVpnKey,
  MdViewList,
  MdSync,
  MdArrowDropDown,
  MdDragIndicator,
  MdClose
} from 'react-icons/md';
import { Switch } from '../Switch/Switch';

export interface AIProviderConfig {
  providerId: string;
  name?: string;
  type?: string;
  isSystem?: boolean;
  sortOrder?: number;
  enabled: boolean;
  apiKey: string;
  apiBaseUrl?: string;
  models?: string[];
  enabledModels?: string[];
  defaultDialogueModel?: string;
}

export interface AIModelServicesViewProps {
  providers: Record<string, AIProviderConfig>;
  onUpdateProvider: (providerId: string, updates: Partial<AIProviderConfig>) => void;
  onDeleteProvider?: (providerId: string) => void;
  onReorderProviders?: (orderedIds: string[]) => void;
  onTestConnection?: (providerId: string, tempKey?: string, tempUrl?: string, testModelId?: string) => Promise<void>;
  onFetchModels?: (providerId: string, tempKey?: string, tempUrl?: string) => Promise<string[]>;
}

// 核心自带类型的回退配置
const BASE_KNOWN_PROVIDERS_CONFIG = [
  { id: 'openai', name: 'OpenAI', defaultBase: 'https://api.openai.com/v1', isSystem: true },
  { id: 'gemini', name: 'Google Gemini', defaultBase: 'https://generativelanguage.googleapis.com/v1beta', isSystem: true },
  { id: 'anthropic', name: 'Anthropic Claude', defaultBase: 'https://api.anthropic.com', isSystem: true },
  { id: 'deepseek', name: 'DeepSeek', defaultBase: 'https://api.deepseek.com', isSystem: true },
  { id: 'kimi', name: 'Kimi (Moonshot)', defaultBase: 'https://api.moonshot.cn/v1', isSystem: true },
  { id: 'ollama', name: 'Ollama', defaultBase: 'http://localhost:11434/v1', isSystem: true },
  { id: 'siliconflow', name: '硅基流动 (SiliconFlow)', defaultBase: 'https://api.siliconflow.cn/v1', isSystem: true },
  { id: 'openrouter', name: 'OpenRouter', defaultBase: 'https://openrouter.ai/api/v1', isSystem: true },
  { id: 'dashscope', name: '通义千问 (百炼)', defaultBase: 'https://dashscope.aliyuncs.com/compatible-mode/v1', isSystem: true },
  { id: 'doubao', name: '豆包 (火山引擎)', defaultBase: 'https://ark.cn-beijing.volces.com/api/v3', isSystem: true },
  { id: 'grok', name: 'Grok (xAI)', defaultBase: 'https://api.x.ai/v1', isSystem: true },
  { id: 'mistral', name: 'Mistral', defaultBase: 'https://api.mistral.ai/v1', isSystem: true },
  { id: 'lmstudio', name: 'LM Studio', defaultBase: 'http://localhost:1234/v1', isSystem: true },
];

const PROVIDER_NAME_I18N_MAP: Record<string, string> = {
  'siliconflow': 'aiProviders.siliconflow',
  'dashscope': 'aiProviders.dashscope',
  'doubao': 'aiProviders.doubao',
};

const PROVIDER_TYPES = [
  'openai', 'anthropic', 'gemini', 'deepseek', 'kimi', 'ollama', 
  'siliconflow', 'openrouter', 'dashscope', 'doubao', 'grok', 'mistral', 'lmstudio'
];

export const AIModelServicesView: React.FC<AIModelServicesViewProps> = ({
  providers, 
  onUpdateProvider, 
  onDeleteProvider,
  onReorderProviders,
  onTestConnection, 
  onFetchModels 
}) => {
  const { t } = useTranslation();
  const dialog = useDialog();
  const toast = useToast();
  const { isDark } = useTheme();

  const BASE_KNOWN_PROVIDERS = BASE_KNOWN_PROVIDERS_CONFIG.map(p => ({
    ...p,
    name: PROVIDER_NAME_I18N_MAP[p.id] ? t(PROVIDER_NAME_I18N_MAP[p.id], p.name) : p.name,
    iconUrl: getProviderIcon(p.id, isDark),
  }));

  const getCombinedProviders = Object.keys(providers).filter(id => !BASE_KNOWN_PROVIDERS.find(b => b.id === id));
  
  const allProvidersList = [
    ...BASE_KNOWN_PROVIDERS,
    ...getCombinedProviders.map(id => ({
      id,
      name: providers[id]?.name || id.toUpperCase(),
      iconUrl: getProviderIcon(id, isDark),
      defaultBase: providers[id]?.apiBaseUrl || '',
      isSystem: false,
      sortOrder: providers[id]?.sortOrder ?? 999
    }))
  ];

  const sortedProvidersList = [...allProvidersList].map(p => ({
    ...p,
    sortOrder: providers[p.id]?.sortOrder ?? (p as any).sortOrder ?? 999,
    enabled: providers[p.id]?.enabled ?? false,
  })).sort((a, b) => {
    // 已启用的排在前面，未启用的排在后面
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
    return a.sortOrder - b.sortOrder;
  });

  const firstProviderId = sortedProvidersList[0]?.id;
  const [selectedProviderId, setSelectedProviderId] = useState<string>(firstProviderId || '');
  
  const [localFormData, setLocalFormData] = useState<{ baseUrl: string, apiKey: string }>({
    baseUrl: '',
    apiKey: ''
  });

  const [isObscure, setIsObscure] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [isFetchingModels, setIsFetchingModels] = useState(false);

  const [localProvidersList, setLocalProvidersList] = useState(sortedProvidersList);
  useEffect(() => {
    setLocalProvidersList(sortedProvidersList);
  }, [providers]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const handleDragStart = (event: any) => {
    console.log('[Drag Tracking] dnd-kit DragStart:', event.active.id);
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: any) => {
    setActiveDragId(null);
    const { active, over } = event;
    console.log('[Drag Tracking] dnd-kit DragEnd result:', event);
    if (over && active.id !== over.id) {
       const oldIndex = localProvidersList.findIndex(p => p.id === active.id);
       const newIndex = localProvidersList.findIndex(p => p.id === over.id);
       const updatedList = arrayMove(localProvidersList, oldIndex, newIndex);
       setLocalProvidersList(updatedList);
       
       if (onReorderProviders) {
         console.log(`[Drag Tracking] dnd-kit invoking onReorderProviders with current ordered IDs`);
         onReorderProviders(updatedList.map(x => x.id));
       }
    }
  };

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const [addModalData, setAddModalData] = useState({ name: '', type: 'openai', baseUrl: '' });

  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testModelId, setTestModelId] = useState('');
  const [testModelOptions, setTestModelOptions] = useState<string[]>([]);
  const [isTestModelDropdownOpen, setIsTestModelDropdownOpen] = useState(false);

  const activeProviderMeta = allProvidersList.find(p => p.id === selectedProviderId) || allProvidersList[0];
  const activeConfig = providers[selectedProviderId] || { providerId: selectedProviderId, enabled: false, apiKey: '', apiBaseUrl: '' };

  const [delayedEnabledModels, setDelayedEnabledModels] = useState<string[]>(activeConfig.enabledModels || []);

  useEffect(() => {
    // 立即在一开始同步，但如果是用户点击引发的变化，则延迟 350ms 排序，让打钩动画飞一会
    const t = setTimeout(() => {
      setDelayedEnabledModels(activeConfig.enabledModels || []);
    }, 350);
    return () => clearTimeout(t);
  }, [activeConfig.enabledModels, selectedProviderId]);

  useEffect(() => {
    if (selectedProviderId) {
      populateControllers(selectedProviderId);
    }
  }, [selectedProviderId, providers]);

  const populateControllers = (pid: string) => {
    const config: Partial<AIProviderConfig> = providers[pid] || {};
    setLocalFormData({
      baseUrl: config.apiBaseUrl || '',
      apiKey: config.apiKey || ''
    });
  };

  if (!activeProviderMeta) return null;

  const handleProviderTap = (id: string) => {
    if (selectedProviderId !== id) {
       setSelectedProviderId(id);
    }
  };

  const handleSaveCurrentProviderConfig = () => {
    onUpdateProvider(selectedProviderId, {
      apiBaseUrl: localFormData.baseUrl,
      apiKey: localFormData.apiKey
    });
    toast.showSuccess(t('ai_config.save_success', '$id 配置已保存', { id: selectedProviderId }));
  };

  const handleResetCurrentProvider = () => {
    setLocalFormData({
      baseUrl: activeProviderMeta.defaultBase,
      apiKey: ''
    });
    toast.showSuccess(t('ai_config.reset_success', '已恢复默认地址并清空 API Key，请点击保存'));
  };

  const handleBaseUrlBlur = () => {
    let url = localFormData.baseUrl;
    if (url && url.includes('generativelanguage.googleapis.com') && !url.includes('v1')) {
      url = url.replace(/\/+$/, '') + '/v1beta';
    }
    if (url !== localFormData.baseUrl) {
      setLocalFormData(prev => ({ ...prev, baseUrl: url }));
    }
  };

  const handleTestConnection = async () => {
    console.log('[TestConnection] handleTestConnection clicked', { onTestConnection: !!onTestConnection, apiKey: !!localFormData.apiKey });
    if (!onTestConnection) return;
    if (!localFormData.apiKey) {
      toast.showError(t('ai_config.fill_api_key_hint', '请先填写 API Key 并保存'));
      return;
    }

    const available = activeConfig.enabledModels?.length ? activeConfig.enabledModels : activeConfig.models;
    console.log('[TestConnection] available models:', available);
    if (!available || available.length === 0) {
      toast.showError(t('ai_config.no_models_fetch_first', '没有可用的模型，请先获取模型列表或确保有默认模型'));
      // 仍然允许用户手动输入
    }
    
    setTestModelOptions(available || []);
    setTestModelId(activeConfig.defaultDialogueModel || available?.[0] || '');
    console.log('[TestConnection] opening modal with default:', activeConfig.defaultDialogueModel || available?.[0] || '');
    setIsTestModalOpen(true);
  };

  const confirmTestConnection = async () => {
    if (!testModelId.trim()) {
      toast.showError(t('ai_config.test_model_empty', '测试模型 ID 不能为空'));
      return;
    }
    setIsTestModalOpen(false);

    onUpdateProvider(selectedProviderId, {
      apiBaseUrl: localFormData.baseUrl,
      apiKey: localFormData.apiKey
    });

    setIsTesting(true);
    try {
      await onTestConnection(selectedProviderId, localFormData.apiKey, localFormData.baseUrl, testModelId.trim());
      toast.showSuccess(t('ai_config.test_connection_success', '连接测试成功！🎉'));
    } catch (e: any) {
      toast.showError(t('ai_config.test_connection_failed', '连接失败: {{e}}', { e: e.message || 'Unknown error' }));
    } finally {
      setIsTesting(false);
    }
  };

  const handleFetchModels = async () => {
    if (!onFetchModels) return;
    if (!localFormData.apiKey) {
      toast.showError(t('ai_config.fill_api_key_hint', '请先填写 API Key 并保存'));
      return;
    }

    onUpdateProvider(selectedProviderId, {
      apiBaseUrl: localFormData.baseUrl,
      apiKey: localFormData.apiKey
    });

    setIsFetchingModels(true);
    try {
       const RemoteModels = await onFetchModels(selectedProviderId, localFormData.apiKey, localFormData.baseUrl);
       const oldEnabled = new Set(activeConfig.enabledModels || []);
       const newEnabled = RemoteModels.filter(rm => oldEnabled.has(rm));

       onUpdateProvider(selectedProviderId, { 
          models: RemoteModels, 
          enabledModels: newEnabled 
       });
       toast.showSuccess(t('ai_config.fetch_models_success', '成功获取并保存模型列表'));
    } catch (e: any) {
       toast.showError(t('ai_config.fetch_models_failed', '获取模型失败: {{e}}', { e: e.message || 'Unknown error' }));
    } finally {
       setIsFetchingModels(false);
    }
  };

  const handleDeleteProvider = async () => {
     const confirmStr = t('agent.provider.delete_confirm', `确定要删除"${activeProviderMeta.name}"吗？`)
       .replace('$name', activeProviderMeta.name)
       .replace('{{name}}', activeProviderMeta.name);
     const res = await dialog.confirm(confirmStr);
     if (res) {
       if (onDeleteProvider) onDeleteProvider(selectedProviderId);
       setSelectedProviderId(firstProviderId || '');
     }
  };

  const handleAddCustomProvider = () => {
    setAddModalData({ name: '', type: 'openai', baseUrl: '' });
    setIsTypeDropdownOpen(false);
    setIsAddModalOpen(true);
  };

  const submitAddCustomProvider = () => {
    if (!addModalData.name.trim()) return;
    const pid = 'custom_' + Date.now();
    onUpdateProvider(pid, { 
      name: addModalData.name.trim(), 
      type: addModalData.type,
      apiBaseUrl: addModalData.baseUrl.trim(),
      isSystem: false, 
      enabled: true, 
      apiKey: '' 
    });
    setIsAddModalOpen(false);
    setSelectedProviderId(pid);
  };

  const handleToggleEnable = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isEnabled = e.target.checked;
    if (isEnabled) {
      // 启用时，将排序设为已启用列表末尾（最大 sortOrder + 1）
      const enabledOrders = localProvidersList
        .filter(p => providers[p.id]?.enabled)
        .map(p => providers[p.id]?.sortOrder ?? 999);
      const nextOrder = enabledOrders.length > 0 ? Math.max(...enabledOrders) + 1 : 0;
      onUpdateProvider(selectedProviderId, { enabled: true, sortOrder: nextOrder });
    } else {
      onUpdateProvider(selectedProviderId, { enabled: false });
    }
  };

  const handleModelToggle = (mdl: string, isChecked: boolean) => {
    const activeList = [...(activeConfig.enabledModels || [])];
    if (isChecked) {
      if (!activeList.includes(mdl)) activeList.push(mdl);
    } else {
      const idx = activeList.indexOf(mdl);
      if (idx !== -1) activeList.splice(idx, 1);
    }
    onUpdateProvider(selectedProviderId, { enabledModels: activeList });
  };

  const renderIcon = (iconUrl?: string) => {
    return iconUrl ? <img src={iconUrl} alt="icon" className={styles.providerIconImage} /> : <MdCloud className={styles.providerIconFallback} />;
  };

  const renderTypeIcon = (typeId: string) => {
    const meta = BASE_KNOWN_PROVIDERS.find(p => p.id === typeId);
    return meta?.iconUrl ? <img src={meta.iconUrl} className={styles.modalTypeIcon} alt="" /> : <MdCloud className={styles.modalTypeFallback} />;
  };

  return (
    <div className={styles.container}>
      {/* Left Pane: Provider List */}
      <div className={styles.leftPane}>
        <div className={styles.listHeader}>
          {t('ai_config.providers_label', '服务提供商')}
        </div>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}
        >
          <div className={styles.listScroll}>
            <SortableContext 
              items={localProvidersList.map(p => p.id)}
              strategy={verticalListSortingStrategy}
            >
              {localProvidersList.map(p => {
                const isActive = selectedProviderId === p.id;
                const provConfig = providers[p.id];
                const isEnabled = provConfig ? provConfig.enabled : false;

                return (
                  <ProviderSortableItem 
                    key={p.id}
                    p={p}
                    isActive={isActive}
                    isEnabled={isEnabled}
                    onClick={() => setSelectedProviderId(p.id)}
                    renderIcon={renderIcon}
                    t={t}
                  />
                );
              })}
            </SortableContext>
          </div>

          {createPortal(
            <DragOverlay 
              dropAnimation={{
                sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } })
              }}
            >
              {activeDragId ? (
                (() => {
                  const p = localProvidersList.find(x => x.id === activeDragId);
                  if (!p) return null;
                  const isActive = selectedProviderId === p.id;
                  const provConfig = providers[p.id];
                  const isEnabled = provConfig ? provConfig.enabled : false;
                  return (
                    <ProviderStaticItem 
                      p={p} 
                      isActive={isActive} 
                      isEnabled={isEnabled} 
                      renderIcon={renderIcon} 
                      t={t} 
                    />
                  );
                })()
              ) : null}
            </DragOverlay>,
            document.body
          )}
        </DndContext>
        <div className={styles.listFooter}>
          <button className={styles.addButton} onClick={handleAddCustomProvider}>
            <MdAdd size={18} />
            <span>{t('agent.provider.add_button', '添加')}</span>
          </button>
        </div>
      </div>

      {/* Right Pane: Configuration Form */}
      <div className={styles.rightPane}>
        <div className={styles.rightContentMask}>
           <div className={styles.rightContentScroll}>
             {/* Header */}
             <div className={styles.configHeader}>
                <div className={styles.headerLeft}>
                   <div className={styles.hugeIconBox}>
                      {renderIcon(activeProviderMeta.iconUrl)}
                   </div>
                   <div className={styles.headerTextCol}>
                      <h2 className={styles.headerTitle}>{activeProviderMeta.name}</h2>
                      <p className={styles.headerSub}>{t('ai_config.manage_services_desc', '配置并管理大语言模型服务')}</p>
                   </div>
                </div>
                <div className={styles.headerActions}>
                   <Switch 
                     checked={activeConfig.enabled}
                     onChange={handleToggleEnable}
                   />
                   {!activeProviderMeta.isSystem && (
                      <button className={styles.deleteButton} onClick={handleDeleteProvider} title={t('agent.provider.delete_tooltip', '删除供应商')}>
                         <MdDeleteOutline size={22} />
                      </button>
                   )}
                </div>
             </div>

             {/* ProviderConfigForm Box */}
             <div className={styles.formCard}>
                <div className={styles.formHeaderRow}>
                   <div className={styles.formHeaderTitle}>
                      <div className={styles.apiIconBox}>
                         <MdApi className={styles.apiIcon} />
                      </div>
                      <span>{t('settings.api_config', 'API 配置')}</span>
                   </div>
                   <button className={styles.resetBtnInline} onClick={handleResetCurrentProvider}>
                      <MdRestore size={16} />
                      <span>{t('settings.reset_default', '恢复默认')}</span>
                   </button>
                </div>

                <div className={styles.inputGroup}>
                   <div className={styles.inputContainer}>
                     <MdLink className={styles.inputPrefixIcon} />
                     <input 
                        type="text"
                        value={localFormData.baseUrl}
                        onChange={e => setLocalFormData({...localFormData, baseUrl: e.target.value})}
                        onBlur={handleBaseUrlBlur}
                        placeholder={activeProviderMeta.defaultBase || "API Base URL"}
                        className={styles.textFieldWithIcon}
                     />
                   </div>
                </div>

                <div className={styles.inputGroup}>
                   <div className={styles.inputContainer}>
                     <MdVpnKey className={styles.inputPrefixIcon} />
                     <input 
                        type={isObscure ? 'password' : 'text'}
                        value={localFormData.apiKey}
                        onChange={e => setLocalFormData({...localFormData, apiKey: e.target.value})}
                        placeholder={t('ai_config.api_key_placeholder', 'API Key')}
                        className={styles.textFieldWithIcon}
                     />
                     <button className={styles.revealButton} onClick={() => setIsObscure(!isObscure)}>
                        {isObscure ? <MdVisibilityOff size={18} /> : <MdVisibility size={18} />}
                     </button>
                   </div>
                </div>

                <button className={styles.testBtnBlock} onClick={handleTestConnection} disabled={isTesting}>
                   {isTesting && (
                      <span className={styles.loadingSpinner}></span>
                   )}
                   <span>{isTesting ? t('settings.testing_connection', '正在测试连接...') : t('settings.test_connection', '测试连接')}</span>
                </button>
             </div>

             {/* ProviderModelList Section */}
             <div className={styles.modelListSection}>
                <div className={styles.modelListHeader}>
                   <div className={styles.modelListTitleBox}>
                      <MdViewList size={20} className={styles.modelListTitleIcon} />
                      <span className={styles.modelListTitle}>
                         {t('settings.model_list_count', '模型列表 ($enabled / $total)')
                            .replace('$enabled', String(activeConfig.enabledModels?.length || 0))
                            .replace('$total', String(activeConfig.models?.length || 0))}
                      </span>
                   </div>
                   <button className={styles.fetchBtnLine} onClick={handleFetchModels} disabled={isFetchingModels}>
                      {isFetchingModels ? <span className={styles.loadingSpinnerSmall}></span> : <MdSync size={16} />}
                      {t('settings.fetch_models', '获取模型')}
                   </button>
                </div>
                
                {activeConfig.models && activeConfig.models.length > 0 ? (
                   <div className={styles.modelsCard}>
                      {(() => {
                        const sortingSet = new Set(delayedEnabledModels);
                        const enabledModels = activeConfig.models!.filter(m => sortingSet.has(m));
                        const disabledModels = activeConfig.models!.filter(m => !sortingSet.has(m));
                        const sortedModels = [...enabledModels, ...disabledModels];
                        
                        const actualEnabledSet = new Set(activeConfig.enabledModels || []);

                        return sortedModels.map((mdl, idx) => {
                           const isChecked = actualEnabledSet.has(mdl);
                           const isLast = idx === (sortedModels.length - 1);
                           return (
                             <div key={mdl} className={`${styles.modelLineItem} ${!isLast ? styles.modelLineItemDivider : ''}`}>
                               <div className={styles.modelLineItemLeft}>
                                 {renderIcon(activeProviderMeta.iconUrl)}
                                 <span className={`${styles.modelNameText} ${isChecked ? styles.modelNameChecked : ''}`}>
                                   {mdl}
                                 </span>
                               </div>
                               <Switch 
                                 checked={isChecked}
                                 onChange={e => handleModelToggle(mdl, e.target.checked)}
                               />
                             </div>
                           );
                        });
                      })()}
                   </div>
                ) : (
                   <div className={styles.emptyModelsCard}>
                      <MdViewList size={32} className={styles.emptyModelsIcon} />
                      <span>{t('settings.no_models_hint', '暂无模型，点击右上角按钮获取')}</span>
                   </div>
                )}
             </div>
           </div>
        </div>

        {/* Floating Bottom Bar for Saving */}
        <div className={styles.bottomBarArea}>
           <div className={styles.bottomBarContainer}>
               <button className={styles.saveBtn} onClick={handleSaveCurrentProviderConfig}>
                  <span>{t('ai_config.save_changes_button', '保存修改')}</span>
               </button>
           </div>
        </div>
      </div>

      {isAddModalOpen && typeof document !== 'undefined' && createPortal(
        <div className={styles.addModalOverlay}>
          <div className={styles.addModalContent}>
            <div className={styles.addModalHeader}>{t('agent.provider.add_title', '新增 AI 供应商')}</div>
            <div className={styles.addModalBody}>
              <div className={styles.typeFieldContainer}>
                <span className={styles.typeLabel}>{t('agent.provider.add_type_label', '供应商类型 (Client)')}</span>
                <div className={styles.customSelectOuter}>
                  <div className={`${styles.customSelectValue} ${isTypeDropdownOpen ? styles.customSelectValueOpen : ''}`} onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}>
                    {renderTypeIcon(addModalData.type)}
                    <span style={{flex: 1}}>{addModalData.type === 'openai' ? t('provider.openai_spec', 'OpenAI 规范') : addModalData.type.toUpperCase()}</span>
                    <MdArrowDropDown size={20} className={`${styles.dropdownArrow} ${isTypeDropdownOpen ? styles.dropdownArrowOpen : ''}`} />
                  </div>
                  {isTypeDropdownOpen && (
                    <div className={styles.customSelectMenu}>
                      {PROVIDER_TYPES.map(type => (
                        <div 
                          key={type} 
                          className={styles.customSelectMenuItem} 
                          onClick={() => {
                            setAddModalData({...addModalData, type});
                            setIsTypeDropdownOpen(false);
                          }}
                        >
                          {renderTypeIcon(type)}
                          <span>{type === 'openai' ? t('provider.openai_spec', 'OpenAI 规范') : type.toUpperCase()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className={styles.materialField}>
                <span className={styles.materialLabel}>{t('agent.provider.add_name_label', '供应商名称')}</span>
                <input 
                  type="text" 
                  className={styles.addModalInput}
                  placeholder={t('agent.provider.add_name_hint', '例如: My OpenAI Proxy')}
                  value={addModalData.name}
                  onChange={e => setAddModalData({...addModalData, name: e.target.value})}
                />
              </div>
              <div className={styles.materialField}>
                <span className={styles.materialLabel}>Base URL</span>
                <input 
                  type="text" 
                  className={styles.addModalInput}
                  placeholder="https://api.example.com/v1"
                  value={addModalData.baseUrl}
                  onChange={e => setAddModalData({...addModalData, baseUrl: e.target.value})}
                />
              </div>
            </div>
            <div className={styles.addModalFooter}>
              <button className={styles.addModalCancel} onClick={() => setIsAddModalOpen(false)}>
                {t('common.cancel', '取消')}
              </button>
              <button className={styles.addModalConfirm} onClick={submitAddCustomProvider}>
                {t('agent.provider.add_button', '添加')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {isTestModalOpen && typeof document !== 'undefined' && createPortal(
        <div className={styles.addModalOverlay}>
          <div className={styles.addModalContent}>
            <div className={styles.addModalHeader}>
              <h3>{t('ai_config.test_connection_title', '选择测试模型')}</h3>
              <button className={styles.closeBtn} onClick={() => setIsTestModalOpen(false)}>
                <MdClose size={20} />
              </button>
            </div>
            
            <div className={styles.addModalBody}>
              <p style={{ color: 'var(--color-text-secondary)', marginBottom: 15, fontSize: 13, userSelect: 'none' }}>
                {t('ai_config.test_connection_desc', '请选择要用来测试连接的模型。建议使用该供应商提供的体积小、速度快的免费模型进行测试。')}
              </p>
              <div className={styles.materialField}>
                <span className={styles.materialLabel}>{t('ai_config.model_id', 'Model ID')}</span>
                <div 
                  style={{ position: 'relative' }} 
                  className={styles.customSelectOuter}
                  tabIndex={-1}
                  onBlur={(e) => {
                     // Check if new focus is inside the menu
                     if (!e.currentTarget.contains(e.relatedTarget)) {
                        setIsTestModelDropdownOpen(false);
                     }
                  }}
                >
                  <input 
                    type="text" 
                    className={styles.addModalInput}
                    placeholder={t('aiConfig.selectTestModel', '请选择测试模型')}
                    value={testModelId}
                    readOnly
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => setIsTestModelDropdownOpen(true)}
                    onFocus={() => setIsTestModelDropdownOpen(true)}
                  />
                  <MdArrowDropDown 
                    size={20} 
                    style={{ position: 'absolute', right: 12, top: 12, color: 'var(--color-text-secondary)', pointerEvents: 'none' }} 
                  />
                  {isTestModelDropdownOpen && testModelOptions.length > 0 && (
                    <div className={styles.customSelectMenu} style={{ maxHeight: 200, overflowY: 'auto' }}>
                      {testModelOptions.map(m => (
                        <div 
                          key={m}
                          className={styles.customSelectMenuItem}
                          onClick={() => {
                            setTestModelId(m);
                            setIsTestModelDropdownOpen(false);
                          }}
                        >
                          {m}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className={styles.addModalFooter}>
              <button className={styles.addModalCancel} onClick={() => setIsTestModalOpen(false)}>
                {t('common.cancel', '取消')}
              </button>
              <button className={styles.addModalConfirm} onClick={confirmTestConnection}>
                {t('ai_config.start_test', '开始测试')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

const ProviderStaticItem: React.FC<any> = ({ p, isActive, isEnabled, renderIcon, t }) => (
    <div className={`${styles.listItem} ${isActive ? styles.listItemSelected : ''} ${styles.providerItemDragging}`}>
      <div className={styles.dragHandle}>
        <MdDragIndicator size={18} />
      </div>
      <div className={styles.listIconBox}>
        {renderIcon(p.iconUrl)}
      </div>
      <div className={styles.listNameCol}>
        <div className={styles.listNameVal}>{p.name}</div>
      </div>
      
      <div className={styles.tagsArea}>
        {!p.isSystem && (
          <div className={styles.customBadge}>{t('agent.provider.custom_tag', '自定义')}</div>
        )}
        <div className={`${styles.statusBadge} ${isEnabled ? styles.statusOn : styles.statusOff}`}>
          {isEnabled ? t('settings.status_on', 'ON') : t('settings.status_off', 'OFF')}
        </div>
      </div>
    </div>
);

const ProviderSortableItem: React.FC<any> = ({ p, isActive, isEnabled, onClick, renderIcon, t }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: p.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={`${styles.listItem} ${isActive ? styles.listItemSelected : ''}`}
      onClick={onClick}
    >
      <div 
        {...attributes}
        {...listeners}
        className={styles.dragHandle} 
        style={{ cursor: 'grab', touchAction: 'none' }}
      >
        <MdDragIndicator size={18} />
      </div>
      <div className={styles.listIconBox}>
        {renderIcon(p.iconUrl)}
      </div>
      <div className={styles.listNameCol}>
        <div className={styles.listNameVal}>{p.name}</div>
      </div>
      
      <div className={styles.tagsArea}>
        {!p.isSystem && (
          <div className={styles.customBadge}>{t('agent.provider.custom_tag', '自定义')}</div>
        )}
        <div className={`${styles.statusBadge} ${isEnabled ? styles.statusOn : styles.statusOff}`}>
          {isEnabled ? t('settings.status_on', 'ON') : t('settings.status_off', 'OFF')}
        </div>
      </div>
    </div>
  );
};
