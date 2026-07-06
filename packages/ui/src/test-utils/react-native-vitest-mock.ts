export const Platform = {
  OS: 'ios',
  Version: 0,
  select<T>(spec: { ios?: T; android?: T; web?: T; default?: T }): T | undefined {
    return spec.ios ?? spec.default
  },
  isTV: false,
  isTesting: true
}
