// Inject Core CSS Design System directly from the UI library
import '@baishou/ui/theme/css-variables.css'
import '@baishou/ui/theme/lucide-icons.css'
import './styles/variables.css'
import './styles/fonts'
import './styles/index.css'
// 必须最早导入，确保 i18n 在任何组件渲染前初始化
import '@baishou/shared'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { markRendererStartup } from './startup-trace'

markRendererStartup('app-bootstrap.imports-evaluated')

window.onerror = (message, _s, _l, _c, error) => {
  console.error('[renderer] uncaught error:', message, error)
}

window.addEventListener('unhandledrejection', (event) => {
  console.error('[renderer] unhandled promise rejection:', event.reason)
})

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('[renderer] #root missing')
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>
)

markRendererStartup('app-bootstrap.createRoot-called')
