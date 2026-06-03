/// <reference types="expo/types" />

/** 静态资源模块（与桌面端 / UI 包声明一致，避免 VS Code 报无法识别 import） */
declare module '*.module.css' {
  const classes: { readonly [key: string]: string }
  export default classes
}

declare module '*.css'

declare module '*.svg' {
  /** Metro 静态资源模块 id（与 PNG 相同，供 expo-asset / SvgUri 使用） */
  const content: number
  export default content
}

declare module '*.png' {
  const content: string
  export default content
}

declare module '*.jpg' {
  const content: string
  export default content
}

declare module '*.jpeg' {
  const content: string
  export default content
}

declare module '*.webp' {
  const content: string
  export default content
}

declare module '*.gif' {
  const content: string
  export default content
}
