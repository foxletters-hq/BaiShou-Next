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
  /** bundle 版本戳，用于强制 WebView 在热更新后重新挂载 */
  cacheKey: string
}

const FEATURE_MARKER = 'live-preview-inline-fenced-v19'

function logStaging(message: string, detail?: Record<string, unknown>): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return
  const extra = detail ? ` ${JSON.stringify(detail)}` : ''
  console.log(`[DiaryEditor] ${message}${extra}`)
}

function makeSource(fingerprint: string): DiaryEditorWebViewSource {
  return {
    uri: STAGING_HTML,
    baseUrl: STAGING_DIR,
    cacheKey: fingerprint
  }
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

const BUILD_STAMP_RE = /diary-editor-build:([^\s-]+)/

async function buildFingerprint(htmlUri: string, bundleUri: string): Promise<string> {
  const [htmlInfo, bundleInfo, shellHtml] = await Promise.all([
    getInfoAsync(htmlUri),
    getInfoAsync(bundleUri),
    readAsStringAsync(htmlUri).catch(() => '')
  ])
  const htmlSize = htmlInfo.exists && 'size' in htmlInfo ? (htmlInfo.size ?? 0) : 0
  const bundleSize = bundleInfo.exists && 'size' in bundleInfo ? (bundleInfo.size ?? 0) : 0
  const bundleMtime =
    bundleInfo.exists && 'modificationTime' in bundleInfo ? (bundleInfo.modificationTime ?? 0) : 0
  const buildStamp = shellHtml.match(BUILD_STAMP_RE)?.[1] ?? ''
  return `${buildStamp}:${htmlSize}:${bundleSize}:${bundleMtime}`
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

async function readBundledAssetContent(
  htmlUri: string,
  bundleUri: string
): Promise<{ shellHtml: string; bundleJs: string; fingerprint: string } | null> {
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

  if (bundleJs.length < MIN_BUNDLE_CHARS || !bundleJs.includes('__diaryCmOnNativeMessage')) {
    console.error(
      `[DiaryEditor] diary-editor.bundle 无效（${bundleJs.length} chars）。请重新 build:diary-editor`
    )
    return null
  }

  const fingerprint = await buildFingerprint(htmlUri, bundleUri)
  return { shellHtml, bundleJs, fingerprint }
}

async function isStagedBundleCurrent(fingerprint: string, assetBundleSize: number): Promise<boolean> {
  try {
    const [stagedHtmlInfo, stagedBundleInfo, savedFingerprint] = await Promise.all([
      getInfoAsync(STAGING_HTML),
      getInfoAsync(STAGING_BUNDLE),
      readAsStringAsync(FINGERPRINT_FILE).catch(() => null)
    ])
    const stagedBundleSize =
      stagedBundleInfo.exists && 'size' in stagedBundleInfo ? (stagedBundleInfo.size ?? 0) : 0
    if (stagedBundleSize !== assetBundleSize) {
      return false
    }
    return (
      stagedHtmlInfo.exists &&
      stagedBundleInfo.exists &&
      savedFingerprint === fingerprint &&
      stagedBundleSize >= MIN_BUNDLE_CHARS
    )
  } catch {
    return false
  }
}

async function readDiaryEditorWebViewSource(): Promise<DiaryEditorWebViewSource | null> {
  try {
    const [htmlUri, bundleUri] = await Promise.all([
      // RN/Metro 静态资源只能通过 require 加载（无法用 ESM import）
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      readAssetUri(require('../../assets/diary-editor/index.html')),
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      readAssetUri(require('../../assets/diary-editor/diary-editor.bundle'))
    ])

    if (!htmlUri || !bundleUri) {
      console.error('[DiaryEditor] WebView asset URI missing (html or bundle)')
      return null
    }

    const fingerprint = await buildFingerprint(htmlUri, bundleUri)
    const bundleInfo = await getInfoAsync(bundleUri)
    const assetBundleSize =
      bundleInfo.exists && 'size' in bundleInfo ? (bundleInfo.size ?? 0) : 0
    const stagedCurrent = await isStagedBundleCurrent(fingerprint, assetBundleSize)
    if (stagedCurrent) {
      const [stagedBundleJs, stagedShellHtml] = await Promise.all([
        readAsStringAsync(STAGING_BUNDLE).catch(() => ''),
        readAsStringAsync(STAGING_HTML).catch(() => '')
      ])
      const hasFeatureMarker = stagedBundleJs.includes(FEATURE_MARKER)
      logStaging('WebView bundle 已缓存（磁盘 staging 与 asset 指纹一致）', {
        fingerprint,
        stagedBundleBytes: stagedBundleJs.length,
        hasFeatureMarker,
        buildStamp: stagedShellHtml.match(BUILD_STAMP_RE)?.[1] ?? '(none)'
      })
      if (!hasFeatureMarker) {
        console.warn(
          `[DiaryEditor] staging bundle 缺少 ${FEATURE_MARKER}，将强制重新复制。请确认已执行 build:diary-editor`
        )
      } else {
        return makeSource(fingerprint)
      }
    }

    const bundled = await readBundledAssetContent(htmlUri, bundleUri)
    if (!bundled) return null

    const hasFeatureMarker = bundled.bundleJs.includes(FEATURE_MARKER)
    if (!hasFeatureMarker) {
      console.error(
        `[DiaryEditor] asset bundle 缺少 ${FEATURE_MARKER}，表格改动未打进包。请执行: cd apps/mobile && pnpm run build:diary-editor`
      )
    }

    await stageDiaryEditorBundle(htmlUri, bundleUri, bundled.fingerprint)
    logStaging('已复制 WebView bundle 到 staging', {
      fingerprint: bundled.fingerprint,
      shellChars: bundled.shellHtml.length,
      bundleChars: bundled.bundleJs.length,
      hasFeatureMarker,
      buildStamp: bundled.shellHtml.match(BUILD_STAMP_RE)?.[1] ?? '(none)',
      uri: STAGING_HTML
    })

    return makeSource(bundled.fingerprint)
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

/** 懒加载 WebView HTML（首次进入编辑器时调用） */
export function preloadDiaryEditorWebViewSource(): Promise<DiaryEditorWebViewSource | null> {
  // 开发态每次进入编辑器都重新校验 bundle，避免 Metro / 内存缓存导致 WebView 仍用旧版
  if (cachedSource && (typeof __DEV__ === 'undefined' || !__DEV__)) {
    return Promise.resolve(cachedSource)
  }
  if (!preloadPromise || (typeof __DEV__ !== 'undefined' && __DEV__)) {
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
