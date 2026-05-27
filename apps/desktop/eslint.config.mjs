import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'
import { createBaishouEslintConfig } from '../../eslint.baishou.base.mjs'

export default createBaishouEslintConfig({
  extraIgnores: ['electron.vite.config.*', 'eslint.config.mjs'],
  extraPlugins: {
    'react-refresh': eslintPluginReactRefresh
  },
  extraRules: {
    ...eslintPluginReactRefresh.configs.vite.rules
  }
})
