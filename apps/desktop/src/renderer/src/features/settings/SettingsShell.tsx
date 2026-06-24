import React, { useEffect, useMemo, useState } from 'react'
import { useSettingsStore } from '@baishou/store'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  MdOutlineSettings,
  MdOutlineCloudQueue,
  MdOutlineStarBorder,
  MdSchool,
  MdColorLens,
  MdTravelExplore,
  MdOutlineExtension,
  MdOutlineAutoAwesome,
  MdWifi,
  MdOutlineStorage,
  MdOutlineCollections,
  MdArrowBack,
  MdVolumeUp,
  MdHistory,
  MdOutlineHub,
  MdSync,
  MdEditNote,
  MdSwapHoriz
} from 'react-icons/md'
import './SettingsPage.css'
import { useTranslation } from 'react-i18next'
import { SettingsContentView } from './SettingsContentView'
import { getSettingsRouteSegment, settingsPathForScope } from './settings-route.util'
import { resolveSettingsReturnPath } from './settings-navigation.util'
import { pathnameToSettingsTabId, SETTINGS_TAB_SEGMENTS } from './settings-tabs.util'
import { useRagRuntimeBridge } from './hooks/useRagRuntimeBridge'

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
        icon: <MdOutlineSettings />
      },
      {
        id: 13,
        kind: 'item',
        label: t('settings.mcp_title', 'MCP 服务'),
        icon: <MdOutlineHub />
      },
      { kind: 'divider' },
      {
        id: 1,
        kind: 'item',
        label: t('settings.ai_services', '供应商管理'),
        icon: <MdOutlineCloudQueue />
      },
      {
        id: 2,
        kind: 'item',
        label: t('settings.ai_global_models', '全局默认模型'),
        icon: <MdOutlineStarBorder />
      },
      {
        id: 3,
        kind: 'item',
        label: t('agent.assistant.settings_entry', '伙伴管理'),
        icon: <MdSchool />
      },
      { kind: 'divider' },
      {
        id: 4,
        kind: 'item',
        label: t('agent.rag.title', 'RAG 记忆管理'),
        icon: <MdColorLens />
      },
      {
        id: 5,
        kind: 'item',
        label: t('agent.tools.web_search', '网络搜索'),
        icon: <MdTravelExplore />
      },
      {
        id: 6,
        kind: 'item',
        label: t('settings.agent_tools_title', '工具管理'),
        icon: <MdOutlineExtension />
      },
      { kind: 'divider' },
      {
        id: 15,
        kind: 'item',
        label: t('settings.diary_template_title', '日记格式'),
        icon: <MdEditNote />
      },
      {
        id: 7,
        kind: 'item',
        label: t('settings.summary_settings_title', '回忆生成设置'),
        icon: <MdOutlineAutoAwesome />
      },
      {
        id: 11,
        kind: 'item',
        label: t('settings.tts_settings', 'TTS 语音合成'),
        icon: <MdVolumeUp />
      },
      { kind: 'divider' },
      {
        id: 14,
        kind: 'item',
        label: t('data_sync.incremental_sync', '增量同步'),
        icon: <MdSync size={20} />
      },
      {
        id: 9,
        kind: 'item',
        label: t('data_sync.title', '数据备份'),
        icon: <MdOutlineStorage size={20} />
      },
      {
        id: 12,
        kind: 'item',
        label: t('version_control.title', '版本控制'),
        icon: <MdHistory />
      },
      {
        id: 10,
        kind: 'item',
        label: t('settings.attachment_management', '附件管理'),
        icon: <MdOutlineCollections />
      },
      {
        id: 8,
        kind: 'item',
        label: t('settings.lan_transfer', '局域网传输'),
        icon: <MdWifi size={20} />
      },
      {
        id: 17,
        kind: 'item',
        label: t('legacy_migration.title', '版本迁移'),
        icon: <MdSwapHoriz size={20} />
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
              <MdArrowBack />
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
