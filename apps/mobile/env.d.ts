/// <reference types="expo/types" />

/** 静态资源模块（与桌面端 / UI 包声明一致，避免 VS Code 报无法识别 import） */
declare module '*.module.css' {
  const classes: { readonly [key: string]: string }
  export default classes
}

declare module '*.css'

declare module '*.svg' {
  import type { FC } from 'react'
  import type { SvgProps } from 'react-native-svg'
  const content: FC<SvgProps>
  export default content
}

declare module '*.png' {
  const content: number
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
