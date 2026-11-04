import * as espree from 'espree'

/**
 * 极简 ESLint JSON Parser（零额外依赖，基于 ESLint 内置的 espree）。
 * 把 JSON 文本包裹为 JS 表达式 `(${json})` 进行解析，
 * 使 ESLint 标准规则（如 max-lines、eol-last 等）能够直接作用于 .json 资源文件。
 */
export default {
  meta: {
    name: 'baishou-eslint-parser-json',
    version: '1.0.0'
  },
  parseForESLint(text, options = {}) {
    const wrapped = `(${text})`
    const ast = espree.parse(wrapped, {
      ...options,
      ecmaVersion: 'latest',
      loc: true,
      range: true,
      tokens: true,
      comment: true
    })
    return {
      ast,
      services: {},
      scopeManager: null,
      visitorKeys: null
    }
  }
}
