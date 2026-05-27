import React, { useState, useEffect } from 'react'
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
  MdOutlineWifiProtectedSetup,
  MdSync,
  MdOutlineFolderDelete,
  MdArrowBack,
  MdVolumeUp
} from 'react-icons/md'
import './SettingsPage.css'
import { useTranslation } from 'react-i18next'

import { WebSearchPane } from './components/WebSearchPane'
import { AgentToolsPane } from './components/AgentToolsPane'
import { SummarySettingsPane } from './components/SummarySettingsPane'
import { LanTransferPane } from './components/LanTransferPane'
import { DataSyncPane } from './components/DataSyncPane'
import { AttachmentManagementPane } from './components/AttachmentManagementPane'
import { TTSSettingsPane } from './components/TTSSettingsPane'

import { GeneralSettingsPane } from './components/GeneralSettingsPane'
import { AiModelServicesPane } from './components/AiModelServicesPane'
import { AiGlobalModelsPane } from './components/AiGlobalModelsPane'
import { AssistantPane } from './components/AssistantPane'
import { RagSettingsPane } from './components/RagSettingsPane'

export const SettingsPage: React.FC = () => {
  const { t } = useTranslation()

  const settings = useSettingsStore()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<number>(0)
  const [isClosing, setIsClosing] = useState(false)

  const TABS = [
    { id: 0, label: t('settings.general', '常规设置'), icon: <MdOutlineSettings /> },
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
      id: 8,
      label: t('settings.lan_transfer', '局域网传输'),
      icon: <MdOutlineWifiProtectedSetup />
    },
    { id: 9, label: t('data_sync.title', '数据备份'), icon: <MdSync /> },
    {
      id: 10,
      label: t('settings.attachment_management', '附件管理'),
      icon: <MdOutlineFolderDelete />
    }
  ]

  const location = useLocation()

  useEffect(() => {
    switch (location.pathname) {
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
      case '/settings/attachments':
        setActiveTab(10)
        break
      case '/settings':
      case '/settings/general':
      default:
        setActiveTab(0)
    }
  }, [location.pathname])

  useEffect(() => {
    settings.loadConfig()
  }, [settings.loadConfig])

  // Sync state to URL without pushing history excessively
  const handleTabChange = (tabId: number) => {
    setActiveTab(tabId)
    switch (tabId) {
      case 0:
        navigate('/settings/general', { replace: true })
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
      case 10:
        navigate('/settings/attachments', { replace: true })
        break
    }
  }

  const renderActiveView = () => {
    if (settings.isLoading) {
      return (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginTop: 100,
            color: 'var(--color-on-surface-variant)'
          }}
        >
          {t('common.loading_settings', '读取配置表项状态中...')}
        </div>
      )
    }
    switch (activeTab) {
      case 0:
        return <GeneralSettingsPane settings={settings} />
      case 1:
        return <AiModelServicesPane settings={settings} />
      case 2:
        return <AiGlobalModelsPane settings={settings} />
      case 3:
        return <AssistantPane settings={settings} />
      case 4:
        return <RagSettingsPane settings={settings} />
      case 5:
        return <WebSearchPane settings={settings} />
      case 6:
        return <AgentToolsPane settings={settings} />
      case 7:
        return <SummarySettingsPane settings={settings} />
      case 11:
        return <TTSSettingsPane />
      case 8:
        return <LanTransferPane />
      case 9:
        return <DataSyncPane settings={settings} />
      case 10:
        return <AttachmentManagementPane />
      default:
        return <div />
    }
  }

  const handleBack = () => {
    setIsClosing(true)
    setTimeout(() => {
      navigate(-1)
    }, 250) // Matches the exit animation duration
  }

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

        <div className="settings-content-area" style={{ position: 'relative' }}>
          {activeTab === 8 ||
          activeTab === 1 ||
          activeTab === 2 ||
          activeTab === 11 ||
          activeTab === 4 ||
          activeTab === 5 ? (
            renderActiveView()
          ) : (
            <div className="settings-content-scroll" key={activeTab}>
              {renderActiveView()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
