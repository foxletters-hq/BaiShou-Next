import { Suspense, lazy, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { HashRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { MainLayout } from './layouts/MainLayout'
import { CachedRoutePlaceholder } from './layouts/MainPageCache'
import { HomeScreen } from './features/home/HomeScreen'
import {
  rememberSettingsReturnPath,
  locationToReturnPath
} from './features/settings/settings-navigation.util'
import { useToast } from '@baishou/ui/desktop/Toast/useToast'
import { useDialog, DialogProvider } from '@baishou/ui/desktop/Dialog'
import { ToastProvider } from '@baishou/ui/desktop/Toast/Toast'
import { GlobalInputContextMenu } from '@baishou/ui/desktop/ContextMenu'
import { RestoreBlockingOverlay } from '@baishou/ui/desktop/RestoreBlockingOverlay'
import { useTranslation } from 'react-i18next'
import { useSettingsStore, useSyncStore } from '@baishou/store'
import { ensureDesktopAgentGateInboxBridge } from './features/agent/agent-gate-inbox-bridge'
import { ensureDesktopAgentGateNotificationBridge } from './features/agent/agent-gate-notification-bridge'
import { resolveThemeColor } from '@baishou/ui/theme/preset-theme-colors'

const OnboardingScreen = lazy(() =>
  import('./features/onboarding/OnboardingScreen').then((m) => ({ default: m.OnboardingScreen }))
)
const SessionManagementScreen = lazy(() =>
  import('./features/agent/SessionManagementScreen').then((m) => ({
    default: m.SessionManagementScreen
  }))
)
const AssistantManagementScreen = lazy(() =>
  import('./features/agent/AssistantManagementScreen').then((m) => ({
    default: m.AssistantManagementScreen
  }))
)
const AssistantEditScreen = lazy(() =>
  import('./features/agent/AssistantEditScreen').then((m) => ({ default: m.AssistantEditScreen }))
)
const DiaryEditorPage = lazy(() =>
  import('./features/diary/DiaryEditorPage').then((m) => ({ default: m.DiaryEditorPage }))
)
const SummaryDetailPage = lazy(() =>
  import('./features/summary/SummaryDetailPage').then((m) => ({ default: m.SummaryDetailPage }))
)
import {
  initDesktopRendererCacheCoordinator,
  handleRendererDomainMutation
} from './cache/desktop-renderer-cache-coordinator'
import {
  initDesktopVaultScope,
  refreshDesktopVaultScopeAfterStorageRootChange,
  setDesktopVaultScopeKey,
  getDesktopVaultScopeRevision,
  subscribeDesktopVaultScope
} from './cache/desktop-vault-scope'
import type { DomainMutationEvent } from '@baishou/shared/cache'
import { i18n, isRagMemoryEnabled, resolveAppLanguage } from '@baishou/shared'
import { ensureUiFontForLanguage } from './styles/fonts'
import { TitleBar } from './components/TitleBar'
import { NetworkProvider } from './providers/NetworkProvider'
import { IncrementalSyncConfirmHost } from './components/IncrementalSyncConfirmDialog/IncrementalSyncConfirmHost'
import { useZoom } from './hooks/useZoom'
import { useLegacyUpgradeRagToast } from './hooks/useLegacyUpgradeRagToast'
import { DesktopLegacyMigrationPrompt } from './components/DesktopLegacyMigrationPrompt'
import shellStyles from './AppShell.module.css'
import { markRendererStartup, traceRendererStep } from './startup-trace'

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
  }, [toast, t])

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

    const unsubscribe = api.diary.onSyncEvent((event: { type?: string; message?: string }) => {
      if (event?.type !== 'embed-failed') return

      const ragConfig = useSettingsStore.getState().ragConfig
      if (!isRagMemoryEnabled(ragConfig)) return

      const now = Date.now()
      if (now - lastShownAtRef.current < DIARY_EMBED_FAILURE_TOAST_DEBOUNCE_MS) return
      lastShownAtRef.current = now

      const reason =
        typeof event.message === 'string' && event.message.trim()
          ? event.message.trim()
          : ragConfig.lastDiaryEmbedFailureMessage?.trim()

      toast.showWarning(
        reason
          ? t(
              'settings.rag_diary_auto_embed_failed_with_reason',
              '日记已保存，但记忆嵌入未成功：{{message}}。请前往 设置 → RAG 记忆，点击「全量扫描未索引日记」补全嵌入。',
              { message: reason }
            )
          : t(
              'settings.rag_diary_auto_embed_failed',
              '日记已保存，但记忆嵌入未成功。请前往 设置 → RAG 记忆，点击「全量扫描未索引日记」补全嵌入。'
            ),
        { duration: 8000 }
      )
    })

    return unsubscribe
  }, [t, toast])

  return null
}

import { ErrorBoundary } from './ErrorBoundary'
import { DesktopSettingsOverlayContext } from './layouts/desktop-settings-overlay.context'
import { SettingsOverlayHost } from './layouts/SettingsOverlayHost'

function sameRouteLocation(
  a: { pathname: string; search?: string },
  b: { pathname: string; search?: string }
): boolean {
  return a.pathname === b.pathname && (a.search || '') === (b.search || '')
}

const AppRoutes = () => {
  const location = useLocation()
  const { closeAll } = useDialog()
  const [backgroundLocation, setBackgroundLocation] = useState(() => {
    if (location.pathname.startsWith('/settings')) {
      return { ...location, pathname: '/diary', state: null, key: 'default' }
    }
    return location
  })
  const isSettings = location.pathname.startsWith('/settings')
  const [settingsLocation, setSettingsLocation] = useState(location)
  const [settingsOverlayEpoch, setSettingsOverlayEpoch] = useState(0)
  // 打开设置时立即用当前 hash location，避免首帧 settingsLocation 仍是业务页导致空白闪一下
  const overlaySettingsLocation = isSettings ? location : settingsLocation
  const vaultScopeRevision = useSyncExternalStore(
    subscribeDesktopVaultScope,
    getDesktopVaultScopeRevision
  )
  const prevVaultScopeRevisionRef = useRef(vaultScopeRevision)
  const backgroundLocationRef = useRef(backgroundLocation)
  backgroundLocationRef.current = backgroundLocation

  useEffect(() => {
    if (prevVaultScopeRevisionRef.current === vaultScopeRevision) return
    prevVaultScopeRevisionRef.current = vaultScopeRevision
    if (vaultScopeRevision === 0) return

    const settingsStore = useSettingsStore.getState()
    settingsStore.resetSettingsConfigCache()
    settingsStore.scheduleDeferredConfigWarmup()
    setSettingsOverlayEpoch((epoch) => epoch + 1)
  }, [vaultScopeRevision])

  useEffect(() => {
    if (isSettings) {
      setSettingsLocation(location)
    }
  }, [isSettings, location])

  // 路由变化时关闭所有弹窗（依赖稳定的 closeAll，避免 dialog 对象引用抖动导致死循环）
  useEffect(() => {
    closeAll()
  }, [location.pathname, closeAll])

  useEffect(() => {
    if (!location.pathname.startsWith('/settings')) {
      // 路径未变时保留冻结 location，避免设置返回后 Routes 换 key 触发 MainLayout 重挂载闪烁
      setBackgroundLocation((prev) => (sameRouteLocation(prev, location) ? prev : location))
    } else if (!backgroundLocationRef.current.pathname.startsWith('/settings')) {
      rememberSettingsReturnPath(locationToReturnPath(backgroundLocationRef.current))
    }
  }, [location])

  // 设置 overlay 打开时用冻结底层；关闭后若回到同一路径，继续用冻结对象避免闪一下
  const mainRoutesLocation =
    isSettings || sameRouteLocation(backgroundLocation, location) ? backgroundLocation : location
  const mountSettingsHost = !location.pathname.startsWith('/welcome')

  return (
    <DesktopSettingsOverlayContext.Provider value={isSettings}>
      <Suspense fallback={null}>
        <Routes location={mainRoutesLocation}>
          <Route path="/welcome" element={<OnboardingScreen />} />

          <Route element={<MainLayout />}>
            <Route path="/" element={<HomeScreen />} />

            {/* Main Business Logic Sub-Routes — 列表页由 MainPageCache 保活 */}
            <Route path="/diary" element={<CachedRoutePlaceholder />} />
            <Route path="/diary/:dateStr" element={<DiaryEditorPage />} />
            <Route path="/summary" element={<CachedRoutePlaceholder />} />
            <Route path="/summary/:id" element={<SummaryDetailPage />} />
            <Route path="/graph" element={<CachedRoutePlaceholder />} />

            {/* Tools Routing */}
            <Route path="/lan-transfer" element={<Navigate to="/hub/lan-transfer" replace />} />
            <Route path="/data-sync" element={<CachedRoutePlaceholder />} />
            <Route path="/incremental-sync" element={<CachedRoutePlaceholder />} />
            <Route path="/git" element={<CachedRoutePlaceholder />} />

            {/* 日记区侧边栏内嵌设置（非全屏 overlay） */}
            <Route path="/hub/*" element={<CachedRoutePlaceholder />} />

            {/* AI / Agent Role Routing - 由 MainPageCache 保活 */}
            <Route path="/chat/*" element={<CachedRoutePlaceholder />} />
            <Route path="/agent-workspace/*" element={<CachedRoutePlaceholder />} />
            <Route path="/sessions" element={<SessionManagementScreen />} />
            <Route path="/assistants" element={<AssistantManagementScreen />} />
            <Route path="/assistants/:id" element={<AssistantEditScreen />} />
          </Route>
        </Routes>
      </Suspense>

      {mountSettingsHost ? (
        <SettingsOverlayHost
          visible={isSettings}
          settingsLocation={overlaySettingsLocation}
          remountKey={settingsOverlayEpoch}
        />
      ) : null}
    </DesktopSettingsOverlayContext.Provider>
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
    markRendererStartup('App.mount')
    // 首屏后再放开冷启动全量扫盘，避免与 Vite 模块求值抢资源
    void (window as any).api?.vault
      ?.releaseColdStartResync?.('App.mount')
      ?.then?.((released: boolean) => {
        markRendererStartup('App.coldStartResync-release', { released })
      })
  }, [])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    void import('./dev/memory-leak-probe').then((m) => m.installMemoryLeakProbe())
  }, [])

  useEffect(() => {
    initDesktopRendererCacheCoordinator()
    let cancelled = false
    void traceRendererStep('App.initDesktopVaultScope', () => initDesktopVaultScope()).then(() => {
      if (!cancelled) {
        useSettingsStore.getState().scheduleDeferredConfigWarmup()
        markRendererStartup('App.deferredConfigWarmup-scheduled')
      }
    })
    const unsub = (window as any).api?.cache?.onDomainMutation?.((event: DomainMutationEvent) => {
      handleRendererDomainMutation(event)
      if (event.domain === 'vault' && event.action === 'switch') {
        if (event.reason === 'storage-root-changed') {
          void refreshDesktopVaultScopeAfterStorageRootChange()
        } else if (event.vaultKey) {
          setDesktopVaultScopeKey(event.vaultKey)
        }
      }
    })
    return () => {
      cancelled = true
      unsub?.()
      useSettingsStore.getState().cancelDeferredConfigWarmup()
    }
  }, [])

  useEffect(() => {
    ensureDesktopAgentGateInboxBridge()
    ensureDesktopAgentGateNotificationBridge()
  }, [])

  useEffect(() => {
    const unsub = (window as any).api?.storage?.onRootChanged?.(() => {
      void refreshDesktopVaultScopeAfterStorageRootChange()
    })
    return unsub
  }, [])

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

  // 确保 store 中持久化的语言设置在每次启动时同步到 i18n，并挂上 html[lang] / 区域字体
  useEffect(() => {
    const lang =
      locale === 'system' ? resolveAppLanguage(navigator.language) : resolveAppLanguage(locale)
    document.documentElement.lang = lang
    void ensureUiFontForLanguage(lang)
    if (i18n.language !== lang) {
      void i18n.changeLanguage(lang)
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

  // 只应用 CSS；历史色归一不在 effect 里写回 store，避免 Zustand 更新环
  useEffect(() => {
    const resolved = resolveThemeColor(themeColor)
    if (resolved !== themeColor) {
      // 空闲时一次性持久化，不阻塞当前渲染提交
      queueMicrotask(() => {
        if (useSettingsStore.getState().themeColor !== resolved) {
          useSettingsStore.getState().setThemeColor(resolved)
        }
      })
    }
    document.documentElement.style.setProperty('--color-primary', resolved)
    let hex = resolved.replace('#', '')
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
      document.documentElement.style.setProperty(
        '--color-primary-light',
        `rgba(${r}, ${g}, ${b}, 0.18)`
      )
    }
  }, [themeColor])

  return (
    <HashRouter>
      <NetworkProvider>
        <DialogProvider>
          <ToastProvider />
          <RestoreBlockingOverlay visible={archiveImporting} />
          <GlobalErrorHandler />
          <DesktopLegacyMigrationPrompt />
          <DiaryEmbedFailureNotifier />
          <GlobalInputContextMenu />
          <ErrorBoundary>
            <AppShell />
          </ErrorBoundary>
        </DialogProvider>
      </NetworkProvider>
    </HashRouter>
  )
}
