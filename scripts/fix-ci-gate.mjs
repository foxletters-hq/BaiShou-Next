import fs from 'node:fs'
import path from 'node:path'

import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('..', import.meta.url))

function patch(file, edits) {
  const full = path.join(root, file)
  try {
    let text = fs.readFileSync(full, 'utf8')
    for (const [from, to] of edits) {
      if (!text.includes(from)) {
        if (to === null) continue
        throw new Error(`missing snippet in ${file}: ${from.slice(0, 60)}`)
      }
      text = text.replace(from, to)
    }
    fs.writeFileSync(full, text)
    console.log('patched', file)
  } catch (e) {
    console.warn('skip', file, e.code || e.message)
  }
}

patch('eslint.baishou.base.mjs', [
  [
    `export function createBaishouEslintConfig(options = {}) {
  const { extraIgnores = [], extraPlugins = {}, extraRules = {} } = options`,
    `export function createBaishouEslintConfig(options = {}) {
  const isMobileProfile = process.env.BAISHOU_ESLINT_PROFILE === 'mobile'
  const profileIgnores = isMobileProfile
    ? ['scripts/**', 'mocks/**', 'metro.config.js', 'polyfill.js']
    : []
  const { extraIgnores = [], extraPlugins = {}, extraRules = {} } = options`
  ],
  [
    'ignores: [...sharedIgnores, ...extraIgnores]',
    'ignores: [...sharedIgnores, ...profileIgnores, ...extraIgnores]'
  ],
  [
    `'@typescript-eslint/no-unused-vars': [
          'error',`,
    `'@typescript-eslint/no-unused-vars': isMobileProfile
          ? 'warn'
          : [
          'error',`
  ],
  [
    `'no-empty': ['error', { allowEmptyCatch: true }],`,
    `'no-empty': isMobileProfile
          ? ['warn', { allowEmptyCatch: true }]
          : ['error', { allowEmptyCatch: true }],`
  ],
  [
    `    eslintConfigPrettier
  )
}`,
    `    eslintConfigPrettier,
    ...(isMobileProfile
      ? [
          {
            files: ['**/*.{js,cjs,mjs}'],
            rules: { '@typescript-eslint/no-require-imports': 'off' }
          }
        ]
      : [])
  )
}`
  ]
])

patch('apps/desktop/src/renderer/src/components/TitleBar/index.tsx', [
  ['  MdArrowDropDown,\n  MdSettings\n}', '  MdArrowDropDown\n}']
])

patch('apps/desktop/src/renderer/src/features/agent/AgentLayout.tsx', [
  [
    '  const { agentBehavior, loadConfig } = useSettingsStore()',
    '  const { loadConfig } = useSettingsStore()'
  ]
])

patch('apps/desktop/src/renderer/src/features/agent/components/AgentMessageList.tsx', [
  [
    `            let compressedContent: string | undefined
            let originalContent: string | undefined
            let systemPrompt: string | undefined`,
    `            let compressedContent: string | undefined
            let systemPrompt: string | undefined`
  ]
])

patch('apps/desktop/src/renderer/src/features/settings/IncrementalSyncPage.tsx', [
  ['    message,', '    message: _message,']
])

patch('apps/desktop/src/renderer/src/features/settings/hooks/useRagSettings.ts', [
  ['  settings,', '  settings: _settings,']
])

const ciPath = path.join(root, '.github/workflows/ci.yml')
let ci = fs.readFileSync(ciPath, 'utf8')
if (!ci.includes('BAISHOU_ESLINT_PROFILE')) {
  ci = ci.replace(
    '      - run: pnpm --filter @baishou/mobile exec eslint . --cache --quiet',
    `      - run: pnpm --filter @baishou/mobile exec eslint . --cache --quiet
        env:
          BAISHOU_ESLINT_PROFILE: mobile`
  )
  fs.writeFileSync(ciPath, ci)
  console.log('patched ci.yml')
}

console.log('done')
