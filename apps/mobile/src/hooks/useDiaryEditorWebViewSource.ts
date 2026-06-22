import { useEffect, useState } from 'react'
import { Asset } from 'expo-asset'
import {
  copyAsync,
  documentDirectory,
  getInfoAsync,
  makeDirectoryAsync,
  readAsStringAsync,
  writeAsStringAsync
} from 'expo-file-system/legacy'

const STAGING_DIR = `${documentDirectory}diary-editor-web/`
const STAGING_HTML = `${STAGING_DIR}index.html`
const STAGING_BUNDLE = `${STAGING_DIR}diary-editor.bundle`
const FINGERPRINT_FILE = `${STAGING_DIR}.fingerprint`

const MIN_BUNDLE_CHARS = 100_000
const MAX_SHELL_HTML_CHARS = 8_192

export interface DiaryEditorWebViewSource {
  /** 同目录下的 index.html（file://） */
  uri: string
  /** WebView baseUrl，须与 bundle 同目录 */
  baseUrl: string
}

let cachedSource: DiaryEditorWebViewSource | null = null
let preloadPromise: Promise<DiaryEditorWebViewSource | null> | null = null

function isValidShellHtml(html: string): boolean {
  return (
    html.length > 0 &&
    html.length <= MAX_SHELL_HTML_CHARS &&
    html.includes('diary-editor.bundle') &&
    !html.includes('__diaryCmOnNativeMessage')
  )
}

async function readAssetUri(moduleId: number): Promise<string | null> {
  const asset = Asset.fromModule(moduleId)
  await asset.downloadAsync()
  return asset.localUri ?? asset.uri ?? null
}

async function buildFingerprint(htmlUri: string, bundleUri: string): Promise<string> {
  const [htmlInfo, bundleInfo] = await Promise.all([
    getInfoAsync(htmlUri, { size: true }),
    getInfoAsync(bundleUri, { size: true })
  ])
  return `${htmlInfo.size ?? 0}:${bundleInfo.size ?? 0}:${bundleInfo.modificationTime ?? 0}`
}

async function stageDiaryEditorBundle(
  htmlUri: string,
  bundleUri: string,
  fingerprint: string
): Promise<void> {
  await makeDirectoryAsync(STAGING_DIR, { intermediates: true })
  await copyAsync({ from: htmlUri, to: STAGING_HTML })
  await copyAsync({ from: bundleUri, to: STAGING_BUNDLE })
  await writeAsStringAsync(FINGERPRINT_FILE, fingerprint)
}

async function readDiaryEditorWebViewSource(): Promise<DiaryEditorWebViewSource | null> {
  try {
    const [htmlUri, bundleUri] = await Promise.all([
      readAssetUri(require('../../assets/diary-editor/index.html')),
      readAssetUri(require('../../assets/diary-editor/diary-editor.bundle'))
    ])

    if (!htmlUri || !bundleUri) {
      console.error('[DiaryEditor] WebView asset URI missing (html or bundle)')
      return null
    }

    const [shellHtml, bundleJs] = await Promise.all([
      readAsStringAsync(htmlUri),
      readAsStringAsync(bundleUri)
    ])

    if (!isValidShellHtml(shellHtml)) {
      console.error(
        `[DiaryEditor] index.html 无效（${shellHtml.length} chars）。请执行: cd apps/mobile && pnpm run build:diary-editor 后重启 Metro`
      )
      return null
    }

    if (
      bundleJs.length < MIN_BUNDLE_CHARS ||
      !bundleJs.includes('__diaryCmOnNativeMessage')
    ) {
      console.error(
        `[DiaryEditor] diary-editor.bundle 无效（${bundleJs.length} chars）。请重新 build:diary-editor`
      )
      return null
    }

    const fingerprint = await buildFingerprint(htmlUri, bundleUri)
    let needsStage = true

    try {
      const [stagedHtmlInfo, stagedBundleInfo, savedFingerprint] = await Promise.all([
        getInfoAsync(STAGING_HTML),
        getInfoAsync(STAGING_BUNDLE),
        readAsStringAsync(FINGERPRINT_FILE).catch(() => null)
      ])
      needsStage =
        !stagedHtmlInfo.exists ||
        !stagedBundleInfo.exists ||
        savedFingerprint !== fingerprint
    } catch {
      needsStage = true
    }

    if (needsStage) {
      await stageDiaryEditorBundle(htmlUri, bundleUri, fingerprint)
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('[DiaryEditor] 已复制 WebView bundle 到同目录:', STAGING_DIR)
      }
    }

    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log(
        `[DiaryEditor] WebView bundle 就绪: shell=${shellHtml.length} chars, js=${bundleJs.length}, uri=${STAGING_HTML}`
      )
    }

    return {
      uri: STAGING_HTML,
      baseUrl: STAGING_DIR
    }
  } catch (error) {
    console.error('[DiaryEditor] Failed to stage diary-editor WebView bundle:', error)
    return null
  }
}

/** 清除预加载缓存（校验逻辑更新或 bundle 重建后需要） */
export function resetDiaryEditorWebViewSourceCache(): void {
  cachedSource = null
  preloadPromise = null
}

/** 全局预加载 WebView HTML（P-4） */
export function preloadDiaryEditorWebViewSource(): Promise<DiaryEditorWebViewSource | null> {
  if (cachedSource) return Promise.resolve(cachedSource)
  if (!preloadPromise) {
    preloadPromise = readDiaryEditorWebViewSource().then((source) => {
      if (source) {
        cachedSource = source
      } else {
        preloadPromise = null
      }
      return source
    })
  }
  return preloadPromise
}

export function useDiaryEditorWebViewSource(): DiaryEditorWebViewSource | null {
  const [source, setSource] = useState<DiaryEditorWebViewSource | null>(cachedSource)

  useEffect(() => {
    let cancelled = false
    void preloadDiaryEditorWebViewSource().then((resolved) => {
      if (!cancelled) setSource(resolved)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return source
}
