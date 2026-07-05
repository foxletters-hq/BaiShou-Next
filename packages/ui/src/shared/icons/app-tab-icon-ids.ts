/** 主 Tab id，与桌面 TitleBar + sidebar summary 对齐 */
export const APP_TAB_ICON_IDS = ['diary', 'agent', 'summary', 'settings'] as const

export type AppTabIconId = (typeof APP_TAB_ICON_IDS)[number]
