import React from 'react';
import styles from './McpSettingsCard.module.css';

export interface McpServerConfig {
  mcpEnabled: boolean;
  mcpPort: number;
}

interface McpSettingsCardProps {
  config: McpServerConfig;
  onChange: (config: McpServerConfig) => void;
}

export const McpSettingsCard: React.FC<McpSettingsCardProps> = ({ config, onChange }) => {
  return (
    <div className={styles.container}>
      <div className={styles.row}>
        <div className={styles.info}>
          <span className={styles.title}>启用 Model Context Protocol (MCP Server)</span>
          <span className={styles.subtitle}>将白守数据核心局域暴露给兼容 MCP 的顶级 IDE 或外部构建大模型</span>
        </div>
        <label className={styles.switch}>
          <input 
            type="checkbox" 
            checked={config.mcpEnabled}
            onChange={(e) => onChange({ ...config, mcpEnabled: e.target.checked })}
          />
          <span className={styles.slider}></span>
        </label>
      </div>

      <div className={styles.row} style={{ opacity: config.mcpEnabled ? 1 : 0.4, transition: 'opacity 0.3s' }}>
        <div className={styles.info}>
          <span className={styles.title}>本地侦听端口控制 (Host Port)</span>
          <span className={styles.subtitle}>修改默认长连接端口（默认建议保留 31004）。如果需要多开请注意回避冲突。</span>
        </div>
        <input 
          type="number"
          className={styles.inputArea}
          value={config.mcpPort}
          disabled={!config.mcpEnabled}
          min={1000}
          max={65535}
          onChange={(e) => {
            const val = parseInt(e.target.value);
            // 简单的边界与回滚预判
            if (!isNaN(val)) onChange({ ...config, mcpPort: val });
          }}
        />
      </div>
    </div>
  );
};
