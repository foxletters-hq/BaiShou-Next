import React, { useCallback, useEffect, useState } from 'react'
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StatusBar
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useNativeTheme, Button } from '@baishou/ui/native'
import type { IFileSystem } from '@baishou/core-mobile'
import { normalizeExternalStoragePath, stripFileScheme } from '../services/android-external-fs'

const ANDROID_ROOT = '/storage/emulated/0'

function normalizeDir(path: string): string {
  return stripFileScheme(normalizeExternalStoragePath(path)).replace(/\/+$/, '')
}

function parentDir(path: string): string | null {
  const normalized = normalizeDir(path)
  const idx = normalized.lastIndexOf('/')
  if (idx <= 0) return null
  const parent = normalized.slice(0, idx)
  if (parent.length < ANDROID_ROOT.length) return ANDROID_ROOT
  return parent
}

interface DirectoryEntry {
  name: string
  path: string
}

export interface DirectoryPickerModalProps {
  visible: boolean
  fileSystem: IFileSystem | null
  initialPath?: string
  onClose: () => void
  onSelect: (path: string) => void
}

/** 原生目录选择器不可用时的回退 UI */
export const DirectoryPickerModal: React.FC<DirectoryPickerModalProps> = ({
  visible,
  fileSystem,
  initialPath,
  onClose,
  onSelect
}) => {
  const { t } = useTranslation()
  const { colors, isDark } = useNativeTheme()
  const [currentPath, setCurrentPath] = useState(ANDROID_ROOT)
  const [entries, setEntries] = useState<DirectoryEntry[]>([])
  const [loading, setLoading] = useState(false)

  const loadDirectory = useCallback(
    async (dirPath: string) => {
      if (!fileSystem) return
      const normalized = normalizeDir(dirPath)
      setLoading(true)
      try {
        const names = await fileSystem.readdir(normalized)
        const dirs: DirectoryEntry[] = []
        for (const name of names) {
          if (name === '.' || name === '..') continue
          const fullPath = `${normalized}/${name}`
          try {
            const stat = await fileSystem.stat(fullPath)
            if (stat.isDirectory) {
              dirs.push({ name, path: fullPath })
            }
          } catch {
            // skip inaccessible entries
          }
        }
        dirs.sort((a, b) => a.name.localeCompare(b.name))
        setEntries(dirs)
        setCurrentPath(normalized)
      } catch {
        setEntries([])
        setCurrentPath(normalized)
      } finally {
        setLoading(false)
      }
    },
    [fileSystem]
  )

  useEffect(() => {
    if (!visible || !fileSystem) return
    void loadDirectory(initialPath || ANDROID_ROOT)
  }, [visible, fileSystem, initialPath, loadDirectory])

  const handleGoUp = () => {
    const parent = parentDir(currentPath)
    if (parent) void loadDirectory(parent)
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bgApp}
      />
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.bgApp }]}
        edges={['top', 'left', 'right', 'bottom']}
      >
        <View style={[styles.header, { borderBottomColor: colors.borderSubtle }]}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={{ color: colors.primary, fontSize: 16 }}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            {t('storage.pick_directory', '选择目录')}
          </Text>
          <View style={{ width: 48 }} />
        </View>

        <View
          style={[
            styles.pathBar,
            { backgroundColor: colors.bgSurface, borderColor: colors.borderSubtle }
          ]}
        >
          <TouchableOpacity
            onPress={handleGoUp}
            disabled={normalizeDir(currentPath) === ANDROID_ROOT}
            style={{ opacity: normalizeDir(currentPath) === ANDROID_ROOT ? 0.35 : 1 }}
          >
            <MaterialIcons name="arrow-upward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text
            style={[styles.pathText, { color: colors.textSecondary }]}
            numberOfLines={2}
            selectable
          >
            {currentPath}
          </Text>
        </View>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={entries}
            keyExtractor={(item) => item.path}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.row, { borderBottomColor: colors.borderSubtle }]}
                onPress={() => void loadDirectory(item.path)}
              >
                <MaterialIcons name="folder" size={22} color={colors.primary} />
                <Text style={[styles.rowTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <MaterialIcons name="chevron-right" size={22} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={[styles.empty, { color: colors.textSecondary }]}>
                {t('storage.directory_empty', '此目录下没有子文件夹')}
              </Text>
            }
          />
        )}

        <View
          style={[
            styles.footer,
            { borderTopColor: colors.borderSubtle, backgroundColor: colors.bgApp }
          ]}
        >
          <Button variant="primary" className="w-full" onPress={() => onSelect(currentPath)}>
            {t('storage.select_this_directory', '选择此目录')}
          </Button>
        </View>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700'
  },
  pathBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    margin: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth
  },
  pathText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'monospace',
    lineHeight: 18
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  listContent: {
    paddingBottom: 16
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  rowTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500'
  },
  empty: {
    textAlign: 'center',
    padding: 32,
    fontSize: 14
  },
  footer: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth
  }
})
