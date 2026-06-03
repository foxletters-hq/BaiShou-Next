import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Modal,
  Animated,
  StyleSheet,
  TouchableOpacity
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'

export interface MockAiProviderModel {
  id: string
  name: string
  enabledModels?: string[]
  models?: string[]
}

interface NativeModelSwitcherProps {
  isOpen: boolean
  onClose: () => void
  providers: MockAiProviderModel[]
  currentProviderId?: string | null
  currentModelId?: string | null
  onSelect: (providerId: string, modelId: string) => void
  onManageProviders?: () => void
}

export const ModelSwitcher: React.FC<NativeModelSwitcherProps> = ({
  isOpen,
  onClose,
  providers,
  currentProviderId,
  currentModelId,
  onSelect,
  onManageProviders
}) => {
  const { t } = useTranslation()
  const { colors, tokens, maxModalWidth } = useNativeTheme()
  const [searchQuery, setSearchQuery] = useState('')
  const [mounted, setMounted] = useState(false)
  const scaleAnim = useRef(new Animated.Value(0.85)).current
  const fadeAnim = useRef(new Animated.Value(0)).current

  const { filteredProviders, filteredModels } = useMemo(() => {
    const pList: MockAiProviderModel[] = []
    const mDict: Record<string, string[]> = {}
    const query = searchQuery.toLowerCase()

    for (const provider of providers) {
      const enabled = provider.enabledModels || []
      const all = provider.models || []
      const modelList = enabled.length > 0 ? enabled : all
      const matched = query
        ? modelList.filter((m) => m && m.toLowerCase().includes(query))
        : modelList

      if (matched.length > 0) {
        pList.push(provider)
        mDict[provider.id] = matched
      }
    }

    return { filteredProviders: pList, filteredModels: mDict }
  }, [providers, searchQuery])

  useEffect(() => {
    if (isOpen) {
      setMounted(true)
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 65,
          friction: 11
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true
        })
      ]).start()
      return
    }

    if (!mounted) return

    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.85,
        duration: 180,
        useNativeDriver: true
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true
      })
    ]).start(({ finished }) => {
      if (finished) {
        setMounted(false)
        setSearchQuery('')
      }
    })
  }, [isOpen, mounted, scaleAnim, fadeAnim])

  if (!mounted) return null

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.dialog,
            {
              backgroundColor: colors.bgSurface,
              borderRadius: tokens.radius.xl,
              width: '90%',
              maxWidth: maxModalWidth,
              maxHeight: '80%',
              padding: tokens.spacing.lg,
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
              {t('models.switch_model', '切换模型')}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialIcons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View
            style={[
              styles.searchBar,
              { backgroundColor: colors.bgSurfaceNormal, borderColor: colors.borderSubtle }
            ]}
          >
            <MaterialIcons name="search" size={18} color={colors.textTertiary} />
            <TextInput
              placeholder={t('common.search_model', '搜索模型...')}
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={[styles.searchInput, { color: colors.textPrimary }]}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <MaterialIcons name="close" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {filteredProviders.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {t('common.no_match_model', '没有匹配的可用模型')}
                </Text>
                {onManageProviders && (
                  <TouchableOpacity
                    style={[styles.manageBtn, { backgroundColor: colors.primaryContainer }]}
                    onPress={() => {
                      onManageProviders()
                      onClose()
                    }}
                  >
                    <MaterialIcons name="settings" size={16} color={colors.onPrimaryContainer} />
                    <Text style={[styles.manageBtnText, { color: colors.onPrimaryContainer }]}>
                      {t('agent.manageProviders', '管理模型与供应商')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              filteredProviders.map((provider) => {
                const models = filteredModels[provider.id] || []
                const isCurrentProvider = provider.id === currentProviderId

                return (
                  <View key={provider.id} style={styles.providerGroup}>
                    <View style={styles.providerHeader}>
                      <MaterialIcons name="cloud" size={16} color={colors.textSecondary} />
                      <Text style={[styles.providerName, { color: colors.textPrimary }]}>
                        {provider.name}
                      </Text>
                      <View
                        style={[styles.countBadge, { backgroundColor: colors.bgSurfaceNormal }]}
                      >
                        <Text style={[styles.countText, { color: colors.textSecondary }]}>
                          {models.length}
                        </Text>
                      </View>
                    </View>

                    {models.map((modelId) => {
                      const isSelected = isCurrentProvider && modelId === currentModelId
                      return (
                        <Pressable
                          key={modelId}
                          onPress={() => {
                            onSelect(provider.id, modelId)
                            onClose()
                          }}
                          style={[
                            styles.modelRow,
                            {
                              backgroundColor: isSelected ? colors.primaryContainer : 'transparent'
                            }
                          ]}
                        >
                          <MaterialIcons
                            name="memory"
                            size={16}
                            color={isSelected ? colors.primary : colors.textTertiary}
                          />
                          <Text
                            style={[
                              styles.modelName,
                              {
                                color: isSelected ? colors.onPrimaryContainer : colors.textPrimary,
                                fontWeight: isSelected ? '600' : '400'
                              }
                            ]}
                            numberOfLines={1}
                          >
                            {modelId}
                          </Text>
                          {isSelected && (
                            <MaterialIcons name="check" size={18} color={colors.primary} />
                          )}
                        </Pressable>
                      )
                    })}
                  </View>
                )
              })
            )}
          </ScrollView>

          {onManageProviders && filteredProviders.length > 0 && (
            <TouchableOpacity
              style={[styles.footerBtn, { borderTopColor: colors.borderSubtle }]}
              onPress={() => {
                onManageProviders()
                onClose()
              }}
            >
              <MaterialIcons name="settings" size={18} color={colors.primary} />
              <Text style={[styles.footerBtnText, { color: colors.primary }]}>
                {t('agent.manageProviders', '管理模型与供应商')}
              </Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)'
  },
  dialog: {},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700'
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 2
  },
  list: {
    maxHeight: 420
  },
  listContent: {
    paddingBottom: 8
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 16
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center'
  },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20
  },
  manageBtnText: {
    fontSize: 14,
    fontWeight: '600'
  },
  providerGroup: {
    marginBottom: 14
  },
  providerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6
  },
  providerName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600'
  },
  countBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2
  },
  countText: {
    fontSize: 12,
    fontWeight: '600'
  },
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8
  },
  modelName: {
    flex: 1,
    fontSize: 14
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderTopWidth: 1
  },
  footerBtnText: {
    fontSize: 14,
    fontWeight: '600'
  }
})
