import { RuleTester } from 'eslint'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const { default: rule } = await import(
  pathToFileURL(
    join(
      dirname(fileURLToPath(import.meta.url)),
      '../../../../../scripts/eslint-plugin-no-hardcoded-font-size.mjs'
    )
  ).href
)

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } }
  }
})

tester.run('no-hardcoded-font-size', rule, {
  valid: [
    {
      filename: '/app/Foo.tsx',
      code: 'const s = { title: { fontSize: mobileTypography.body.fontSize } }'
    },
    {
      filename: '/app/Foo.tsx',
      code: 'const s = { chevron: { fontSize: 10 }, sendIcon: { fontSize: 18 } }'
    },
    {
      filename: '/pkg/theme/tokens.ts',
      code: 'export const mobileTypography = { body: { fontSize: 15 } }'
    },
    {
      filename: '/app/Foo.tsx',
      code: 'const el = <Text style={{ fontSize: 20 }}>🤖</Text>'
    },
    {
      filename: '/app/Foo.tsx',
      code: 'const el = <Text style={{ fontSize: 20 }}>{profile.emoji || "🤖"}</Text>'
    },
    {
      filename: '/app/Foo.tsx',
      code: 'const s = { fallback: { fontSize: size * 0.85 } }'
    },
    {
      filename: '/app/Foo.tsx',
      code: 'const s = { h1: { fontSize: Math.round(resolveHeadingFontSize(1) * scale) } }'
    },
    {
      filename: '/app/Foo.tsx',
      code: 'const s = { mark: { fontSize: iconSizes.md } }'
    },
    {
      filename: '/app/Foo.tsx',
      code: "const s = { title: { fontSize: 'var(--ui-fs-md)' } }"
    },
    {
      filename: '/app/Foo.tsx',
      code: 'const s = { title: { fontSize: `${uiTypography.sm}px` } }'
    },
    {
      filename: '/app/Foo.tsx',
      code: "const s = { hidden: { fontSize: 0 }, css: { fontSize: 'var(--ui-fs-md, 13px)' } }"
    },
    {
      filename: '/app/screens/KnowledgeScreen/Foo.tsx',
      code: 'const s = { title: { fontSize: 17 } }'
    }
  ],
  invalid: [
    {
      filename: '/app/Foo.tsx',
      code: 'const s = { title: { fontSize: 13 } }',
      errors: [{ messageId: 'hardcoded' }]
    },
    {
      filename: '/app/Foo.tsx',
      code: "const s = { title: { fontSize: '13px' } }",
      errors: [{ messageId: 'hardcoded' }]
    },
    {
      filename: '/app/Foo.tsx',
      code: 'const s = { title: { fontSize: 12 * scale } }',
      errors: [{ messageId: 'hardcoded' }]
    },
    {
      filename: '/app/Foo.tsx',
      code: 'const s = { title: { fontSize: Math.round(12 * scale) } }',
      errors: [{ messageId: 'hardcoded' }]
    },
    {
      filename: '/app/Foo.tsx',
      code: 'const html = `<div style="font-size:11px"></div>`',
      errors: [{ messageId: 'hardcoded' }]
    },
    {
      filename: '/app/Foo.tsx',
      code: 'const s = { title: { fontSize: `${Math.round(12 * scale)}px` } }',
      errors: [{ messageId: 'hardcoded' }]
    }
  ]
})
