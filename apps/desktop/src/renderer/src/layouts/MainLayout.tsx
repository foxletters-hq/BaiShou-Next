import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Sidebar } from '../components/Sidebar'
import styles from './MainLayout.module.css'
import { MainPageCache, getMainPageCacheKey } from './MainPageCache'
import { isSettingsHubPath } from '../features/settings/settings-route.util'
import { isAgentWorkspaceKnowledgeDetailPath } from '../features/agent-workspace/utils/agent-workspace-route.util'
import {
  getDesktopVaultScopeRevision,
  subscribeDesktopVaultScope
} from '../cache/desktop-vault-scope'
import {
  ROUTE_SWITCH_MASK_SECONDS,
  nextMountedCacheKeys,
  shouldShowRouteSwitchMask
} from './route-switch-mask.util'
import { consumeWorkbenchEditorMouseNav } from '../features/agent-workspace/workbench/workbench-editor-mouse-nav'

export const MainLayout: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const vaultScopeRevision = useSyncExternalStore(
    subscribeDesktopVaultScope,
    getDesktopVaultScopeRevision
  )
  const cacheKey = getMainPageCacheKey(location.pathname)
  const showOutlet = cacheKey === null
  // 日记/总结二级页：隐藏底座列表，避免与 Outlet 叠层。设置全屏 overlay 不隐藏底座——
  // overlay 已有更高 z-index 盖住即可；hidden 再显示会造成伙伴页闪烁。
  const hideCacheForSubRoute =
    showOutlet &&
    (location.pathname.startsWith('/diary/') ||
      location.pathname.startsWith('/summary/') ||
      isAgentWorkspaceKnowledgeDetailPath(location.pathname))

  useEffect(() => {
    const onMouseNav = (direction: 'back' | 'forward') => {
      if (consumeWorkbenchEditorMouseNav(direction)) return
      if (direction === 'back') window.history.back()
      else window.history.forward()
    }
    const onMouseUp = (event: MouseEvent) => {
      if (event.button !== 3 && event.button !== 4) return
      event.preventDefault()
      event.stopPropagation()
      onMouseNav(event.button === 3 ? 'back' : 'forward')
    }
    const onAppCommand = (_event: unknown, payload: { direction?: 'back' | 'forward' }) => {
      if (payload?.direction !== 'back' && payload?.direction !== 'forward') return
      onMouseNav(payload.direction)
    }
    window.addEventListener('mouseup', onMouseUp, true)
    const unsubscribe = window.electron?.ipcRenderer?.on?.(
      'workbench:editor-mouse-nav',
      onAppCommand
    )
    return () => {
      window.removeEventListener('mouseup', onMouseUp, true)
      unsubscribe?.()
    }
  }, [])

  // 当处于日记编辑或总结详情等二级子页面时，保持对应底座页面挂载，但隐藏以免与 Outlet 叠层闪烁
  let activeCacheKey = cacheKey
  if (location.pathname === '/') {
    activeCacheKey = '/diary'
  } else if (location.pathname.startsWith('/chat')) {
    activeCacheKey = '/chat'
  } else if (location.pathname.startsWith('/agent-workspace')) {
    activeCacheKey = '/agent-workspace'
  } else if (location.pathname.startsWith('/diary/')) {
    activeCacheKey = '/diary'
  } else if (location.pathname.startsWith('/summary/')) {
    activeCacheKey = '/summary'
  } else if (isSettingsHubPath(location.pathname)) {
    activeCacheKey = '/hub'
  }

  const prevVaultScopeRevisionRef = useRef(vaultScopeRevision)
  const prevCacheKeyRef = useRef<string | null>(null)
  const mountedKeysRef = useRef<Set<string>>(nextMountedCacheKeys(new Set(), activeCacheKey))
  const routeMaskSeqRef = useRef(0)
  // 遮罩必须活到淡出动画结束：一旦同一次 effect 里清掉上一页 key，条件就会立刻变 false，
  // 遮罩在首帧前被卸载，有背景图时能明显看出伙伴页是硬切的。
  const [routeMask, setRouteMask] = useState<{ id: number; from: string; to: string } | null>(null)

  useLayoutEffect(() => {
    const previousKey = prevCacheKeyRef.current
    const nextKey = activeCacheKey

    if (
      previousKey &&
      nextKey &&
      shouldShowRouteSwitchMask({
        previousKey,
        nextKey,
        mountedKeys: mountedKeysRef.current
      })
    ) {
      routeMaskSeqRef.current += 1
      setRouteMask({ id: routeMaskSeqRef.current, from: previousKey, to: nextKey })
    } else {
      setRouteMask(null)
    }

    prevCacheKeyRef.current = nextKey
    mountedKeysRef.current = nextMountedCacheKeys(mountedKeysRef.current, nextKey)
  }, [activeCacheKey])

  useEffect(() => {
    if (prevVaultScopeRevisionRef.current === vaultScopeRevision) return
    prevVaultScopeRevisionRef.current = vaultScopeRevision
    if (vaultScopeRevision === 0) return

    if (location.pathname.startsWith('/diary/') || location.pathname.startsWith('/summary/')) {
      navigate(location.pathname.startsWith('/summary/') ? '/summary' : '/diary', { replace: true })
    }
  }, [vaultScopeRevision, location.pathname, navigate])

  return (
    <div className={styles.appContainer}>
      <div className={styles.mainContent} data-baishou-main-card>
        <Sidebar />
        <div className={styles.pageContent}>
          <MainPageCache
            activeKey={activeCacheKey}
            vaultScopeRevision={vaultScopeRevision}
            hideActiveWhenOverlay={hideCacheForSubRoute}
          />

          <AnimatePresence mode="wait">
            {showOutlet && (
              <motion.div
                key={location.pathname.startsWith('/chat') ? '/chat' : location.pathname}
                initial={{ opacity: 1, y: 0 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 1, y: 0 }}
                transition={{ duration: 0 }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  zIndex: 10,
                  backgroundColor: 'var(--bg-app)'
                }}
              >
                <Outlet />
              </motion.div>
            )}
          </AnimatePresence>

          {routeMask ? (
            <motion.div
              key={routeMask.id}
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ duration: ROUTE_SWITCH_MASK_SECONDS, ease: 'easeOut' }}
              onAnimationComplete={() => {
                setRouteMask((current) => (current?.id === routeMask.id ? null : current))
              }}
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: 'var(--bg-app)',
                pointerEvents: 'none',
                zIndex: 50
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
