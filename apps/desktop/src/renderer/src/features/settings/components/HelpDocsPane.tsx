import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink } from 'lucide-react'
import { HELP_DOCS_QUICK_START_URL } from '@baishou/shared'
import { Button, SettingsPageChrome } from '@baishou/ui'
import {
  isHelpDocsMainFrameFailure,
  isHelpDocsSuccessfulDocumentUrl,
  isHelpDocsWebviewHost,
  readHelpDocsWebviewUrl,
  type HelpDocsWebviewFailLoad
} from '../help-docs-webview.util'
import styles from './HelpDocsPane.module.css'

export const HelpDocsPane: React.FC = () => {
  const { t } = useTranslation()
  const hostRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const webview = document.createElement('webview')
    webview.setAttribute('src', HELP_DOCS_QUICK_START_URL)
    webview.setAttribute('allowpopups', 'true')
    webview.setAttribute('webpreferences', 'contextIsolation=yes, nodeIntegration=no, sandbox=yes')
    webview.className = styles.webview
    const onFail = (event: Event) => {
      if (isHelpDocsMainFrameFailure(event as HelpDocsWebviewFailLoad)) {
        setFailed(true)
      }
    }
    const onLoaded = () => {
      if (
        isHelpDocsWebviewHost(webview) &&
        isHelpDocsSuccessfulDocumentUrl(readHelpDocsWebviewUrl(webview))
      ) {
        setFailed(false)
      }
    }
    webview.addEventListener('did-fail-load', onFail)
    webview.addEventListener('did-finish-load', onLoaded)
    host.appendChild(webview)
    return () => {
      webview.removeEventListener('did-fail-load', onFail)
      webview.removeEventListener('did-finish-load', onLoaded)
      webview.remove()
    }
  }, [])

  const openInBrowser = () => {
    void window.api.shell.openExternal(HELP_DOCS_QUICK_START_URL)
  }

  return (
    <SettingsPageChrome
      className={styles.pageFill}
      title={t('settings.help_docs', '使用教程')}
      layout="stack"
      trailing={
        <Button type="button" variant="outlined" size="small" onClick={openInBrowser}>
          <ExternalLink size={14} />
          {t('settings.help_docs_open_browser', '在浏览器中打开')}
        </Button>
      }
      bodyClassName={styles.frameBody}
    >
      <div ref={hostRef} className={styles.frame} />
      {failed ? (
        <div className={styles.fallback} role="status">
          <p>{t('settings.help_docs_load_failed', '教程页未能在应用内打开。')}</p>
          <Button type="button" variant="outlined" size="small" onClick={openInBrowser}>
            {t('settings.help_docs_open_browser', '在浏览器中打开')}
          </Button>
        </div>
      ) : null}
    </SettingsPageChrome>
  )
}
