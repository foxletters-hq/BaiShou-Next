import React, { useState, useEffect } from 'react'
import { useSensors, useSensor, PointerSensor } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { useTranslation } from 'react-i18next'
import { useDialog } from '../Dialog'
import { useToast } from '../Toast/useToast'
import { getProviderIcon } from '../../utils/provider-icons'
import { useTheme } from '../../hooks'
import { MdCloud } from 'react-icons/md'
import styles from './AIModelServicesView.module.css'
import type { AIModelServicesViewProps } from './ai-model-services.types'
import { useAIModelProviderActions } from './useAIModelProviderActions'
import {
  BASE_KNOWN_PROVIDERS_CONFIG,
  PROVIDER_NAME_I18N_MAP,
  PROVIDER_TYPES
} from './ai-model-services.constants'

export function useAIModelServicesView(props: AIModelServicesViewProps) {
  const {
    providers,
    onUpdateProvider,
    onDeleteProvider,
    onReorderProviders,
    onTestConnection,
    onFetchModels
  } = props
  const { t } = useTranslation()
  const dialog = useDialog()
  const toast = useToast()
  const { isDark } = useTheme()

  const BASE_KNOWN_PROVIDERS = BASE_KNOWN_PROVIDERS_CONFIG.map((p) => ({
    ...p,
    name: PROVIDER_NAME_I18N_MAP[p.id] ? t(PROVIDER_NAME_I18N_MAP[p.id], p.name) : p.name,
    iconUrl: getProviderIcon(p.id, isDark)
  }))

  const getCombinedProviders = Object.keys(providers).filter(
    (id) => !BASE_KNOWN_PROVIDERS.find((b) => b.id === id)
  )

  const allProvidersList = [
    ...BASE_KNOWN_PROVIDERS,
    ...getCombinedProviders.map((id) => ({
      id,
      name: providers[id]?.name || id.toUpperCase(),
      iconUrl: getProviderIcon(id, isDark),
      defaultBase: providers[id]?.apiBaseUrl || '',
      isSystem: false,
      sortOrder: providers[id]?.sortOrder ?? 999
    }))
  ]

  const sortedProvidersList = [...allProvidersList]
    .map((p) => ({
      ...p,
      sortOrder: providers[p.id]?.sortOrder ?? (p as any).sortOrder ?? 999,
      enabled: providers[p.id]?.enabled ?? false
    }))
    .sort((a, b) => {
      // 已启用的排在前面，未启用的排在后面
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1
      return a.sortOrder - b.sortOrder
    })

  const firstProviderId = sortedProvidersList[0]?.id
  const [selectedProviderId, setSelectedProviderId] = useState<string>(firstProviderId || '')

  const [localFormData, setLocalFormData] = useState<{
    baseUrl: string
    apiKey: string
  }>({
    baseUrl: '',
    apiKey: ''
  })

  const [isObscure, setIsObscure] = useState(true)
  const [isTesting, setIsTesting] = useState(false)
  const [isFetchingModels, setIsFetchingModels] = useState(false)

  const [localProvidersList, setLocalProvidersList] = useState(sortedProvidersList)
  useEffect(() => {
    setLocalProvidersList(sortedProvidersList)
  }, [providers])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    })
  )

  const [activeDragId, setActiveDragId] = useState<string | null>(null)

  const handleDragStart = (event: any) => {
    console.log('[Drag Tracking] dnd-kit DragStart:', event.active.id)
    setActiveDragId(event.active.id as string)
  }

  const handleDragEnd = (event: any) => {
    setActiveDragId(null)
    const { active, over } = event
    console.log('[Drag Tracking] dnd-kit DragEnd result:', event)
    if (over && active.id !== over.id) {
      const oldIndex = localProvidersList.findIndex((p) => p.id === active.id)
      const newIndex = localProvidersList.findIndex((p) => p.id === over.id)
      const updatedList = arrayMove(localProvidersList, oldIndex, newIndex)
      setLocalProvidersList(updatedList)

      if (onReorderProviders) {
        console.log(`[Drag Tracking] dnd-kit invoking onReorderProviders with current ordered IDs`)
        onReorderProviders(updatedList.map((x) => x.id))
      }
    }
  }

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false)
  const [addModalData, setAddModalData] = useState({
    name: '',
    type: 'openai',
    baseUrl: ''
  })

  const [isTestModalOpen, setIsTestModalOpen] = useState(false)
  const [testModelId, setTestModelId] = useState('')
  const [testModelOptions, setTestModelOptions] = useState<string[]>([])
  const [isTestModelDropdownOpen, setIsTestModelDropdownOpen] = useState(false)

  const activeProviderMeta =
    allProvidersList.find((p) => p.id === selectedProviderId) || allProvidersList[0]
  const activeConfig = providers[selectedProviderId] || {
    providerId: selectedProviderId,
    enabled: false,
    apiKey: '',
    apiBaseUrl: ''
  }

  const [delayedEnabledModels, setDelayedEnabledModels] = useState<string[]>(
    activeConfig.enabledModels || []
  )

  useEffect(() => {
    // 立即在一开始同步，但如果是用户点击引发的变化，则延迟 350ms 排序，让打钩动画飞一会
    const t = setTimeout(() => {
      setDelayedEnabledModels(activeConfig.enabledModels || [])
    }, 350)
    return () => clearTimeout(t)
  }, [activeConfig.enabledModels, selectedProviderId])

  const [prevSelectedProviderId, setPrevSelectedProviderId] = useState<string>(selectedProviderId)

  const actions = useAIModelProviderActions({
    t,
    toast,
    dialog,
    providers,
    onUpdateProvider,
    onDeleteProvider,
    onTestConnection,
    onFetchModels,
    selectedProviderId,
    setSelectedProviderId,
    localFormData,
    setLocalFormData,
    activeProviderMeta: activeProviderMeta!,
    activeConfig,
    setIsTesting,
    setIsFetchingModels,
    setIsTestModalOpen,
    setTestModelId,
    setTestModelOptions,
    testModelId,
    setIsAddModalOpen,
    setIsTypeDropdownOpen,
    addModalData,
    setAddModalData,
    firstProviderId,
    localProvidersList,
    BASE_KNOWN_PROVIDERS
  })

  useEffect(() => {
    if (selectedProviderId !== prevSelectedProviderId) {
      setPrevSelectedProviderId(selectedProviderId)
      actions.populateControllers(selectedProviderId)
    }
  }, [selectedProviderId, providers, prevSelectedProviderId, actions])

  return {
    t,
    dialog,
    toast,
    providers,
    onUpdateProvider,
    onDeleteProvider,
    onReorderProviders,
    onTestConnection,
    onFetchModels,
    BASE_KNOWN_PROVIDERS,
    PROVIDER_TYPES,
    allProvidersList,
    sortedProvidersList,
    firstProviderId,
    selectedProviderId,
    setSelectedProviderId,
    localFormData,
    setLocalFormData,
    isObscure,
    setIsObscure,
    isTesting,
    setIsTesting,
    isFetchingModels,
    setIsFetchingModels,
    localProvidersList,
    setLocalProvidersList,
    sensors,
    activeDragId,
    setActiveDragId,
    handleDragStart,
    handleDragEnd,
    isAddModalOpen,
    setIsAddModalOpen,
    isTypeDropdownOpen,
    setIsTypeDropdownOpen,
    addModalData,
    setAddModalData,
    isTestModalOpen,
    setIsTestModalOpen,
    testModelId,
    setTestModelId,
    testModelOptions,
    setTestModelOptions,
    isTestModelDropdownOpen,
    setIsTestModelDropdownOpen,
    activeProviderMeta,
    activeConfig,
    delayedEnabledModels,
    setDelayedEnabledModels,
    ...actions
  }
}

export type AIModelServicesViewModel = ReturnType<typeof useAIModelServicesView>
