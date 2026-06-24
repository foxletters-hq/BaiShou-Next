// Inject Core CSS Design System directly from the UI library
import '@baishou/ui/theme/css-variables.css'
import './styles/variables.css'
import './styles/index.css'
// 必须最早导入，确保 i18n 在任何组件渲染前初始化
import '@baishou/shared'

window.onerror = (message, _s, _l, _c, error) => {
  console.error('[renderer] uncaught error:', message, error)
}

window.addEventListener('unhandledrejection', (event) => {
  console.error('[renderer] unhandled promise rejection:', event.reason)
})
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
