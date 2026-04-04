import React, { useState } from 'react';
import styles from './AgentToolsView.module.css';
import { useTranslation } from 'react-i18next';
import { useDialog } from '../Dialog';

export interface ToolManagementConfig {
  disabledToolIds: string[];
  customConfigs: Record<string, Record<string, any>>;
}

interface AgentToolsViewProps {
  config: ToolManagementConfig;
  onChange: (config: ToolManagementConfig) => void;
}

export const AgentToolsView: React.FC<AgentToolsViewProps> = ({ config, onChange }) => {
  const { t } = useTranslation();
  const dialog = useDialog();
  const ALL_TOOLS = [
    { id: 'web_search', category: 'search', name: t('tools.web_search', '网络搜索'), icon: '🕷', desc: '准许 AI 隐秘访问实时网络。', tag: '安全' },
    { id: 'diary_parser', category: 'diary', name: t('tools.diary_parser', '日记解析检索'), icon: '📖', desc: '准许白守在过去发生的日子中穿梭并比对事态', tag: '安全' },
    { id: 'memory_synapse', category: 'memory', name: t('tools.memory_synapse', '向量记忆检索'), icon: '🧠', desc: '通过 RAG 数据库进行全盘模糊关联检索。', tag: '安全' },
    { id: 'calculator', category: 'general', name: t('tools.calculator', '沙盒运算与代码'), icon: '🧮', desc: '绝对精确的推演运算，避免大模型幻觉。', tag: '安全' },
    { id: 'code_interpreter', category: 'general', name: t('tools.code_interpreter', '图表与独立代码执行'), icon: '💻', desc: '执行分析或图表绘制 (Python/JS)。', tag: '风险' },
    { id: 'local_file_read', category: 'memory', name: t('tools.local_file_read', '本地文件读取'), icon: '📂', desc: '极度越权！准许只读访问本地磁盘文档及画像。', tag: '高危' },
    { id: 'system_commander', category: 'general', name: t('tools.system_commander', '系统命令行执行'), icon: '⚡', desc: '可直接操控您的操作系统的终极特权。', tag: '极端高危' },
  ];

  const CATEGORY_META: Record<string, { label: string; icon: string }> = {
    diary: { label: t('tools.cat_diary', '日记分析 (Diary)'), icon: '📚' },
    memory: { label: t('tools.cat_memory', '记忆库与RAG (Memory & RAG)'), icon: '🌊' },
    search: { label: t('tools.cat_search', '外部搜索 (Search)'), icon: '📡' },
    general: { label: t('tools.cat_general', '辅助执行 (General)'), icon: '🔧' },
  };

  const [activeTab, setActiveTab] = useState<'builtin' | 'community'>('builtin');

  const toggleTool = async (toolId: string) => {
    // Determine enabled state based on absence in disabledToolIds array
    const disabledList = Array.isArray(config.disabledToolIds) ? [...config.disabledToolIds] : [];
    const isCurrentlyEnabled = !disabledList.includes(toolId);
    
    if (isCurrentlyEnabled) {
      // User wants to disable it
      disabledList.push(toolId);
    } else {
      // User wants to enable it
      const tool = ALL_TOOLS.find(t => t.id === toolId);
      if (tool && tool.tag.includes('危')) {
        const sure = await dialog.confirm(`【严重越权告警】\n您正在赋予 AI 具有操作系统破坏性乃至隐私外泄风险的 ${tool.name}。\n\n您确定要向硅基生命敞开物理主机的防线吗？`);
        if (!sure) return;
      }
      const idx = disabledList.indexOf(toolId);
      if (idx > -1) disabledList.splice(idx, 1);
    }
    onChange({ ...config, disabledToolIds: disabledList });
  };

  const groupedTools = ALL_TOOLS.reduce((acc, tool) => {
    if (!acc[tool.category]) acc[tool.category] = [];
    acc[tool.category].push(tool);
    return acc;
  }, {} as Record<string, typeof ALL_TOOLS>);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleInfo}>
          <h3 className={styles.title}>{t('tools.ecosystem_title', '能力生态配置 (Tools Ecosystem)')}</h3>
          <p className={styles.subtitle}>{t('tools.ecosystem_desc', '为 AI 助手挂载额外插件能力，带有危险标记的插件拥有越权系统操作特征。')}</p>
        </div>
      </div>

      <div className={styles.tabSwitcher}>
         <div 
            className={`${styles.tabBtn} ${activeTab === 'builtin' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('builtin')}
         >
           🔒 {t('tools.core_engine', '核心内置引擎')} ({ALL_TOOLS.length})
         </div>
         <div 
            className={`${styles.tabBtn} ${activeTab === 'community' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('community')}
         >
           🌐 {t('tools.community_market', '插件集市')}
         </div>
      </div>

      <div className={styles.contentArea}>
         {activeTab === 'builtin' ? (
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
                      <div className={styles.categoryGrid}>
                        {list.map((tool) => {
                            const isEnabled = !(config.disabledToolIds || []).includes(tool.id);
                            const isDanger = tool.tag.includes('危');
                            return (
                              <div key={tool.id} className={`${styles.toolItem} ${isEnabled ? styles.enabled : ''} ${isEnabled && isDanger ? styles.dangerEnabled : ''}`}>
                                <div className={styles.toolIcon}>{tool.icon}</div>
                                <div className={styles.toolInfo}>
                                  <div className={styles.toolNameRow}>
                                    <span className={styles.toolName}>{tool.name}</span>
                                    <span className={`${styles.toolTag} ${isDanger ? styles.tagDanger : styles.tagSafe}`}>
                                      {tool.tag}
                                    </span>
                                  </div>
                                  <div className={styles.toolDesc}>{tool.desc}</div>
                                </div>
                                <button 
                                  className={`${styles.toggleBtn} ${isEnabled ? styles.on : styles.off}`}
                                  onClick={() => toggleTool(tool.id)}
                                >
                                  {isEnabled ? 'ON' : 'OFF'}
                                </button>
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
               <div className={styles.communityIcon}>🚀</div>
               <h4 className={styles.communityTitle}>{t('tools.market_soon', '插件集市即将上线')}</h4>
               <p className={styles.communityDesc}>{t('tools.market_soon_desc', '不久后，您将能够在这里挂载由其他用户开发的生态能力接口。')}</p>
            </div>
         )}
      </div>
    </div>
  );
};
