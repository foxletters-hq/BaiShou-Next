/** Official BaiShou-Next GitHub repository */
export const GITHUB_REPO_URL = 'https://github.com/foxletters-hq/BaiShou-Next'

/** GitHub contributors graph page */
export const GITHUB_CONTRIBUTORS_URL = `${GITHUB_REPO_URL}/graphs/contributors`

/** Opens the issue template chooser (Bug / 需求建议 / 创意想法) */
export const GITHUB_ISSUES_URL = 'https://github.com/foxletters-hq/BaiShou-Next/issues/new'

/** 官方快速开始教程（配置嵌入模型与向量） */
export const HELP_DOCS_QUICK_START_URL = 'https://foxletters.com/docs/getting-started/quick-start/'

/** 官方看板娘 Latte 设定页（简中路径；其他语言见 {@link getHelpDocsLatteUrl}） */
export const HELP_DOCS_LATTE_URL = 'https://foxletters.com/docs/basics/latte/'

export function getHelpDocsLatteUrl(locale?: string): string {
  const lang = (locale ?? '').toLowerCase()
  if (lang.startsWith('en')) return 'https://foxletters.com/en/docs/basics/latte/'
  if (lang.startsWith('ja')) return 'https://foxletters.com/ja/docs/basics/latte/'
  return HELP_DOCS_LATTE_URL
}
