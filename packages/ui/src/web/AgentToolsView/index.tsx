import React, { useState } from 'react';
import styles from './AgentToolsView.module.css';

export interface ToolManagementConfig {
  enabledTools: string[];
  autoApproveSafeTools: boolean;
}

interface AgentToolsViewProps {
  config: ToolManagementConfig;
  onChange: (config: ToolManagementConfig) => void;
}

const ALL_TOOLS = [
  { id: 'web_search', category: 'search', name: '全网神经链爬虫', icon: '🕷', desc: '准许 AI 隐秘访问实时网络。', tag: '安全' },
  { id: 'diary_parser', category: 'diary', name: '时序日记溯源器', icon: '📖', desc: '准许白守在过去发生的日子中穿梭并比对事态', tag: '安全' },
  { id: 'memory_synapse', category: 'memory', name: '向量突触调取器', icon: '🧠', desc: '通过 RAG 数据库进行全盘模糊关联检索。', tag: '安全' },
  { id: 'calculator', category: 'general', name: '数学推理沙盒', icon: '🧮', desc: '绝对精确的推演运算，避免大模型幻觉。', tag: '安全' },
  { id: 'code_interpreter', category: 'general', name: '安全仓代码执行', icon: '💻', desc: '执行分析或图表绘制 (Python/JS)。', tag: '风险' },
  { id: 'local_file_read', category: 'memory', name: '设备卷宗透视', icon: '📂', desc: '极度越权！准许只读访问本地磁盘文档及画像。', tag: '高危' },
  { id: 'system_commander', category: 'general', name: '指令下达接管', icon: '⚡', desc: '可直接操控您的操作系统的终极特权。', tag: '极端高危' },
];

const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  diary: { label: '私域编年史 (Diary)', icon: '📚' },
  memory: { label: '潜意识海 (Memory & RAG)', icon: '🌊' },
  search: { label: '外部天线 (Search)', icon: '📡' },
  general: { label: '执行体扩展 (General)', icon: '🔧' },
};

export const AgentToolsView: React.FC<AgentToolsViewProps> = ({ config, onChange }) => {
  const [activeTab, setActiveTab] = useState<'builtin' | 'community'>('builtin');

  const toggleTool = (toolId: string) => {
    let freshList = [...config.enabledTools];
    if (freshList.includes(toolId)) {
      freshList = freshList.filter(id => id !== toolId);
    } else {
      const tool = ALL_TOOLS.find(t => t.id === toolId);
      if (tool && tool.tag.includes('危')) {
        const sure = window.confirm(`【严重越权告警】\n您正在赋予 AI 具有操作系统破坏性乃至隐私外泄风险的 ${tool.name}。\n\n您确定要向硅基生命敞开物理主机的防线吗？`);
        if (!sure) return;
      }
      freshList.push(toolId);
    }
    onChange({ ...config, enabledTools: freshList });
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
          <h3 className={styles.title}>系统能力生态装配 (Tools Ecosystem)</h3>
          <p className={styles.subtitle}>为超级个体挂载插件能力。红色标识工具将直接触及物理世界底线。</p>
        </div>
      </div>

      <div className={styles.tabSwitcher}>
         <div 
            className={`${styles.tabBtn} ${activeTab === 'builtin' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('builtin')}
         >
           🔒 核心内置引擎 ({ALL_TOOLS.length})
         </div>
         <div 
            className={`${styles.tabBtn} ${activeTab === 'community' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('community')}
         >
           🌐 共生体集市
         </div>
      </div>

      <div className={styles.autoApproveBar}>
        <div className={styles.approveMeta}>
          <span className={styles.approveTitle}>静默全速流转 (Auto-Approve Safe)</span>
          <span className={styles.approveDesc}>对标定为“安全”的高频查询操作予以绿色通道放行，大幅提升硅基推演帧率。</span>
        </div>
        <label className={styles.switch}>
          <input 
            type="checkbox" 
            checked={config.autoApproveSafeTools}
            onChange={(e) => onChange({ ...config, autoApproveSafeTools: e.target.checked })}
          />
          <span className={styles.slider}></span>
        </label>
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
                            const isEnabled = config.enabledTools.includes(tool.id);
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
               <h4 className={styles.communityTitle}>共生体集市正在跃迁中</h4>
               <p className={styles.communityDesc}>不久后，您将能够在这里挂载由其他用户手刻的生态能力接口。</p>
            </div>
         )}
      </div>
    </div>
  );
};
