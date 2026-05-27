/// <reference types="vite/client" />

/** Vite / 构建资源模块（与 packages/ui/src/env.d.ts 保持一致） */
declare module '*.module.css' {
  const classes: { readonly [key: string]: string }
  export default classes
}

declare module '*.css'

declare module '*.svg' {
  const content: string
  export default content
}

declare module '*?url' {
  const content: string
  export default content
}

declare module '*?asset' {
  const content: string
  export default content
}

declare module '*.jpeg' {
  const content: string
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

declare module '*.webp' {
  const content: string
  export default content
}

declare module '*.gif' {
  const content: string
  export default content
}
