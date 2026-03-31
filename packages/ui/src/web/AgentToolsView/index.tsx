import React from 'react';
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
  { id: 'web_search', name: '全网神经链爬虫', icon: '🕷', desc: '准许 AI 隐秘访问实时网络。', tag: '安全' },
  { id: 'calculator', name: '数学推理沙盒', icon: '🧮', desc: '绝对精确的推演运算，避免大模型幻觉。', tag: '安全' },
  { id: 'code_interpreter', name: '安全仓代码执行', icon: '💻', desc: '执行分析或图表绘制 (Python/JS)。', tag: '风险' },
  { id: 'local_file_read', name: '设备卷宗透视', icon: '📂', desc: '准许只读访问本地磁盘文档及画像。', tag: '高危' },
  { id: 'system_commander', name: '高危指令接管', icon: '⚡', desc: '可直接操控您的操作系统的终极特权。', tag: '极端高危' },
];

export const AgentToolsView: React.FC<AgentToolsViewProps> = ({ config, onChange }) => {
  const toggleTool = (toolId: string) => {
    let freshList = [...config.enabledTools];
    if (freshList.includes(toolId)) {
      freshList = freshList.filter(id => id !== toolId);
    } else {
      // 遇到高危工具应当触发警告弹窗（如果不是安全的话）
      const tool = ALL_TOOLS.find(t => t.id === toolId);
      if (tool && tool.tag.includes('危')) {
        const sure = window.confirm(`危险操作！您正在赋予 AI 具有破坏性的 ${tool.name} 权限。确定继续吗？`);
        if (!sure) return;
      }
      freshList.push(toolId);
    }
    onChange({ ...config, enabledTools: freshList });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleInfo}>
          <h3 className={styles.title}>系统能力生态集市 (Tools Ecosystem)</h3>
          <p className={styles.subtitle}>为超级个体挂载插件能力。红色标识工具将直接触及物理世界与隐私底线。</p>
        </div>
      </div>

      <div className={styles.autoApproveBar}>
        <div className={styles.approveMeta}>
          <span className={styles.approveTitle}>静默允许绿标工具流转</span>
          <span className={styles.approveDesc}>对标定为“安全”或只读的操作不需询问弹窗。极大提示对话流畅度。</span>
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

      <div className={styles.list}>
        {ALL_TOOLS.map((tool) => {
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
                {isEnabled ? '已装配 (UNINSTALL)' : '卸载 (INSTALL)'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
