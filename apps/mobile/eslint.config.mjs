import { createBaishouEslintConfig } from '../../eslint.baishou.base.mjs'

export default createBaishouEslintConfig({
  extraIgnores: [
    '.expo/**',
    'android/**',
    'ios/**',
    'modules/**',
    'eslint.config.mjs',
    'eslint.config.js'
  ]
})
