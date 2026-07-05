import { createContext } from 'react'

/** 保活页面当前是否在前台展示（隐藏/后台时为 false） */
export const MainPageCacheActiveContext = createContext(true)
