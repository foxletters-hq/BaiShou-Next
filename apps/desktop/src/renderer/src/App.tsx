import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { HashRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { MainLayout } from './layouts/MainLayout'
import { CachedRoutePlaceholder } from './layouts/MainPageCache'
import { HomeScreen } from './features/home/HomeScreen'
import { AgentScreen } from './features/agent/AgentScreen'
import { OnboardingScreen } from './features/onboarding/OnboardingScreen'
import { SessionManagementScreen } from './features/agent/SessionManagementScreen'
import { AssistantManagementScreen } from './features/agent/AssistantManagementScreen'
import { AssistantEditScreen } from './features/agent/AssistantEditScreen'
import { AgentLayout } from './features/agent/AgentLayout'

// Phase 14: Recover Missing Feature Routes
import { DiaryEditorPage } from './features/diary/DiaryEditorPage'
import { rememberSettingsReturnPath } from './features/settings/settings-navigation.util'
import { SummaryDetailPage } from './features/summary/SummaryDetailPage'
import {
  useToast,
  useDialog,
  DialogProvider,
  ToastProvider,
  GlobalInputContextMenu,
  RestoreBlockingOverlay
} from '@baishou/ui'
import { useTranslation } from 'react-i18next'
import { useSettingsStore, useSyncStore } from '@baishou/store'
import { i18n, isRagMemoryEnabled } from '@baishou/shared'
import { TitleBar } from './components/TitleBar'
import { IncrementalSyncConfirmHost } from './components/IncrementalSyncConfirmDialog/IncrementalSyncConfirmHost'
import { useZoom } from './hooks/useZoom'
import { useLegacyUpgradeRagToast } from './hooks/useLegacyUpgradeRagToast'
import shellStyles from './AppShell.module.css'

const SettingsPage = lazy(() =>
  import('./features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage }))
)

const GlobalErrorHandler = () => {
  const toast = useToast()
  const { t } = useTranslation()

  useEffect(() => {
    const handleRejection = (e: PromiseRejectionEvent) => {
      e.preventDefault()
      toast.showError(
        t('app.error.operation', '操作异常：') +
          (e.reason?.message || e.reason || t('app.error.unknown_network', '未知网络或系统错误'))
      )
    }

    const handleError = (e: ErrorEvent) => {
      e.preventDefault()
      toast.showError(
        t('app.error.system_warning', '系统警告：') +
          (e.message || t('app.error.unknown_program', '程序发生未知错误'))
      )
    }

    window.addEventListener('unhandledrejection', handleRejection)
    window.addEventListener('error', handleError)

    return () => {
      window.removeEventListener('unhandledrejection', handleRejection)
      window.removeEventListener('error', handleError)
    }
  }, [toast])

  return null
}

const DIARY_EMBED_FAILURE_TOAST_DEBOUNCE_MS = 8000

const DiaryEmbedFailureNotifier = () => {
  const toast = useToast()
  const { t } = useTranslation()
  const lastShownAtRef = useRef(0)

  useEffect(() => {
    const api = (window as any).api
    if (!api?.diary?.onSyncEvent) return

    const unsubscribe = api.diary.onSyncEvent((event: { type?: string }) => {
      if (event?.type !== 'embed-failed') return

      const ragConfig = useSettingsStore.getState().ragConfig
      if (!isRagMemoryEnabled(ragConfig)) return

      const now = Date.now()
      if (now - lastShownAtRef.current < DIARY_EMBED_FAILURE_TOAST_DEBOUNCE_MS) return
      lastShownAtRef.current = now

      toast.showWarning(
        t(
          'settings.rag_diary_auto_embed_failed',
          '日记已保存，但记忆嵌入未成功。请前往 设置 → RAG 记忆，点击「全量扫描未索引日记」补全嵌入。'
        ),
        { duration: 6000 }
      )
    })

    return unsubscribe
  }, [t, toast])

  return null
}

import { ErrorBoundary } from './ErrorBoundary'

const AppRoutes = () => {
  const location = useLocation()
  const dialog = useDialog()
  const [backgroundLocation, setBackgroundLocation] = useState(() => {
    if (location.pathname.startsWith('/settings')) {
      return { ...location, pathname: '/diary', state: null, key: 'default' }
    }
    return location
  })
  const isSettings = location.pathname.startsWith('/settings')

  // 路由变化时关闭所有弹窗
  useEffect(() => {
    dialog.closeAll()
  }, [location.pathname])

  useEffect(() => {
    if (!location.pathname.startsWith('/settings')) {
      setBackgroundLocation(location)
    } else if (!backgroundLocation.pathname.startsWith('/settings')) {
      rememberSettingsReturnPath(backgroundLocation.pathname)
    }
  }, [location])

  const mainRoutesLocation = isSettings ? backgroundLocation : location

  return (
    <>
      <Routes location={mainRoutesLocation}>
        <Route path="/welcome" element={<OnboardingScreen />} />

        <Route element={<MainLayout />}>
          <Route path="/" element={<HomeScreen />} />

          {/* Main Business Logic Sub-Routes — 列表页由 MainPageCache 保活 */}
          <Route path="/diary" element={<CachedRoutePlaceholder />} />
          <Route path="/diary/:dateStr" element={<DiaryEditorPage />} />
          <Route path="/summary" element={<CachedRoutePlaceholder />} />
          <Route path="/summary/:id" element={<SummaryDetailPage />} />

          {/* Tools Routing */}
          <Route path="/lan-transfer" element={<Navigate to="/hub/lan-transfer" replace />} />
          <Route path="/data-sync" element={<CachedRoutePlaceholder />} />
          <Route path="/incremental-sync" element={<CachedRoutePlaceholder />} />
          <Route path="/git" element={<CachedRoutePlaceholder />} />

          {/* 日记区侧边栏内嵌设置（非全屏 overlay） */}
          <Route path="/hub/*" element={<CachedRoutePlaceholder />} />

          {/* AI / Agent Role Routing - Wrapped in AgentLayout */}
          <Route element={<AgentLayout />}>
            <Route path="/chat/:sessionId?" element={<AgentScreen />} />
          </Route>
          <Route path="/sessions" element={<SessionManagementScreen />} />
          <Route path="/assistants" element={<AssistantManagementScreen />} />
          <Route path="/assistants/:id" element={<AssistantEditScreen />} />
        </Route>
      </Routes>

      {/* Settings Rendered as an Overlay to avoid unmounting MainLayout */}
      {isSettings && (
        <Routes>
          <Route
            path="/settings/*"
            element={
              <Suspense fallback={null}>
                <SettingsPage />
              </Suspense>
            }
          />
        </Routes>
      )}
    </>
  )
}

const AppShell: React.FC = () => {
  useLegacyUpgradeRagToast()

  return (
    <div className={shellStyles.shell}>
      <TitleBar />
      <IncrementalSyncConfirmHost />
      <div className={shellStyles.content}>
        <AppRoutes />
      </div>
    </div>
  )
}

export function App() {
  useZoom()
  const locale = useSettingsStore((s) => s.locale)
  const [archiveImporting, setArchiveImporting] = useState(false)

  useEffect(() => {
    const unsub = (window as any).api?.archive?.onArchiveImportState?.(setArchiveImporting)
    return unsub
  }, [])

  // 监听并更新全局增量同步进度
  useEffect(() => {
    const unsub = (window as any).api?.incrementalSync?.onSyncProgress((event: any) => {
      useSyncStore.getState().setProgress(event)
      const currentStatus = useSyncStore.getState().status
      if (
        event &&
        currentStatus !== 'syncing' &&
        currentStatus !== 'success' &&
        currentStatus !== 'error'
      ) {
        useSyncStore.getState().setStatus('syncing')
      }
    })
    return unsub
  }, [])

  const themeColor = useSettingsStore((s) => s.themeColor)

  // 确保 store 中持久化的语言设置在每次启动时同步到 i18n
  useEffect(() => {
    const lang = locale === 'system' ? navigator.language.split('-')[0] : locale
    if (i18n.language !== lang) {
      i18n.changeLanguage(lang)
    }
  }, [locale])

  const themeMode = useSettingsStore((s) => s.themeMode)

  // 监听并应用系统级/应用级的主题模式切换
  useEffect(() => {
    const applyTheme = (isDark: boolean) => {
      if (isDark) {
        document.documentElement.setAttribute('data-theme', 'dark')
      } else {
        document.documentElement.removeAttribute('data-theme')
      }
    }

    if (themeMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      applyTheme(mediaQuery.matches)

      const listener = (e: MediaQueryListEvent) => applyTheme(e.matches)
      mediaQuery.addEventListener('change', listener)
      return () => mediaQuery.removeEventListener('change', listener)
    } else {
      applyTheme(themeMode === 'dark')
    }
  }, [themeMode])

  useEffect(() => {
    if (themeColor) {
      document.documentElement.style.setProperty('--color-primary', themeColor)
      let hex = themeColor.replace('#', '')
      if (hex.length === 3)
        hex = hex
          .split('')
          .map((x) => x + x)
          .join('')
      if (hex.length === 6) {
        const r = parseInt(hex.substring(0, 2), 16)
        const g = parseInt(hex.substring(2, 4), 16)
        const b = parseInt(hex.substring(4, 6), 16)
        document.documentElement.style.setProperty('--color-primary-rgb', `${r}, ${g}, ${b}`)
      }
    }
  }, [themeColor])

  return (
    <HashRouter>
      <DialogProvider>
        <ToastProvider />
        <RestoreBlockingOverlay visible={archiveImporting} />
        <GlobalErrorHandler />
        <DiaryEmbedFailureNotifier />
        <GlobalInputContextMenu />
        <ErrorBoundary>
          <AppShell />
        </ErrorBoundary>
      </DialogProvider>
    </HashRouter>
  )
}
