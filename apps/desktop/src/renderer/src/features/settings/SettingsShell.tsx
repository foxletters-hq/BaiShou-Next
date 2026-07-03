import React, { useEffect, useMemo, useState } from 'react'
import { useSettingsStore } from '@baishou/store'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Archive,
  ArrowLeft,
  ArrowLeftRight,
  Cable,
  Cloud,
  Database,
  Globe,
  GraduationCap,
  History,
  NotebookPen,
  Paperclip,
  Puzzle,
  RefreshCw,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  Wifi
} from 'lucide-react'
import './SettingsPage.css'
import { useTranslation } from 'react-i18next'
import { SettingsContentView } from './SettingsContentView'
import { getSettingsRouteSegment, settingsPathForScope } from './settings-route.util'
import { resolveSettingsReturnPath } from './settings-navigation.util'
import { pathnameToSettingsTabId, SETTINGS_TAB_SEGMENTS } from './settings-tabs.util'
import { useRagRuntimeBridge } from './hooks/useRagRuntimeBridge'

const NAV_ICON_SIZE = 20

type SettingsTabItem =
  | { kind: 'divider' }
  | { kind: 'item'; id: number; label: string; icon: React.ReactNode }

/** 全屏 overlay 设置（伙伴区等入口）：自带设置侧栏 + 内容区 */
export const SettingsShell: React.FC = () => {
  const { t } = useTranslation()
  const settings = useSettingsStore()
  const loadConfig = useSettingsStore((s) => s.loadConfig)
  const navigate = useNavigate()
  const location = useLocation()
  const [isClosing, setIsClosing] = useState(false)
  const activeTab = pathnameToSettingsTabId(location.pathname)
  useRagRuntimeBridge()

  const TABS = useMemo<SettingsTabItem[]>(
    () => [
      {
        id: 0,
        kind: 'item',
        label: t('settings.general', '常规设置'),
        icon: <Settings size={NAV_ICON_SIZE} />
      },
      {
        id: 13,
        kind: 'item',
        label: t('settings.mcp_title', 'MCP 服务'),
        icon: <Cable size={NAV_ICON_SIZE} />
      },
      { kind: 'divider' },
      {
        id: 1,
        kind: 'item',
        label: t('settings.ai_services', '供应商管理'),
        icon: <Cloud size={NAV_ICON_SIZE} />
      },
      {
        id: 2,
        kind: 'item',
        label: t('settings.ai_global_models', '全局默认模型'),
        icon: <SlidersHorizontal size={NAV_ICON_SIZE} />
      },
      {
        id: 3,
        kind: 'item',
        label: t('agent.assistant.settings_entry', '伙伴管理'),
        icon: <GraduationCap size={NAV_ICON_SIZE} />
      },
      { kind: 'divider' },
      {
        id: 4,
        kind: 'item',
        label: t('agent.rag.title', 'RAG 记忆管理'),
        icon: <Database size={NAV_ICON_SIZE} />
      },
      {
        id: 5,
        kind: 'item',
        label: t('agent.tools.web_search', '网络搜索'),
        icon: <Globe size={NAV_ICON_SIZE} />
      },
      {
        id: 6,
        kind: 'item',
        label: t('settings.agent_tools_title', '工具管理'),
        icon: <Puzzle size={NAV_ICON_SIZE} />
      },
      { kind: 'divider' },
      {
        id: 15,
        kind: 'item',
        label: t('settings.diary_template_title', '日记格式'),
        icon: <NotebookPen size={NAV_ICON_SIZE} />
      },
      {
        id: 7,
        kind: 'item',
        label: t('settings.summary_settings_title', '回忆生成设置'),
        icon: <Sparkles size={NAV_ICON_SIZE} />
      },
      {
        id: 11,
        kind: 'item',
        label: t('settings.tts_settings', 'TTS 语音合成'),
        icon: <Volume2 size={NAV_ICON_SIZE} />
      },
      { kind: 'divider' },
      {
        id: 14,
        kind: 'item',
        label: t('data_sync.incremental_sync', '增量同步'),
        icon: <RefreshCw size={NAV_ICON_SIZE} />
      },
      {
        id: 9,
        kind: 'item',
        label: t('data_sync.title', '数据备份'),
        icon: <Archive size={NAV_ICON_SIZE} />
      },
      {
        id: 12,
        kind: 'item',
        label: t('version_control.title', '版本控制'),
        icon: <History size={NAV_ICON_SIZE} />
      },
      {
        id: 10,
        kind: 'item',
        label: t('settings.attachment_management', '附件管理'),
        icon: <Paperclip size={NAV_ICON_SIZE} />
      },
      {
        id: 8,
        kind: 'item',
        label: t('settings.lan_transfer', '局域网传输'),
        icon: <Wifi size={NAV_ICON_SIZE} />
      },
      {
        id: 17,
        kind: 'item',
        label: t('legacy_migration.title', '版本迁移'),
        icon: <ArrowLeftRight size={NAV_ICON_SIZE} />
      }
    ],
    [t]
  )

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      void loadConfig()
    })
    return () => cancelAnimationFrame(frameId)
  }, [loadConfig])

  useEffect(() => {
    if (location.pathname === '/settings') {
      navigate('/settings/general', { replace: true })
    }
  }, [location.pathname, navigate])

  const handleTabChange = (tabId: number) => {
    const segment = SETTINGS_TAB_SEGMENTS[tabId]
    if (!segment) return
    const target = settingsPathForScope('overlay', segment)
    if (target !== location.pathname) {
      navigate(target, { replace: true })
    }
  }

  const handleBack = () => {
    const returnTo = resolveSettingsReturnPath()
    setIsClosing(true)
    window.setTimeout(() => {
      navigate(returnTo, { replace: true })
    }, 150)
  }

  const contentKey = getSettingsRouteSegment(location.pathname)

  return (
    <div className={`settings-page-wrapper ${isClosing ? 'settings-closing' : ''}`}>
      <div className="settings-layout-body">
        <div className="settings-sidebar">
          <div className="settings-header">
            <button
              className="settings-back-btn"
              onClick={handleBack}
              title={t('common.cancel', '取消')}
            >
              <ArrowLeft size={NAV_ICON_SIZE} />
            </button>
            <h1 className="settings-title">{t('settings.title', '系统设置')}</h1>
          </div>

          <div className="settings-nav-scroll">
            <div className="settings-nav-group">
              {TABS.map((tab, idx) => {
                if (tab.kind === 'divider') {
                  return <div key={`div-${idx}`} className="settings-divider" />
                }
                const isSelected = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    className={`settings-nav-item ${isSelected ? 'active' : ''}`}
                    onClick={() => handleTabChange(tab.id)}
                  >
                    <div className="settings-nav-icon">{tab.icon}</div>
                    <span className="settings-nav-label">{tab.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="settings-content-area" style={{ position: 'relative', overflow: 'hidden' }}>
          <SettingsContentView
            key={contentKey}
            pathname={location.pathname}
            settings={settings}
            motionKey={contentKey}
          />
        </div>
      </div>
    </div>
  )
}
