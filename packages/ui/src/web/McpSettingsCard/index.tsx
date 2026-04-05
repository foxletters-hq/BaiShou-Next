import React from 'react';
import { useTranslation } from 'react-i18next';
import { MdOutlineHub, MdOutlineLan, MdChevronRight } from 'react-icons/md';
import '../shared/SettingsListTile.css';
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
  const { t } = useTranslation();

  return (
    <div>
      {/* SwitchListTile: MCP 启用开关 */}
      <div className="settings-list-tile settings-list-tile-noclick">
        <div className="settings-list-tile-leading">
          <MdOutlineHub size={24} />
        </div>
        <div className="settings-list-tile-content">
          <span className="settings-list-tile-title">
            {t('settings.mcp_title', 'MCP Server')}
            {config.mcpEnabled && <div className={styles.statusIndicator} />}
          </span>
          <span className="settings-list-tile-subtitle">
            {config.mcpEnabled
              ? t('settings.mcp_running', 'MCP 服务运行中，端口: $port').replace('$port', config.mcpPort.toString())
              : t('settings.mcp_desc', '将数据以 MCP 协议提供给外部 IDE 或智能应用')}
          </span>
        </div>
        <label className="settings-switch-label" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={config.mcpEnabled}
            onChange={(e) => onChange({ ...config, mcpEnabled: e.target.checked })}
          />
          <span className="settings-switch-slider" />
        </label>
      </div>

      {config.mcpEnabled && (
        <>
          <div className="settings-list-divider" />
          {/* 端口配置行 */}
          <div className="settings-list-tile settings-list-tile-noclick">
            <div className="settings-list-tile-leading" style={{ paddingLeft: 24 }}>
              <MdOutlineLan size={20} />
            </div>
            <div className="settings-list-tile-content">
              <span className="settings-list-tile-title">{t('settings.mcp_port', '监听端口')}</span>
            </div>
            <input
              type="number"
              className="settings-number-input"
              value={config.mcpPort}
              min={1000}
              max={65535}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (!isNaN(val)) onChange({ ...config, mcpPort: val });
              }}
            />
          </div>
          <div className="settings-list-divider indent" />
          {/* 状态行 */}
          <div className="settings-list-tile settings-list-tile-noclick" style={{ paddingBottom: 12 }}>
            <div className="settings-list-tile-leading" style={{ paddingLeft: 24 }} />
            <span className="settings-list-tile-subtitle settings-monospace">
              http://localhost:{config.mcpPort}/mcp
            </span>
          </div>
        </>
      )}
    </div>
  );
};
