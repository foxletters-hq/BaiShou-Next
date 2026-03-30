import React, { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useSettingsStore } from '@baishou/store'
import { ErrorBoundary } from './components/ErrorBoundary'
import { MainLayout } from './layouts/MainLayout'
import { HomePage } from './features/home/HomePage'
import { DiaryPage } from './features/diary/DiaryPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { StoragePage } from './features/storage/StoragePage'
import { SummaryPage } from './features/summary/SummaryPage'
import { OnboardingPage } from './features/onboarding/OnboardingPage'

import './styles/index.css'

export const App: React.FC = () => {
  // 恢复原始的安全获取方法
  const result = useSettingsStore()
  const themeMode = result?.themeMode || 'dark'

  useEffect(() => {
    if (themeMode) {
      document.documentElement.setAttribute('data-theme', themeMode)
    }
  }, [themeMode])

  return (
    <ErrorBoundary>
      <HashRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Navigate to="/home" replace />} />
            <Route path="home" element={<HomePage />} />
            <Route path="diary" element={<DiaryPage />} />
            <Route path="summary" element={<SummaryPage />} />
            <Route path="storage" element={<StoragePage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="/onboarding" element={<OnboardingPage />} />
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  )
}
