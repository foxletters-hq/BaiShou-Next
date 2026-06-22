import { Stack, Redirect } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native'

import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  NativeDiaryCodeMirrorEditor,
  NativeImagePreviewModal,
  extractDiaryAttachmentSrcs,
  useNativeTheme,
  type NativeDiaryCodeMirrorEditorHandle
} from '@baishou/ui/native'
import { useBaishou } from '@/src/providers/BaishouProvider'
import { useDiaryEditorWebViewSource } from '@/src/hooks/useDiaryEditorWebViewSource'
import { resolveDiaryAttachmentUrlForWebView } from '@/src/services/diary-cm-attachment-url.service'
import { useAttachmentImageLoader } from '@/src/hooks/useAttachmentImageLoader'
import { fadeStackAnimation } from '@/src/navigation/fadeStackAnimation'

const POC_DATE = new Date(2026, 5, 22)

const SAMPLE_MARKDOWN = `# CodeMirror POC

这是一段带附件的测试日记。

![示例图](attachment/sample.png | 283)

第二段文字，用于验证 Live Preview 与编辑回传。

![另一张](attachment/demo.jpg)
`

export default function DiaryCmPocScreen() {
  if (!__DEV__) {
    return <Redirect href="/(tabs)" />
  }

  const insets = useSafeAreaInsets()
  const { colors } = useNativeTheme()
  const { services } = useBaishou()
  const editorRef = useRef<NativeDiaryCodeMirrorEditorHandle>(null)
  const editorWebViewSource = useDiaryEditorWebViewSource()
  const [content, setContent] = useState(SAMPLE_MARKDOWN)
  const [selection, setSelection] = useState({ start: 0, end: 0 })
  const [previewUri, setPreviewUri] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const attachmentCacheRef = useRef<Record<string, string>>({})
  const { loadImageUri } = useAttachmentImageLoader(services?.fileSystem)

  useEffect(() => {
    if (editorWebViewSource === null && !loadError) {
      const timer = setTimeout(() => {
        setLoadError('无法加载 diary-editor HTML（请 pnpm run build:diary-editor）')
      }, 8000)
      return () => clearTimeout(timer)
    }
    if (editorWebViewSource) setLoadError(null)
  }, [editorWebViewSource, loadError])

  useEffect(() => {
    if (!services?.pathService || !services?.fileSystem) return
    const srcs = extractDiaryAttachmentSrcs(content)
    let cancelled = false
    void (async () => {
      const map: Record<string, string> = { ...attachmentCacheRef.current }
      for (const src of srcs) {
        if (map[src]) continue
        const dataUri = await resolveDiaryAttachmentUrlForWebView(
          services.pathService!,
          services.fileSystem,
          POC_DATE,
          src,
          (absPath) => loadImageUri(absPath, 'preview')
        )
        if (dataUri) map[src] = dataUri
      }
      if (!cancelled) {
        attachmentCacheRef.current = map
      }
    })()
    return () => {
      cancelled = true
    }
  }, [content, loadImageUri, services?.fileSystem, services?.pathService])

  const resolveAttachmentUrl = useCallback(
    async (srcRaw: string) => {
      if (!srcRaw.startsWith('attachment/')) return srcRaw
      const cached = attachmentCacheRef.current[srcRaw]
      if (cached) return cached
      if (!services?.pathService || !services?.fileSystem) return null
      const url = await resolveDiaryAttachmentUrlForWebView(
        services.pathService,
        services.fileSystem,
        POC_DATE,
        srcRaw,
        (absPath) => loadImageUri(absPath, 'preview')
      )
      if (url) {
        attachmentCacheRef.current = { ...attachmentCacheRef.current, [srcRaw]: url }
      }
      return url
    },
    [loadImageUri, services?.fileSystem, services?.pathService]
  )

  const attachmentSummary = useMemo(() => {
    const srcs = extractDiaryAttachmentSrcs(content)
    return srcs.length ? srcs.join(', ') : '（无 attachment）'
  }, [content])

  return (
    <>
      <Stack.Screen
        options={{
          title: 'CM 编辑器 POC',
          headerShown: true,
          ...fadeStackAnimation
        }}
      />
      <View style={[styles.root, { backgroundColor: colors.bgApp, paddingTop: insets.top }]}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            临时 POC：验证 WebView 桥接。路由 /diary-cm-poc
          </Text>

          <View style={styles.toolbar}>
            <Pressable
              style={[styles.btn, { backgroundColor: colors.primary }]}
              onPress={() => editorRef.current?.insertAtCursor('\n\n**插入测试**\n')}
            >
              <Text style={styles.btnText}>插入文本</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, { backgroundColor: colors.bgSurface, borderColor: colors.borderSubtle }]}
              onPress={() => editorRef.current?.focusAtOffset(content.length)}
            >
              <Text style={[styles.btnText, { color: colors.textPrimary }]}>聚焦末尾</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, { backgroundColor: colors.bgSurface, borderColor: colors.borderSubtle }]}
              onPress={() => editorRef.current?.blur()}
            >
              <Text style={[styles.btnText, { color: colors.textPrimary }]}>失焦</Text>
            </Pressable>
          </View>

          <Text style={[styles.meta, { color: colors.textTertiary }]}>
            选区 {selection.start}–{selection.end} · 附件 {attachmentSummary}
          </Text>

          {loadError ? (
            <Text style={[styles.error, { color: colors.warning }]}>{loadError}</Text>
          ) : !editorWebViewSource ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : (
            <NativeDiaryCodeMirrorEditor
              ref={editorRef}
              editorWebViewSource={editorWebViewSource}
              content={content}
              placeholder="写日记…"
              onChange={setContent}
              onSelectionChange={(start, end) => setSelection({ start, end })}
              resolveAttachmentUrl={resolveAttachmentUrl}
              onImagePreview={(_srcRaw, resolvedUrl) => setPreviewUri(resolvedUrl)}
            />
          )}

          <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>RN 侧 content 快照</Text>
          <Text style={[styles.snapshot, { color: colors.textPrimary, backgroundColor: colors.bgSurface }]}>
            {content}
          </Text>
        </ScrollView>
      </View>

      <NativeImagePreviewModal uri={previewUri} onClose={() => setPreviewUri(null)} />
    </>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 8
  },
  hint: {
    fontSize: 13,
    marginBottom: 12
  },
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8
  },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth
  },
  btnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600'
  },
  meta: {
    fontSize: 12,
    marginBottom: 8
  },
  loader: {
    marginVertical: 48
  },
  error: {
    marginVertical: 16,
    fontSize: 14
  },
  previewLabel: {
    marginTop: 16,
    marginBottom: 6,
    fontSize: 13,
    fontWeight: '600'
  },
  snapshot: {
    fontSize: 12,
    lineHeight: 18,
    padding: 12,
    borderRadius: 8,
    fontFamily: 'monospace'
  }
})
