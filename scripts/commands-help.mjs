#!/usr/bin/env node
/**
 * 列出仓库常用 pnpm 命令及说明。在根目录执行: pnpm commands
 * 可选过滤: pnpm commands mobile | desktop | ci
 */
const sections = [
  {
    id: 'dev',
    title: '开发',
    commands: [
      ['pnpm dev:desktop', '启动 Electron 桌面端'],
      ['pnpm dev:mobile', '★ 日常开发：启动 Metro（只改 JS/TS；手机须已装开发版 APK）'],
      [
        'pnpm dev:mobile:clear',
        '★ 全量重装：清 Metro/.expo/Gradle 缓存 + 重编安装 APK（升级 Expo、加原生模块、闪退时用；完成后 dev:mobile）'
      ],
      ['pnpm mobile:connect', 'adb reverse + 打开 App（Metro 需已在 dev:mobile 跑着）']
    ]
  },
  {
    id: 'mobile',
    title: '移动端 · Android（不能用 Expo Go，须开发版 APK）',
    commands: [
      [
        'pnpm mobile:setup',
        '首次克隆或大幅升级后一条龙：install → 对齐 Expo 依赖 → dev:mobile:clear 装包'
      ],
      ['pnpm mobile:fix', 'expo install --fix，把依赖版本对齐当前 Expo SDK'],
      ['pnpm mobile:export', '导出 Android 离线包到 apps/mobile/dist']
    ]
  },
  {
    id: 'desktop',
    title: '桌面端 · 构建',
    commands: [['pnpm build:desktop', '构建 Electron 桌面应用']]
  },
  {
    id: 'ci',
    title: '质量与 CI',
    commands: [
      ['pnpm ci', '本地跑完整 CI（typecheck + test + lint + format）'],
      ['pnpm typecheck', '全仓 TypeScript 检查'],
      ['pnpm test', '全仓单元测试'],
      ['pnpm lint', '全仓 ESLint'],
      ['pnpm format', 'Prettier 格式化'],
      ['pnpm format:check', 'Prettier 检查（CI 用）']
    ]
  },
  {
    id: 'db',
    title: '数据库',
    commands: [
      ['pnpm db:generate', 'Drizzle 生成迁移'],
      ['pnpm db:push', 'Drizzle push schema']
    ]
  }
]

const filter = process.argv[2]?.toLowerCase()
const list = filter ? sections.filter((s) => s.id === filter || s.id.startsWith(filter)) : sections

if (filter && list.length === 0) {
  console.log(`未找到分类 "${filter}"。可用: ${sections.map((s) => s.id).join(', ')}`)
  process.exit(1)
}

console.log('\n白守 Next — 常用命令\n')
console.log('查看分类: pnpm commands mobile | desktop | ci\n')

for (const section of list) {
  console.log(`── ${section.title} ──\n`)
  const width = Math.max(...section.commands.map(([cmd]) => cmd.length), 20)
  for (const [cmd, desc] of section.commands) {
    console.log(`  ${cmd.padEnd(width)}  ${desc}`)
  }
  console.log('')
}

console.log('移动端详情: apps/mobile/README.md\n')
