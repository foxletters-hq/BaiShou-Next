import {
  RefreshCw,
  FileText,
  Cloud,
  HelpCircle
} from 'lucide-react'
import { useSyncStore } from '@baishou/store'
import { useTranslation } from 'react-i18next'
import { Tooltip, useDialog } from '@baishou/ui'
import { SyncConfigForm } from './components/sync/SyncConfigForm'

export const IncrementalSyncPage: React.FC = () => {
  const { t } = useTranslation()
  const dialog = useDialog()
  const {
    status,
    message,
    syncResult,
    progress,
    setStatus,
    setMessage,
    setSyncResult,
    setProgress
  } = useSyncStore()

  const friendlySyncError = (msg: string): string => {
    if (!msg) return '同步失败'
    let cleanMsg = msg.replace(/^Error:\s*/i, '')
    cleanMsg = cleanMsg.replace(/^Error invoking remote method '.*?':\s*/i, '')

    if (cleanMsg.includes('SyncInProgressError') || cleanMsg.includes('already in progress')) {
      return '同步操作正在进行中，请勿重复操作'
    }
    if (cleanMsg.includes('not initialized') || cleanMsg.includes('Please update config first')) {
      return '同步服务尚未初始化，请先配置并保存您的连接信息'
    }
    if (cleanMsg.includes('S3NotConfiguredError')) {
      return '同步服务尚未启用或配置不完整'
    }
    if (cleanMsg.includes('InvalidAccessKeyId')) {
      return 'Access Key 无效或已过期，请在设置中更新您的密钥'
    }
    if (
      cleanMsg.includes('SignatureDoesNotMatch') ||
      (cleanMsg.includes('signature') && cleanMsg.includes('does not match'))
    ) {
      return 'Secret Key 无效，请在设置中更新您的密钥'
    }
    if (cleanMsg.includes('AccessDenied')) {
      return '访问被拒绝，请检查 Bucket 权限或密钥配置'
    }
    if (cleanMsg.includes('NoSuchBucket')) {
      return 'Bucket 不存在，请检查 Bucket 名称配置'
    }
    if (cleanMsg.includes('ENOTFOUND') || cleanMsg.includes('getaddrinfo')) {
      return '无法解析域名，请检查 Endpoint 地址和网络连接'
    }
    if (cleanMsg.includes('ECONNREFUSED')) {
      return '连接被拒绝，请检查 Endpoint 地址和服务是否在线'
    }
    return `同步失败: ${cleanMsg}`
  }

  const handleSync = async () => {
    setStatus('syncing')
    setMessage('正在同步...')
    setSyncResult(null)
    setProgress(null)
    try {
      const result = await (window as any).api?.incrementalSync?.orchestratedSync()
      setSyncResult(result)
      setProgress(null)
      setMessage('同步完成')
      setStatus('success')
    } catch (e: any) {
      setMessage(friendlySyncError(e?.message || '未知错误'))
      setStatus('error')
      setProgress(null)
    }
  }

  const formatDuration = (ms: number) => (ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`)

  return (
    <div
      style={{
        flex: 1,
        padding: '24px 32px',
        overflowY: 'auto',
        background: 'var(--bg-app)',
        color: 'var(--text-primary)'
      }}
    >
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 24px 0', fontSize: '18px', fontWeight: 600 }}>
        <FileText size={18} style={{ marginRight: 2 }} />
        <span>{t('common.incremental_sync', '文件同步')}</span>
        <Tooltip
          content={t(
            'data_sync.incremental_sync_tooltip',
            '文件同步采用双向增量同步机制，会自动对比本地与云端文件的修改时间及哈希值，仅传输发生变更的文件，并在两端同步应用删除操作。同步的范围包含您的日记内容、历史总结以及 AI 聊天伙伴等核心数据。'
          )}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'color 0.2s ease',
              marginTop: '2px'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
          >
            <HelpCircle size={16} />
          </span>
        </Tooltip>
      </h2>

      {/* 引入拆分后的配置表单 */}
      <SyncConfigForm />

      {/* 同步操作 */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          padding: '20px 24px'
        }}
      >
        <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 600 }}>
          <Cloud size={14} style={{ marginRight: 6 }} />
          同步操作
        </h3>

        <button
          onClick={handleSync}
          disabled={status === 'syncing'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 20px',
            border: '1px solid var(--color-primary)',
            borderRadius: '8px',
            background: status === 'syncing' ? 'var(--bg-surface)' : 'var(--color-primary)',
            color: status === 'syncing' ? 'var(--text-primary)' : 'var(--text-on-primary)',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            opacity: status === 'syncing' ? 0.6 : 1
          }}
        >
          <RefreshCw
            size={16}
            style={status === 'syncing' ? { animation: 'spin 1s linear infinite' } : undefined}
          />
          {status === 'syncing' ? '同步中...' : '立即同步'}
        </button>

        {status === 'syncing' && progress && progress.total > 0 && (
          <div style={{ marginTop: 12 }}>
            <div
              style={{
                height: 3,
                background: 'var(--bg-surface-low)',
                borderRadius: 2,
                overflow: 'hidden',
                marginBottom: 4
              }}
            >
              <div
                style={{
                  height: '100%',
                  background: 'var(--color-primary)',
                  borderRadius: 2,
                  transition: 'width 0.3s ease',
                  width: `${Math.round((progress.current / progress.total) * 100)}%`
                }}
              />
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
              {progress.current}/{progress.total}
              {progress.statusText && ` · ${progress.statusText}`}
            </div>
          </div>
        )}

        {syncResult && (
          <div
            style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}
          >
            <StatCard
              label="上传"
              value={syncResult.uploaded?.length || 0}
              color="var(--color-primary)"
            />
            <StatCard
              label="下载"
              value={syncResult.downloaded?.length || 0}
              color="var(--color-success)"
            />
            <StatCard
              label="删除"
              value={
                (syncResult.deletedRemote?.length || 0) + (syncResult.deletedLocal?.length || 0)
              }
              color="var(--color-error)"
            />
            <StatCard
              label="冲突"
              value={syncResult.conflicted?.length || 0}
              color="var(--color-warning)"
            />
            <StatCard
              label="跳过"
              value={syncResult.skipped?.length || 0}
              color="var(--text-tertiary)"
            />
            <StatCard
              label="耗时"
              value={syncResult.duration ? formatDuration(syncResult.duration) : '-'}
              color="var(--text-secondary)"
              isText
            />
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const StatCard: React.FC<{
  label: string
  value: number | string
  color: string
  isText?: boolean
}> = ({ label, value, color, isText }) => (
  <div
    style={{
      background: 'var(--bg-surface-low)',
      borderRadius: '8px',
      padding: '12px',
      textAlign: 'center'
    }}
  >
    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: isText ? '13px' : '20px', fontWeight: 600, color }}>{value}</div>
  </div>
)
