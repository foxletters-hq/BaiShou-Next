import React from 'react';
import styles from './McpSettingsCard.module.css';
import { useTranslation } from 'react-i18next';


export interface McpServerConfig {
  mcpEnabled: boolean;
  mcpPort: number;
}

interface McpSettingsCardProps {
  config: McpServerConfig;
  onChange: (config: McpServerConfig) => void;
}

export const McpSettingsCard: React.FC<McpSettingsCardProps> = ({ config, onChange }) => {
  const { t } = useTranslation();
  return (
    <div className={styles.container}>
      <div className={styles.row}>
        <div className={styles.info}>
          <span className={styles.title}>{t('mcp.enable_title', '启用 Model Context Protocol (MCP Server)')}</span>
          <span className={styles.subtitle}>{t('mcp.enable_desc', '将终端数据以 MCP 协议提供给外部 IDE 或智能应用读取。')}</span>
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
          <span className={styles.title}>{t('mcp.port_title', '本地 MCP 端口控制 (Host Port)')}</span>
          <span className={styles.subtitle}>{t('mcp.port_desc', '修改侦听端口（强烈建议保留 31004 默认口）。遇到端口冲突请手动修改。')}</span>
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
