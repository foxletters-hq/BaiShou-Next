import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDialog } from '../Dialog'
import { useToast } from '../Toast/useToast'
import {
  ChevronRight,
  Database,
  FlaskConical,
  GalleryHorizontalEnd,
  MessageCircle,
  Trash2
} from 'lucide-react'

export interface DeveloperOptionsViewProps {
  /** 注入压缩测试会话后跳转到对应对话页（桌面端传入） */
  onOpenCompressionTestSession?: (sessionId: string) => void
  /** 打开开屏引导页（预览模式，桌面端传入） */
  onOpenOnboarding?: () => void
  /** 演示工作空间创建完成后同步前端 Vault 状态（桌面端传入） */
  onDemoVaultCreated?: (vaultName: string) => Promise<void>
}

export const DeveloperOptionsView: React.FC<DeveloperOptionsViewProps> = ({
  onOpenCompressionTestSession,
  onOpenOnboarding,
  onDemoVaultCreated
}) => {
  const { t } = useTranslation()
  const { confirm, alert } = useDialog()
  const [isClearing, setIsClearing] = useState(false)
  const [isLoadingDemo, setIsLoadingDemo] = useState(false)
  const [isClearingAgent, setIsClearingAgent] = useState(false)
  const [isInsertingCompressionTest, setIsInsertingCompressionTest] = useState(false)
  const toast = useToast()

  const handleLoadDemoData = async () => {
    const confirmed = await confirm(
      t(
        'developer.load_demo_full_desc',
        '将创建新的「演示空间」工作空间，切换至该空间并写入脱敏演示数据，不影响当前工作空间。'
      ),
      t('developer.load_demo_data', '创建演示工作空间')
    )
    if (!confirmed) return

    setIsLoadingDemo(true)
    try {
      if (typeof window !== 'undefined' && (window as any).electron) {
        const result = await (window as any).electron.ipcRenderer.invoke('developer:load-demo-data')
        const vaultName = result?.vaultName as string | undefined
        if (vaultName && onDemoVaultCreated) {
          await onDemoVaultCreated(vaultName)
        }
        toast.showSuccess(
          t('developer.load_demo_success', '已创建演示工作空间「{{vaultName}}」', {
            vaultName: vaultName ?? t('developer.demo_vault_fallback', '演示空间')
          })
        )
      }
    } catch (e: any) {
      toast.showError(t('developer.load_demo_failed', '创建失败: ') + e.message)
    } finally {
      setIsLoadingDemo(false)
    }
  }

  const handleClearAllData = async () => {
    const confirmed = await confirm(
      t(
        'developer.clear_warning_content',
        '您确定要清空应用的所有数据吗？此操作无法撤销！\n将删除所有工作空间及其内部数据。'
      ),
      t('developer.clear_warning_title', '危险操作告知')
    )
    if (!confirmed) return

    setIsClearing(true)
    try {
      if (typeof window !== 'undefined' && (window as any).electron) {
        await (window as any).electron.ipcRenderer.invoke('developer:clear-all-data')
        toast.showSuccess(
          t('developer.clear_all_success', '所有核心数据与环境已抹除，应用即将重启。')
        )
        await (window as any).electron.ipcRenderer.invoke('app:relaunch')
      }
    } catch (e: any) {
      toast.showError(t('developer.clear_failed', '清理失败: ') + e.message)
      setIsClearing(false)
    }
  }

  const handleInsertCompressionTestSession = async () => {
    setIsInsertingCompressionTest(true)
    try {
      if (typeof window !== 'undefined' && (window as any).electron) {
        const result = await (window as any).electron.ipcRenderer.invoke(
          'developer:insert-compression-test-session'
        )
        const sessionId = result?.sessionId as string | undefined
        const rounds = result?.roundCount ?? 15
        const tokens = result?.estimatedContextTokens ?? 0
        const threshold = result?.compressTokenThreshold ?? 0
        toast.showSuccess(
          t(
            'developer.insert_compression_test_success',
            threshold > 0
              ? '已创建压缩测试对话（{{rounds}} 轮，约 {{tokens}} tokens，伙伴阈值 {{threshold}}）'
              : '已创建压缩测试对话（{{rounds}} 轮，约 {{tokens}} tokens；伙伴未启用压缩阈值）',
            { rounds, tokens, threshold }
          )
        )
        if (sessionId && onOpenCompressionTestSession) {
          onOpenCompressionTestSession(sessionId)
        }
      }
    } catch (e: any) {
      await alert(
        t('developer.insert_compression_test_failed', '注入失败: ') + e.message,
        t('common.error', '错误')
      )
    } finally {
      setIsInsertingCompressionTest(false)
    }
  }

  const handleClearAgentDatabase = async () => {
    const confirmed = await confirm(
      t(
        'developer.clear_agent_db_desc',
        '将删除所有工作空间下的 Agent 会话、伙伴和消息数据。\n重启后数据库会自动重建。'
      ),
      t('developer.clear_agent_db', '清理 Agent 数据库')
    )
    if (!confirmed) return

    setIsClearingAgent(true)
    try {
      if (typeof window !== 'undefined' && (window as any).electron) {
        await (window as any).electron.ipcRenderer.invoke('developer:clear-agent-data')
        toast.showSuccess(t('developer.clear_agent_success', 'Agent 数据库已清空，应用即将重启。'))
        await (window as any).electron.ipcRenderer.invoke('app:relaunch')
      }
    } catch (e: any) {
      toast.showError(t('developer.clear_failed', '清理失败: ') + e.message)
      setIsClearingAgent(false)
    }
  }

  return (
    <div style={{ padding: '24px' }}>
      {onOpenOnboarding ? (
        <div className="glass-panel-card" style={{ padding: 0, marginBottom: 16 }}>
          <div
            className="settings-action-item"
            onClick={onOpenOnboarding}
            style={{
              padding: '16px 24px',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer'
            }}
          >
            <GalleryHorizontalEnd
              size={24}
              style={{
                marginRight: 16,
                color: 'var(--color-primary)'
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '600', fontSize: 15 }}>
                {t('developer.open_onboarding', '打开开屏引导')}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {t('developer.open_onboarding_desc', '跳转到首次启动引导页，用于预览和调试。')}
              </div>
            </div>
            <ChevronRight size={24} style={{ opacity: 0.5 }} />
          </div>
        </div>
      ) : null}

      <div
        className="glass-panel-card"
        style={{ padding: 0, border: '1px solid rgba(var(--color-primary-rgb), 0.35)', marginBottom: 16 }}
      >
        <div
          className="settings-action-item"
          onClick={onOpenOnboarding}
          style={{
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            cursor: onOpenOnboarding ? 'pointer' : 'default',
            opacity: onOpenOnboarding ? 1 : 0.5
          }}
        >
          <GalleryHorizontalEnd
            size={24}
            style={{
              marginRight: 16,
              color: 'var(--color-primary)'
            }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '600', fontSize: 15 }}>
              {t('developer.open_onboarding', '预览开屏引导')}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {t(
                'developer.open_onboarding_desc',
                '跳转到首次启动引导页，用于检查文案与排版（不会修改已有数据）。'
              )}
            </div>
          </div>
          <ChevronRight size={24} style={{ opacity: 0.5 }} />
        </div>
      </div>

      <div
        className="glass-panel-card"
        style={{ padding: 0, border: '1px solid rgba(244, 67, 54, 0.4)' }}
      >
        <div
          className="settings-action-item"
          onClick={isLoadingDemo ? undefined : handleLoadDemoData}
          style={{
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            cursor: isLoadingDemo ? 'default' : 'pointer'
          }}
        >
          <FlaskConical
            size={24}
            style={{
              marginRight: 16,
              color: 'var(--text-primary)'
            }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '600', fontSize: 15 }}>
              {t('developer.load_demo_data', '创建演示工作空间')}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {t(
                'developer.load_demo_desc',
                '新建独立工作空间并写入 66 条日记与 17 篇总结（脱敏演示数据）。'
              )}
            </div>
          </div>
          {isLoadingDemo ? (
            <div
              className="loading-spinner"
              style={{
                width: 24,
                height: 24,
                borderTopColor: 'var(--color-primary)'
              }}
            />
          ) : (
            <ChevronRight size={24} style={{ opacity: 0.5 }} />
          )}
        </div>

        <div style={{ height: 1, backgroundColor: 'rgba(255, 255, 255, 0.05)' }} />

        <div
          className="settings-action-item"
          onClick={isInsertingCompressionTest ? undefined : handleInsertCompressionTestSession}
          style={{
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            cursor: isInsertingCompressionTest ? 'default' : 'pointer'
          }}
        >
          <MessageCircle
            size={24}
            style={{
              marginRight: 16,
              color: 'var(--color-primary)'
            }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '600', fontSize: 15 }}>
              {t('developer.insert_compression_test', '注入压缩测试对话')}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {t(
                'developer.insert_compression_test_desc',
                '新建一条含 15 轮、约 3 万 tokens 的模拟 AI 对话（含工具调用），用于测试滚动压缩。'
              )}
            </div>
          </div>
          {isInsertingCompressionTest ? (
            <div
              className="loading-spinner"
              style={{
                width: 24,
                height: 24,
                borderTopColor: 'var(--color-primary)'
              }}
            />
          ) : (
            <ChevronRight size={24} style={{ opacity: 0.5 }} />
          )}
        </div>

        <div style={{ height: 1, backgroundColor: 'rgba(255, 255, 255, 0.05)' }} />

        <div
          className="settings-action-item"
          onClick={isClearing ? undefined : handleClearAllData}
          style={{
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            cursor: isClearing ? 'default' : 'pointer'
          }}
        >
          <Trash2 size={24} style={{ marginRight: 16, color: '#f44336' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '600', fontSize: 15, color: '#f44336' }}>
              {t('developer.clear_all_data', '清理所有数据 (核弹级)')}
            </div>
            <div style={{ fontSize: 13, opacity: 0.8 }}>
              {t(
                'developer.clear_all_desc',
                '彻底清空应用的所有数据，包括数据库、资源文件和全部应用级缓存，不可恢复。'
              )}
            </div>
          </div>
          {isClearing ? (
            <div
              className="loading-spinner"
              style={{ width: 24, height: 24, borderTopColor: '#f44336' }}
            />
          ) : (
            <ChevronRight size={24} style={{ opacity: 0.5 }} />
          )}
        </div>

        <div style={{ height: 1, backgroundColor: 'rgba(255, 255, 255, 0.05)' }} />

        <div
          className="settings-action-item"
          onClick={isClearingAgent ? undefined : handleClearAgentDatabase}
          style={{
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            cursor: isClearingAgent ? 'default' : 'pointer'
          }}
        >
          <Database size={24} style={{ marginRight: 16, color: '#ff9800' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '600', fontSize: 15, color: '#ff9800' }}>
              {t('developer.clear_agent_db', '清理 Agent 数据库')}
            </div>
            <div style={{ fontSize: 13, opacity: 0.8 }}>
              {t(
                'developer.clear_agent_db_desc',
                '删除 Agent 会话、伙伴、消息数据（重启后自动重建）'
              )}
            </div>
          </div>
          {isClearingAgent ? (
            <div
              className="loading-spinner"
              style={{ width: 24, height: 24, borderTopColor: '#ff9800' }}
            />
          ) : (
            <ChevronRight size={24} style={{ opacity: 0.5 }} />
          )}
        </div>
      </div>
    </div>
  )
}
