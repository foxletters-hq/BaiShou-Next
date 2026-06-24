import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MdHelpOutline } from 'react-icons/md'
import { Modal } from '../Modal/Modal'
import { mergeSettingsHelpButtonHandlers } from '../shared/settingsInlineHelpBlock'
import styles from './McpHelpButton.module.css'
import { buildMcpClientJsonExample } from '../../shared/mcp-client-config.util'
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
  const mcpJsonExample = buildMcpClientJsonExample(mcpUrl, mcpAuthToken)

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
                  '将下方配置粘贴到 mcpServers 中（url 与 Authorization 请使用上方连接地址与访问令牌），保存后重启 Cursor 或刷新 MCP 列表。'
                )}
              </li>
            </ol>
            <pre className={styles.jsonExample}>{mcpJsonExample}</pre>
          </section>
          {mcpAuthToken?.trim() ? (
            <p className={styles.note}>
              {t(
                'settings.mcp_help_auth_note',
                '若已生成访问令牌，请在 headers.Authorization 中填写 Bearer <令牌>，否则无法获取工具列表。'
              )}
            </p>
          ) : null}
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
