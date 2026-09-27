import React from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { Button, Input } from '@baishou/ui'
import styles from './McpClientServersPanel.module.css'

export function McpClientAddServerForm({
  adding,
  draftName,
  draftUrl,
  draftToken,
  testing,
  onToggleAdding,
  onDraftName,
  onDraftUrl,
  onDraftToken,
  onTest,
  onAdd
}: {
  adding: boolean
  draftName: string
  draftUrl: string
  draftToken: string
  testing: boolean
  onToggleAdding: () => void
  onDraftName: (value: string) => void
  onDraftUrl: (value: string) => void
  onDraftToken: (value: string) => void
  onTest: () => void
  onAdd: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className={styles.row}>
      <div className={styles.cardMain}>
        <button
          type="button"
          className={styles.cardHit}
          aria-expanded={adding}
          onClick={onToggleAdding}
        >
          <span className={styles.iconWrap} aria-hidden>
            <Plus size={18} strokeWidth={2} />
          </span>
          <span className={styles.cardCopy}>
            <span className={styles.cardTitle}>
              {t('settings.mcp_custom_new_title', '新建 MCP 服务')}
            </span>
            <span className={styles.cardDesc}>
              {t('settings.mcp_custom_new_desc', '添加自定义 MCP 服务')}
            </span>
          </span>
        </button>
      </div>

      {adding ? (
        <div className={styles.cardDetail}>
          <label className={styles.field}>
            <span>{t('settings.mcp_custom_name', '名称')}</span>
            <Input
              fieldSize="small"
              value={draftName}
              placeholder={t('settings.mcp_custom_name_placeholder', '例如检索服务')}
              onChange={(event) => onDraftName(event.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span>{t('settings.mcp_custom_url', '/mcp 地址')}</span>
            <Input
              fieldSize="small"
              value={draftUrl}
              placeholder="http://127.0.0.1:31004/mcp"
              onChange={(event) => onDraftUrl(event.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span>{t('settings.mcp_custom_token', '访问令牌（可选）')}</span>
            <Input
              fieldSize="small"
              type="password"
              autoComplete="off"
              value={draftToken}
              onChange={(event) => onDraftToken(event.target.value)}
            />
          </label>
          <div className={styles.cardActions}>
            <Button
              type="button"
              variant="outlined"
              size="small"
              disabled={testing}
              isLoading={testing}
              onClick={onTest}
            >
              {t('settings.mcp_custom_test', '测试连接')}
            </Button>
            <Button type="button" variant="outlined" size="small" onClick={onAdd}>
              {t('settings.mcp_custom_add', '添加')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
