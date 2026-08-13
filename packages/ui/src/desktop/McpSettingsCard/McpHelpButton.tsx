import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../Modal/Modal'
import { SettingsHelpIconButton } from '../HelpTooltip/SettingsHelpIconButton'
import styles from './McpHelpButton.module.css'
import { buildMcpClientJsonExample } from '../../shared/mcp-client-config.util'
import { buildMcpSseUrl, buildMcpUrl } from './mcp-url'

export interface McpHelpButtonProps {
  size?: number
  className?: string
  mcpPort?: number
  mcpAuthEnabled?: boolean
  mcpAuthToken?: string
  lanHost?: string | null
}

export const McpHelpButton: React.FC<McpHelpButtonProps> = ({
  size = 16,
  className = '',
  mcpPort = 31004,
  mcpAuthEnabled = true,
  mcpAuthToken,
  lanHost = null
}) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const endpointHost = lanHost?.trim() || '127.0.0.1'
  const mcpUrl = buildMcpUrl(mcpPort, endpointHost)
  const mcpSseUrl = buildMcpSseUrl(mcpPort, endpointHost)
  const effectiveToken = mcpAuthEnabled ? mcpAuthToken : undefined
  const mcpJsonExample = buildMcpClientJsonExample(mcpUrl, effectiveToken)
  const mcpSseJsonExample = buildMcpClientJsonExample(mcpSseUrl, effectiveToken)

  return (
    <>
      <SettingsHelpIconButton
        aria-label={t('settings.mcp_help_aria', 'MCP 连接说明')}
        size={size}
        className={className}
        onActivate={() => setOpen(true)}
      />
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={t('settings.mcp_help_modal_title', 'MCP 连接说明')}
        closeOnOverlayClick
        className={styles.helpModal}
        zIndex={10050}
      >
        <div className={styles.helpContent}>
          <p className={styles.intro}>
            {t(
              'settings.mcp_help_intro',
              '启用 MCP 后，白守会在本机启动 MCP 服务，供 Cursor 等外部 AI 客户端调用日记、记忆等工具。'
            )}
          </p>
          <div className={styles.urlLine}>
            <span className={styles.urlLabel}>{t('settings.mcp_url_label', '连接地址')}</span>
            <code className={styles.urlCode}>{mcpUrl}</code>
          </div>
          <div className={styles.urlLine}>
            <span className={styles.urlLabel}>
              {t('settings.mcp_sse_label', '连接地址（SSE）')}
            </span>
            <code className={styles.urlCode}>{mcpSseUrl}</code>
          </div>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>{t('settings.mcp_help_cursor_title', 'Cursor')}</h3>
            <ol className={styles.steps}>
              <li>
                {t(
                  'settings.mcp_help_cursor_1',
                  '打开或创建 Cursor 全局配置文件（Windows：%USERPROFILE%\\.cursor\\mcp.json，macOS/Linux：~/.cursor/mcp.json）。'
                )}
              </li>
              <li>
                {t(
                  'settings.mcp_help_cursor_2',
                  '将下方配置粘贴到 mcpServers 中（推荐 /mcp；若客户端仅支持旧版 SSE，改用 /sse），保存后重启 Cursor 或刷新 MCP 列表。'
                )}
              </li>
            </ol>
            <p className={styles.sectionHint}>
              {t('settings.mcp_help_streamable_title', '推荐：Streamable HTTP（/mcp）')}
            </p>
            <pre className={styles.jsonExample}>{mcpJsonExample}</pre>
            <p className={styles.sectionHint}>
              {t('settings.mcp_help_sse_title', '兼容：SSE（/sse）')}
            </p>
            <pre className={styles.jsonExample}>{mcpSseJsonExample}</pre>
          </section>
          {effectiveToken?.trim() ? (
            <p className={styles.note}>
              {t(
                'settings.mcp_help_auth_note',
                '若已生成访问令牌，请在 headers.Authorization 中填写 Bearer <令牌>，否则无法获取工具列表。'
              )}
            </p>
          ) : (
            <p className={styles.note}>
              {t(
                'settings.mcp_help_auth_disabled_note',
                '当前已关闭鉴权，配置中无需 Authorization 头。仅建议在受信网络使用。'
              )}
            </p>
          )}
          <p className={styles.note}>
            {t(
              'settings.mcp_help_note',
              lanHost
                ? '优先使用 /mcp；仅当客户端不支持 Streamable HTTP 时改用 /sse。启用后需保持白守桌面端运行，并确保客户端与电脑在同一局域网。'
                : '优先使用 /mcp；仅当客户端不支持 Streamable HTTP 时改用 /sse。启用后需保持白守桌面端运行。'
            )}
          </p>
        </div>
      </Modal>
    </>
  )
}
