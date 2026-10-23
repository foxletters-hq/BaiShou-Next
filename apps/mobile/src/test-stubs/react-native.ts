/** Vitest stub：避免加载 RN 入口里的 Flow `import typeof` 语法 */
export default {}

export const Platform = {
  OS: 'ios',
  select: <T>(spec: { ios?: T; android?: T; default?: T }) =>
    spec.ios ?? spec.android ?? spec.default
}

export const AppState = {
  currentState: 'active',
  addEventListener: () => ({ remove: () => undefined })
}

export const StyleSheet = {
  create: <T>(styles: T) => styles,
  hairlineWidth: 1,
  absoluteFill: {},
  flatten: (style: unknown) => style
}

export const View = 'View'
export const Text = 'Text'
export const Image = 'Image'
export const ScrollView = 'ScrollView'
export const Pressable = 'Pressable'
export const TouchableOpacity = 'TouchableOpacity'
export const ActivityIndicator = 'ActivityIndicator'
export const TextInput = 'TextInput'
export const Keyboard = {
  addListener: () => ({ remove: () => undefined }),
  dismiss: () => undefined
}
export const InteractionManager = {
  runAfterInteractions: (cb: () => void) => {
    cb()
    return { cancel: () => undefined }
  }
}
export const BackHandler = {
  addEventListener: () => ({ remove: () => undefined })
}
export const NativeModules = {}
export const Dimensions = {
  get: () => ({ width: 390, height: 844, scale: 2, fontScale: 1 })
}
