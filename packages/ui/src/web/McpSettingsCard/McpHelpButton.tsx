import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MdHelpOutline } from 'react-icons/md'
import { Modal } from '../Modal/Modal'
import { mergeSettingsHelpButtonHandlers } from '../shared/settingsInlineHelpBlock'
import styles from './McpHelpButton.module.css'
import { buildMcpUrl } from './mcp-url'

export interface McpHelpButtonProps {
  size?: number
  className?: string
  mcpPort?: number
  mcpAuthToken?: string
}

export const McpHelpButton: React.FC<McpHelpButtonProps> = ({
  size = 16,
  className = '',
  mcpPort = 31004,
  mcpAuthToken
}) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const mcpUrl = buildMcpUrl(mcpPort)
  const authHeadersJson = mcpAuthToken?.trim()
    ? `,
      "headers": {
        "Authorization": "Bearer ${mcpAuthToken.trim()}"
      }`
    : ''

  return (
    <>
      <button
        type="button"
        className={`${styles.helpBtn} ${className}`.trim()}
        aria-label={t('settings.mcp_help_aria', 'MCP 连接说明')}
        {...mergeSettingsHelpButtonHandlers(() => setOpen(true))}
      >
        <MdHelpOutline size={size} className={styles.helpIcon} aria-hidden />
      </button>
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
          {mcpAuthToken?.trim() ? (
            <p className={styles.note}>
              {t(
                'settings.mcp_help_auth_note',
                '连接需在请求头携带 Authorization: Bearer <访问令牌>，令牌见设置页「访问令牌」。'
              )}
            </p>
          ) : null}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>{t('settings.mcp_help_cursor_title', 'Cursor')}</h3>
            <ol className={styles.steps}>
              <li>
                {t(
                  'settings.mcp_help_cursor_1',
                  '打开 Cursor 设置 → Features → MCP（或编辑项目/全局 mcp.json）。'
                )}
              </li>
              <li>
                {t(
                  'settings.mcp_help_cursor_2',
                  '添加服务器，将 url 设为上方连接地址，保存后重启 Cursor 或刷新 MCP 列表。'
                )}
              </li>
            </ol>
          </section>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>
              {t('settings.mcp_help_json_title', 'JSON 配置客户端')}
            </h3>
            <ol className={styles.steps}>
              <li>
                {t(
                  'settings.mcp_help_json_1',
                  '在客户端的 MCP 设置中打开 JSON 配置，于 mcpServers 中新增服务器。'
                )}
              </li>
              <li>
                {t(
                  'settings.mcp_help_json_2',
                  '将 type 设为 streamableHttp，baseUrl 设为上方连接地址（必须以 /mcp 结尾）。'
                )}
              </li>
            </ol>
            <pre className={styles.jsonExample}>{`{
  "mcpServers": {
    "baishou": {
      "type": "streamableHttp",
      "baseUrl": "${mcpUrl}"${authHeadersJson}
    }
  }
}`}</pre>
          </section>
          <p className={styles.note}>
            {t(
              'settings.mcp_help_note',
              '请使用上方 /mcp 地址（不要用 /sse）。启用后需保持白守桌面端运行。'
            )}
          </p>
        </div>
      </Modal>
    </>
  )
}
