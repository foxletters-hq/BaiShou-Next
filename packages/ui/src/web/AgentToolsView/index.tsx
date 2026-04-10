import React, { useState } from 'react';
import styles from './AgentToolsView.module.css';
import { useTranslation } from 'react-i18next';
import { useDialog } from '../Dialog';
import {
  Puzzle,
  Book,
  Palette,
  Globe,
  BadgeCheck,
  Store,
  Rocket,
  BookOpen,
  PenSquare,
  Trash2,
  List,
  Search,
  FileText,
  MessageSquare,
  Database,
  DatabaseZap,
  ListOrdered,
  Minus,
  Plus
} from 'lucide-react';
import { Switch } from '../Switch/Switch';

export interface ToolManagementConfig {
  disabledToolIds: string[];
  customConfigs: Record<string, Record<string, any>>;
}

interface AgentToolsViewProps {
  config: ToolManagementConfig;
  onChange: (config: ToolManagementConfig) => void;
}

interface ToolConfigParam {
  key: string;
  label: string;
  type: 'integer' | 'boolean' | 'string' | 'select';
  defaultValue: any;
  min?: number;
  max?: number;
  icon?: string;
}

interface AgentToolDef {
  id: string;
  category: string;
  name: string;
  icon: React.ReactNode;
  configurableParams?: ToolConfigParam[];
}

export const AgentToolsView: React.FC<AgentToolsViewProps> = ({ config, onChange }) => {
  const { t } = useTranslation();
  const dialog = useDialog();
  
  const ALL_TOOLS: AgentToolDef[] = [
    { id: 'diary_read', category: 'diary', name: t('agent.tools.diary_read', '日记读取'), icon: <BookOpen size={20} /> },
    { id: 'diary_edit', category: 'diary', name: t('agent.tools.diary_edit', '日记编辑'), icon: <PenSquare size={20} /> },
    { id: 'diary_delete', category: 'diary', name: t('agent.tools.diary_delete', '日记删除'), icon: <Trash2 size={20} /> },
    { id: 'diary_list', category: 'diary', name: t('agent.tools.diary_list', '日记列表'), icon: <List size={20} /> },
    { 
      id: 'diary_search', category: 'diary', name: t('agent.tools.diary_search', '日记搜索'), icon: <Search size={20} />,
      configurableParams: [
        { key: 'max_results', label: t('agent.tools.param_max_results', '搜索结果上限'), type: 'integer', defaultValue: 10, min: 1, max: 50, icon: 'ListOrdered' }
      ]
    },
    { id: 'summary_read', category: 'summary', name: t('agent.tools.summary_read', '总结读取'), icon: <FileText size={20} /> },
    { id: 'message_search', category: 'memory', name: t('agent.tools.message_search', '消息搜索'), icon: <MessageSquare size={20} /> },
    { id: 'memory_store', category: 'memory', name: t('agent.tools.memory_store', '记忆存储'), icon: <Database size={20} /> },
    { id: 'memory_delete', category: 'memory', name: t('agent.tools.memory_delete', '记忆删除'), icon: <DatabaseZap size={20} /> },
  ];

  const CATEGORY_META: Record<string, { label: string; icon: React.ReactNode }> = {
    diary: { label: t('settings.agent_tools_category_diary', '日记工具'), icon: <Book size={18} /> },
    summary: { label: t('settings.agent_tools_category_summary', '总结工具'), icon: <FileText size={18} /> },
    memory: { label: t('settings.agent_tools_category_memory', '记忆工具'), icon: <Palette size={18} /> },
    search: { label: t('settings.agent_tools_category_search', '搜索工具'), icon: <Globe size={18} /> },
    general: { label: t('settings.agent_tools_category_general', '通用工具'), icon: <Puzzle size={18} /> },
  };

  const [showCommunity, setShowCommunity] = useState(false);

  const toggleTool = async (toolId: string) => {
    const disabledList = Array.isArray(config.disabledToolIds) ? [...config.disabledToolIds] : [];
    const isCurrentlyEnabled = !disabledList.includes(toolId);
    
    if (isCurrentlyEnabled) {
      disabledList.push(toolId);
    } else {
      const tool = ALL_TOOLS.find(t => t.id === toolId);
      // Removed tag check as tools no longer have tags, but left logic placeholder if needed in future
      const idx = disabledList.indexOf(toolId);
      if (idx > -1) disabledList.splice(idx, 1);
    }
    onChange({ ...config, disabledToolIds: disabledList });
  };

  const setToolParam = (toolId: string, key: string, value: any) => {
    const customConfigs = { ...(config.customConfigs || {}) };
    if (!customConfigs[toolId]) {
      customConfigs[toolId] = {};
    }
    customConfigs[toolId] = { ...customConfigs[toolId], [key]: value };
    onChange({ ...config, customConfigs });
  };

  const getToolParam = (toolId: string, param: ToolConfigParam) => {
    const customConfigs = config.customConfigs || {};
    if (customConfigs[toolId] && customConfigs[toolId][param.key] !== undefined) {
      return customConfigs[toolId][param.key];
    }
    return param.defaultValue;
  };

  const groupedTools = ALL_TOOLS.reduce((acc, tool) => {
    if (!acc[tool.category]) acc[tool.category] = [];
    acc[tool.category].push(tool);
    return acc;
  }, {} as Record<string, typeof ALL_TOOLS>);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Puzzle size={28} className={styles.headerIcon} />
        <h3 className={styles.title}>{t('settings.agent_tools_title', '工具管理')}</h3>
      </div>
      <p className={styles.subtitle}>{t('settings.agent_tools_desc', '管理伙伴可使用的工具，开关或配置工具参数')}</p>

      <div className={styles.tabSwitcherWrapper}>
        <div className={styles.tabSwitcher}>
           <div 
              className={`${styles.tabBtn} ${!showCommunity ? styles.tabActive : ''}`}
              onClick={() => setShowCommunity(false)}
           >
             <BadgeCheck size={16} />
             <span className={styles.tabText}>{t('agent.tools.built_in', '内置工具')}</span>
             <span className={styles.tabBadge}>{ALL_TOOLS.length}</span>
           </div>
           <div 
              className={`${styles.tabBtn} ${showCommunity ? styles.tabActive : ''}`}
              onClick={() => setShowCommunity(true)}
           >
             <Store size={16} />
             <span className={styles.tabText}>{t('agent.tools.community', '社区工具')}</span>
           </div>
        </div>
      </div>

      <div className={styles.contentArea}>
         {!showCommunity ? (
            <div className={styles.list}>
              {Object.keys(CATEGORY_META).map(catKey => {
                 const list = groupedTools[catKey];
                 if (!list || list.length === 0) return null;
                 const meta = CATEGORY_META[catKey];
                 return (
                   <div key={catKey} className={styles.categoryGroup}>
                      <div className={styles.categoryHeader}>
                        <span className={styles.categoryIcon}>{meta.icon}</span>
                        <span className={styles.categoryLabel}>{meta.label}</span>
                      </div>
                      <div className={styles.categoryList}>
                        {list.map((tool) => {
                            const isEnabled = !(config.disabledToolIds || []).includes(tool.id);
                            const hasParams = tool.configurableParams && tool.configurableParams.length > 0;
                            
                            return (
                               <div key={tool.id} className={`${styles.toolCard} ${isEnabled ? styles.enabled : styles.disabled}`}>
                                 <div className={styles.cardMain}>
                                   <div className={styles.toolIconWrapper}>
                                      <span className={styles.toolEmoji}>{tool.icon}</span>
                                   </div>
                                   <div className={styles.toolInfo}>
                                     <div className={styles.toolNameRow}>
                                       <span className={styles.toolName}>{tool.name}</span>
                                       <span className={styles.toolIdTag}>{tool.id}</span>
                                     </div>
                                   </div>
                                   <Switch checked={isEnabled} onChange={() => toggleTool(tool.id)} />
                                 </div>
                                 
                                 {hasParams && isEnabled && (
                                   <div className={styles.paramsWrapper}>
                                     <div className={styles.paramsDivider} />
                                     <div className={styles.paramsConfigArea}>
                                       {tool.configurableParams?.map((param, idx) => {
                                          const val = getToolParam(tool.id, param);
                                          
                                          if (param.type === 'integer') {
                                            return (
                                              <div key={param.key} className={styles.paramItem}>
                                                <div className={styles.paramLabelGroup}>
                                                  {param.icon === 'ListOrdered' && <ListOrdered size={16} className={styles.paramIcon} />}
                                                  <span className={styles.paramLabel}>{param.label}</span>
                                                </div>
                                                <div className={styles.stepperContainer}>
                                                  <button 
                                                    className={styles.stepperBtn}
                                                    disabled={val <= (param.min ?? 1)}
                                                    onClick={() => setToolParam(tool.id, param.key, val - 1)}
                                                  >
                                                    <Minus size={14} />
                                                  </button>
                                                  <input 
                                                    className={styles.stepperInput}
                                                    type="number"
                                                    value={val}
                                                    onChange={(e) => {
                                                      const parsed = parseInt(e.target.value);
                                                      if (!isNaN(parsed)) {
                                                        const clamped = Math.min(Math.max(parsed, param.min ?? 1), param.max ?? 50);
                                                        setToolParam(tool.id, param.key, clamped);
                                                      }
                                                    }}
                                                  />
                                                  <button 
                                                    className={styles.stepperBtn}
                                                    disabled={val >= (param.max ?? 50)}
                                                    onClick={() => setToolParam(tool.id, param.key, val + 1)}
                                                  >
                                                    <Plus size={14} />
                                                  </button>
                                                </div>
                                              </div>
                                            );
                                          }
                                          return null;
                                       })}
                                     </div>
                                   </div>
                                 )}
                               </div>
                            );
                        })}
                      </div>
                   </div>
                 );
              })}
            </div>
         ) : (
            <div className={styles.communityBlank}>
               <Rocket size={56} className={styles.communityIcon} />
               <h4 className={styles.communityTitle}>{t('agent.tools.community_market_coming', '插件集市即将上线')}</h4>
               <p className={styles.communityDesc}>{t('agent.tools.community_coming_soon', '不久后，您将能够在这里挂载由其他用户开发的生态能力接口。')}</p>
            </div>
         )}
      </div>
    </div>
  );
};
