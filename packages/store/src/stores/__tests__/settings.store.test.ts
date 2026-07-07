import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSettingsStore } from '../settings.store'
import { ProviderType } from '@baishou/shared'
import type { AIProviderConfig, RagConfig } from '@baishou/shared'

describe('useSettingsStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock IPC
    ;(globalThis as any).window = {
      api: {
        settings: {
          getProviders: vi.fn(),
          setProviders: vi.fn(),
          patchProvider: vi.fn().mockResolvedValue(undefined),
          getGlobalModels: vi.fn(),
          setGlobalModels: vi.fn(),
          getAgentBehaviorConfig: vi.fn(),
          setAgentBehaviorConfig: vi.fn(),
          getRagConfig: vi.fn(),
          setRagConfig: vi.fn(),
          getWebSearchConfig: vi.fn(),
          setWebSearchConfig: vi.fn(),
          getSummaryConfig: vi.fn(),
          setSummaryConfig: vi.fn(),
          getToolManagementConfig: vi.fn(),
          setToolManagementConfig: vi.fn(),
          getMcpServerConfig: vi.fn(),
          setMcpServerConfig: vi.fn(),
          getHotkeyConfig: vi.fn(),
          setHotkeyConfig: vi.fn(),
          getCloudSyncConfig: vi.fn()
        }
      }
    }

    // reset store state
    useSettingsStore.setState({
      themeMode: 'system',
      useGlassmorphism: true,
      locale: 'zh',
      providers: [],
      globalModels: null,
      agentBehavior: null,
      ragConfig: null,
      webSearchConfig: null,
      summaryConfig: null,
      toolManagementConfig: null,
      mcpServerConfig: null,
      isLoading: false,
      configHydrated: false,
      loadedConfigKeys: [],
      loadingConfigKeys: [],
      failedConfigKeys: []
    })
  })

  it('should initialize empty configurations', () => {
    const state = useSettingsStore.getState()
    expect(state.providers).toEqual([])
    expect(state.ragConfig).toBeNull()
    expect(state.isLoading).toBe(false)
  })

  it('should load all domain configs when loadConfig is called explicitly', async () => {
    const mockProviders: AIProviderConfig[] = [
      {
        id: 'openai',
        name: 'OpenAI',
        type: ProviderType.OpenAI,
        isEnabled: true,
        apiKey: 'mock-key',
        baseUrl: '',
        models: [],
        enabledModels: [],
        defaultDialogueModel: '',
        defaultNamingModel: '',
        isSystem: false,
        sortOrder: 0
      }
    ]
    const mockRag: RagConfig = {
      ragEnabled: true,
      ragTopK: 15,
      ragSimilarityThreshold: 0.5
    }

    ;(globalThis as any).window.api.settings.getProviders.mockResolvedValue(mockProviders)
    ;(globalThis as any).window.api.settings.getRagConfig.mockResolvedValue(mockRag)
    ;(globalThis as any).window.api.settings.getGlobalModels.mockResolvedValue(null)
    ;(globalThis as any).window.api.settings.getAgentBehaviorConfig.mockResolvedValue(null)
    ;(globalThis as any).window.api.settings.getWebSearchConfig.mockResolvedValue(null)
    ;(globalThis as any).window.api.settings.getSummaryConfig.mockResolvedValue(null)
    ;(globalThis as any).window.api.settings.getToolManagementConfig.mockResolvedValue(null)
    ;(globalThis as any).window.api.settings.getMcpServerConfig.mockResolvedValue(null)
    ;(globalThis as any).window.api.settings.getHotkeyConfig.mockResolvedValue(null)
    ;(globalThis as any).window.api.settings.getCloudSyncConfig.mockResolvedValue(null)

    await useSettingsStore.getState().loadConfig()

    const state = useSettingsStore.getState()
    expect(state.providers.length).toBe(1)
    expect(state.providers[0]!.apiKey).toBe('mock-key')
    expect(state.ragConfig?.ragTopK).toBe(15)
    expect(state.loadedConfigKeys).toContain('providers')
    expect(state.loadedConfigKeys).toContain('ragConfig')
  })

  it('should skip loadConfig when all keys are already loaded', async () => {
    useSettingsStore.setState({
      loadedConfigKeys: [
        'providers',
        'globalModels',
        'agentBehavior',
        'ragConfig',
        'webSearchConfig',
        'summaryConfig',
        'toolManagementConfig',
        'mcpServerConfig',
        'hotkeyConfig',
        'cloudSyncConfig'
      ],
      configHydrated: true
    })

    await useSettingsStore.getState().loadConfig()

    expect((globalThis as any).window.api.settings.getProviders).not.toHaveBeenCalled()
  })

  it('should load only segment-specific config keys', async () => {
    ;(globalThis as any).window.api.settings.getMcpServerConfig.mockResolvedValue({
      mcpEnabled: true,
      mcpPort: 31005
    })

    await useSettingsStore.getState().ensureConfigForSegment('mcp')

    const state = useSettingsStore.getState()
    expect(state.mcpServerConfig?.mcpEnabled).toBe(true)
    expect(state.loadedConfigKeys).toEqual(['mcpServerConfig'])
    expect((globalThis as any).window.api.settings.getProviders).not.toHaveBeenCalled()
  })

  it('should hydrate missing config via snapshot IPC', async () => {
    ;(globalThis as any).window.api.settings.getConfigSnapshot = vi.fn().mockResolvedValue({
      mcpServerConfig: { mcpEnabled: true, mcpPort: 31005 }
    })

    await useSettingsStore.getState().ensureConfigForSegment('mcp')

    const state = useSettingsStore.getState()
    expect(state.mcpServerConfig?.mcpEnabled).toBe(true)
    expect(state.loadedConfigKeys).toEqual(['mcpServerConfig'])
    expect((globalThis as any).window.api.settings.getMcpServerConfig).not.toHaveBeenCalled()
  })

  it('should schedule deferred warmup via snapshot batch', async () => {
    vi.useFakeTimers()
    ;(globalThis as any).window.api.settings.getConfigSnapshot = vi.fn().mockResolvedValue({
      providers: [],
      globalModels: null,
      agentBehavior: null,
      ragConfig: null,
      webSearchConfig: null,
      summaryConfig: null,
      toolManagementConfig: null,
      mcpServerConfig: null,
      hotkeyConfig: null,
      cloudSyncConfig: null
    })

    useSettingsStore.getState().scheduleDeferredConfigWarmup()
    await vi.advanceTimersByTimeAsync(2600)

    expect((globalThis as any).window.api.settings.getConfigSnapshot).toHaveBeenCalledTimes(1)
    expect(useSettingsStore.getState().loadedConfigKeys.length).toBe(10)
    vi.useRealTimers()
  })

  it('should cancel deferred warmup before it fires', async () => {
    vi.useFakeTimers()
    ;(globalThis as any).window.api.settings.getConfigSnapshot = vi.fn().mockResolvedValue({})

    useSettingsStore.getState().scheduleDeferredConfigWarmup()
    useSettingsStore.getState().cancelDeferredConfigWarmup()
    await vi.advanceTimersByTimeAsync(3000)

    expect((globalThis as any).window.api.settings.getConfigSnapshot).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('should record failed keys when IPC load fails', async () => {
    ;(globalThis as any).window.api.settings.getMcpServerConfig.mockRejectedValueOnce(
      new Error('ipc fail')
    )

    await useSettingsStore.getState().ensureConfigForSegment('mcp')

    const state = useSettingsStore.getState()
    expect(state.failedConfigKeys).toContain('mcpServerConfig')
    expect(state.loadedConfigKeys).not.toContain('mcpServerConfig')
    expect(state.isSegmentConfigFailed('mcp')).toBe(true)
  })

  it('retryConfigForSegment should recover after IPC failure', async () => {
    ;(globalThis as any).window.api.settings.getMcpServerConfig
      .mockRejectedValueOnce(new Error('ipc fail'))
      .mockResolvedValueOnce({ mcpEnabled: true, mcpPort: 31006 })

    await useSettingsStore.getState().ensureConfigForSegment('mcp')
    expect(useSettingsStore.getState().isSegmentConfigFailed('mcp')).toBe(true)

    await useSettingsStore.getState().retryConfigForSegment('mcp')

    const state = useSettingsStore.getState()
    expect(state.failedConfigKeys).not.toContain('mcpServerConfig')
    expect(state.mcpServerConfig?.mcpPort).toBe(31006)
    expect(state.isSegmentConfigFailed('mcp')).toBe(false)
  })

  it('should update provider and sync to IPC', async () => {
    useSettingsStore.setState({
      providers: [
        {
          id: 'gemini',
          name: 'Gemini',
          type: ProviderType.Gemini,
          isEnabled: true,
          apiKey: 'old-key',
          baseUrl: '',
          models: [],
          enabledModels: [],
          defaultDialogueModel: '',
          defaultNamingModel: '',
          isSystem: false,
          sortOrder: 0
        }
      ]
    })

    const updatedProvider: AIProviderConfig = {
      id: 'gemini',
      name: 'Gemini',
      type: ProviderType.Gemini,
      isEnabled: true,
      apiKey: 'new-key',
      baseUrl: '',
      models: [],
      enabledModels: [],
      defaultDialogueModel: '',
      defaultNamingModel: '',
      isSystem: false,
      sortOrder: 0
    }

    ;(globalThis as any).window.api.settings.getProviders.mockResolvedValue([
      { ...updatedProvider }
    ])

    await useSettingsStore.getState().updateProvider(updatedProvider)

    const state = useSettingsStore.getState()
    expect(state.providers[0]!.apiKey).toBe('new-key')
    expect((globalThis as any).window.api.settings.patchProvider).toHaveBeenCalled()
  })

  it('should call corresponding IPC set method when updating a domain config', async () => {
    const newRag: RagConfig = {
      ragEnabled: false,
      ragTopK: 10,
      ragSimilarityThreshold: 0.8
    }

    await useSettingsStore.getState().setRagConfig(newRag)

    const state = useSettingsStore.getState()
    expect(state.ragConfig?.ragEnabled).toBe(false)
    expect((globalThis as any).window.api.settings.setRagConfig).toHaveBeenCalledWith(newRag)
  })

  it('should toggle provider enable flag safely', async () => {
    useSettingsStore.setState({
      providers: [
        {
          id: 'anthropic',
          name: 'Anthropic',
          type: ProviderType.Anthropic,
          isEnabled: true,
          apiKey: '',
          baseUrl: '',
          models: [],
          enabledModels: [],
          defaultDialogueModel: '',
          defaultNamingModel: '',
          isSystem: false,
          sortOrder: 0
        }
      ]
    })
    ;(globalThis as any).window.api.settings.getProviders.mockResolvedValue([
      {
        id: 'anthropic',
        name: 'Anthropic',
        type: ProviderType.Anthropic,
        isEnabled: false,
        apiKey: '',
        baseUrl: '',
        models: [],
        enabledModels: [],
        defaultDialogueModel: '',
        defaultNamingModel: '',
        isSystem: false,
        sortOrder: 0
      }
    ])

    await useSettingsStore.getState().toggleProvider('anthropic', false)

    const state = useSettingsStore.getState()
    expect(state.providers[0]!.isEnabled).toBe(false)
  })
})
