/** 国内 CDN 加速的各端最新下载清单（优先使用，0 秒缓存） */
export const RELEASE_CHANNEL_CDN_MANIFEST_URL = 'https://dl.foxletters.com/channel.json'

/** GitHub Raw 备用下载清单（CDN 异常或未同步时自动回退） */
export const RELEASE_CHANNEL_GITHUB_MANIFEST_URL =
  'https://raw.githubusercontent.com/foxletters-hq/BaiShou-Next/main/releases/channel.json'

/** 默认清单地址（优先走国内 CDN） */
export const RELEASE_CHANNEL_MANIFEST_URL = RELEASE_CHANNEL_CDN_MANIFEST_URL

/** 按优先级排列的下载清单候选源 */
export const RELEASE_CHANNEL_MANIFEST_URLS = [
  RELEASE_CHANNEL_CDN_MANIFEST_URL,
  RELEASE_CHANNEL_GITHUB_MANIFEST_URL
] as const

