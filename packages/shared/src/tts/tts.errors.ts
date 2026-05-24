export class TtsNotConfiguredError extends Error {
  constructor() {
    super('TTS 未配置，请在设置中配置 TTS 模型')
    this.name = 'TtsNotConfiguredError'
  }
}

export class TtsProviderNotFoundError extends Error {
  constructor(providerId: string) {
    super(`TTS 提供商 ${providerId} 未找到`)
    this.name = 'TtsProviderNotFoundError'
  }
}

export class TtsApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly providerId?: string
  ) {
    super(message)
    this.name = 'TtsApiError'
  }
}

export class TtsInvalidResponseError extends Error {
  constructor(providerId: string) {
    super(`${providerId} 返回的响应中无音频数据`)
    this.name = 'TtsInvalidResponseError'
  }
}
