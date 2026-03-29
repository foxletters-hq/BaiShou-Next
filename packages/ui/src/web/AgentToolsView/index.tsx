import React, { useState } from 'react';
import styles from './AgentToolsView.module.css';

export interface AgentTool {
  id: string;
  name: string;
  description: string;
  icon: string;
  isEnabled: boolean;
  version: string;
}

interface AgentToolsViewProps {
  tools: AgentTool[];
  onToggleTool: (toolId: string, enabled: boolean) => void;
  onRefreshTools?: () => void;
}

export const AgentToolsView: React.FC<AgentToolsViewProps> = ({ 
  tools, 
  onToggleTool,
  onRefreshTools 
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTools = searchQuery.trim() === ''
     ? tools
     : tools.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.description.toLowerCase().includes(searchQuery.toLowerCase()));

  const ToolCard = ({ tool }: { tool: AgentTool }) => (
    <div className={`${styles.toolCard} ${tool.isEnabled ? styles.toolCardEnabled : ''}`}>
       <div className={styles.cardHeader}>
          <div className={styles.iconBox}>{tool.icon}</div>
          <div className={styles.nameWrap}>
             <span className={styles.toolName}>{tool.name}</span>
             <span className={styles.versionBadge}>v{tool.version}</span>
          </div>
          <div className={styles.toggleWrap}>
             <label className={styles.switch}>
                <input 
                  type="checkbox" 
                  checked={tool.isEnabled} 
                  onChange={(e) => onToggleTool(tool.id, e.target.checked)} 
                />
                <span className={styles.slider}></span>
             </label>
          </div>
       </div>
       <div className={styles.cardBody}>
          <p className={styles.description}>{tool.description}</p>
       </div>
       <div className={styles.cardFooter}>
          <button className={styles.configBtn} disabled={!tool.isEnabled}>
             配置参数
          </button>
       </div>
    </div>
  );

  return (
    <div className={styles.container}>
       <div className={styles.toolbar}>
          <div className={styles.searchBox}>
             <span className={styles.searchIcon}>🔍</span>
             <input 
               type="text"
               placeholder="检索工具插件..."
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className={styles.searchInput}
             />
          </div>
          <button className={styles.refreshBtn} onClick={onRefreshTools}>
             刷新列表
          </button>
       </div>
       
       <div className={styles.grid}>
          {filteredTools.length === 0 ? (
             <div className={styles.emptyState}>未能找到相关工具插件</div>
          ) : (
             filteredTools.map(t => <ToolCard key={t.id} tool={t} />)
          )}
       </div>
    </div>
  );
};
