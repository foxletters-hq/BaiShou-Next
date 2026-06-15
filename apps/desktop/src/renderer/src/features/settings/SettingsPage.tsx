import React, { useState, useEffect } from 'react'
import { useSettingsStore } from '@baishou/store'
import { useNavigate, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
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
  MdSync
} from 'react-icons/md'
import './SettingsPage.css'
import { useTranslation } from 'react-i18next'
import { SettingsContentView } from './SettingsContentView'
import { getSettingsRouteSegment } from './settings-route.util'
import { resolveSettingsReturnPath } from './settings-navigation.util'

function getSettingsContentKey(pathname: string): string {
  return getSettingsRouteSegment(pathname)
}

export const SettingsPage: React.FC = () => {
  const { t } = useTranslation()

  const settings = useSettingsStore()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<number>(0)
  const [isClosing, setIsClosing] = useState(false)

  const TABS = [
    { id: 0, label: t('settings.general', '常规设置'), icon: <MdOutlineSettings /> },
    { id: 13, label: t('settings.mcp_title', 'MCP 服务'), icon: <MdOutlineHub /> },
    { type: 'divider' },
    { id: 1, label: t('settings.ai_services', '供应商管理'), icon: <MdOutlineCloudQueue /> },
    { id: 2, label: t('settings.ai_global_models', '全局默认模型'), icon: <MdOutlineStarBorder /> },
    { id: 3, label: t('agent.assistant.settings_entry', '伙伴管理'), icon: <MdSchool /> },
    { type: 'divider' },
    { id: 4, label: t('agent.rag.title', 'RAG 记忆管理'), icon: <MdColorLens /> },
    { id: 5, label: t('agent.tools.web_search', '网络搜索'), icon: <MdTravelExplore /> },
    { id: 6, label: t('settings.agent_tools_title', '工具管理'), icon: <MdOutlineExtension /> },
    {
      id: 7,
      label: t('settings.summary_settings_title', '回忆生成设置'),
      icon: <MdOutlineAutoAwesome />
    },
    { id: 11, label: t('settings.tts_settings', 'TTS 语音合成'), icon: <MdVolumeUp /> },
    { type: 'divider' },
    {
      id: 14,
      label: t('data_sync.incremental_sync', '增量同步'),
      icon: <MdSync size={20} />
    },
    { id: 9, label: t('data_sync.title', '数据备份'), icon: <MdOutlineStorage size={20} /> },
    { id: 12, label: t('version_control.title', '版本控制'), icon: <MdHistory /> },
    {
      id: 10,
      label: t('settings.attachment_management', '附件管理'),
      icon: <MdOutlineCollections />
    },
    {
      id: 8,
      label: t('settings.lan_transfer', '局域网传输'),
      icon: <MdWifi size={20} />
    }
  ]

  const location = useLocation()

  useEffect(() => {
    switch (location.pathname) {
      case '/settings/general':
      case '/settings/mcp':
        setActiveTab(location.pathname === '/settings/mcp' ? 13 : 0)
        break
      case '/settings/ai-services':
        setActiveTab(1)
        break
      case '/settings/ai-models':
        setActiveTab(2)
        break
      case '/settings/assistants':
        setActiveTab(3)
        break
      case '/settings/rag':
        setActiveTab(4)
        break
      case '/settings/web-search':
        setActiveTab(5)
        break
      case '/settings/agent-tools':
        setActiveTab(6)
        break
      case '/settings/summary':
        setActiveTab(7)
        break
      case '/settings/tts':
        setActiveTab(11)
        break
      case '/settings/lan-transfer':
        setActiveTab(8)
        break
      case '/settings/data-sync':
        setActiveTab(9)
        break
      case '/settings/incremental-sync':
        setActiveTab(14)
        break
      case '/settings/attachments':
        setActiveTab(10)
        break
      case '/settings/git':
        setActiveTab(12)
        break
      case '/settings/workspaces':
      case '/settings/identity-cards':
      case '/settings':
        setActiveTab(0)
        break
      default:
        setActiveTab(0)
    }
  }, [location.pathname])

  useEffect(() => {
    settings.loadConfig()
  }, [settings.loadConfig])

  const handleTabChange = (tabId: number) => {
    setActiveTab(tabId)
    switch (tabId) {
      case 0:
        navigate('/settings/general', { replace: true })
        break
      case 13:
        navigate('/settings/mcp', { replace: true })
        break
      case 1:
        navigate('/settings/ai-services', { replace: true })
        break
      case 2:
        navigate('/settings/ai-models', { replace: true })
        break
      case 3:
        navigate('/settings/assistants', { replace: true })
        break
      case 4:
        navigate('/settings/rag', { replace: true })
        break
      case 5:
        navigate('/settings/web-search', { replace: true })
        break
      case 6:
        navigate('/settings/agent-tools', { replace: true })
        break
      case 7:
        navigate('/settings/summary', { replace: true })
        break
      case 11:
        navigate('/settings/tts', { replace: true })
        break
      case 8:
        navigate('/settings/lan-transfer', { replace: true })
        break
      case 9:
        navigate('/settings/data-sync', { replace: true })
        break
      case 14:
        navigate('/settings/incremental-sync', { replace: true })
        break
      case 10:
        navigate('/settings/attachments', { replace: true })
        break
      case 12:
        navigate('/settings/git', { replace: true })
        break
    }
  }

  const handleBack = () => {
    const returnTo = resolveSettingsReturnPath()
    setIsClosing(true)
    window.setTimeout(() => {
      navigate(returnTo, { replace: true })
    }, 150)
  }

  const contentKey = getSettingsContentKey(location.pathname)

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
                if (tab.type === 'divider') {
                  return <div key={`div-${idx}`} className="settings-divider" />
                }
                const isSelected = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    className={`settings-nav-item ${isSelected ? 'active' : ''}`}
                    onClick={() => handleTabChange(tab.id as number)}
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
          <AnimatePresence mode="wait">
            <SettingsContentView
              key={contentKey}
              pathname={location.pathname}
              settings={settings}
              motionKey={contentKey}
            />
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
