import React, { lazy, Suspense } from 'react'
import { Routes, Route, type Location } from 'react-router-dom'

const SettingsPage = lazy(() =>
  import('../features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage }))
)

type SettingsOverlayHostProps = {
  visible: boolean
  settingsLocation: Location
  remountKey: number
}

/**
 * 全屏设置 overlay：应用进入主界面后即挂载（隐藏），打开时仅显示，避免每次切设置都重建整页。
 */
export const SettingsOverlayHost: React.FC<SettingsOverlayHostProps> = ({
  visible,
  settingsLocation,
  remountKey
}) => {
  return (
    <div
      key={remountKey}
      hidden={!visible}
      aria-hidden={!visible}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 100,
        display: visible ? 'flex' : 'none',
        flexDirection: 'column',
        pointerEvents: visible ? 'auto' : 'none'
      }}
    >
      <Routes location={settingsLocation}>
        <Route
          path="/settings/*"
          element={
            <Suspense fallback={null}>
              <SettingsPage />
            </Suspense>
          }
        />
      </Routes>
    </div>
  )
}
