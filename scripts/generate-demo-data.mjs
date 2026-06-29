#!/usr/bin/env node
/**
 * 生成脱敏演示数据（日记 + 总结）并写入 packages/shared/src/demo-data/
 * 运行: node scripts/generate-demo-data.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '../packages/shared/src/demo-data')

const MOODS = ['Peaceful', 'Happy', 'Content', 'Calm', 'Focused', 'Tired', 'Grateful', 'Curious']
const WEATHERS = ['晴', '多云', '阴', '小雨', '晴转多云', '微风']
const LOCATIONS = ['家', '公司', '咖啡馆', '公园', '图书馆', '地铁']

const DIARY_THEMES = [
  {
    tags: ['阅读', '独处', '安静'],
    lines: [
      '在图书馆待了一下午，读完一本关于城市观察的随笔。作者写街角面包店的方式，让我想起自己也该更留意日常里的温度。',
      '睡前翻了几页小说。故事并不复杂，但人物之间的留白让人回味。决定明天早起继续读。'
    ]
  },
  {
    tags: ['工作', '项目', '协作'],
    lines: [
      '项目进入联调阶段，和同事一起排查了一个边界 case。问题不显眼，但修完后流程顺畅很多，团队气氛也轻松了些。',
      '今天开了需求评审，把几个模糊点逐一澄清。会后整理了待办，感觉方向比上周清楚多了。'
    ]
  },
  {
    tags: ['运动', '健康', '户外'],
    lines: [
      '傍晚去公园慢跑三公里。起步有点喘，后半段节奏稳下来，汗后反而头脑清醒。',
      '周末骑行沿河路线，风不大，阳光正好。路过一片新开的花坛，停下来拍了张照片。'
    ]
  },
  {
    tags: ['美食', '探店', '日常'],
    lines: [
      '尝试了一家新开的简餐店，番茄意面酸度刚好，配一杯冰美式，简单却很满足。',
      '自己做了味噌汤和饭团。厨房不大，但热气升腾的瞬间，觉得生活被好好安顿了。'
    ]
  },
  {
    tags: ['朋友', '聚会', '聊天'],
    lines: [
      '和大学同学约饭，聊各自近来的变动。没有刻意的安慰，只是互相听着，就已经很治愈。',
      '小组里新同事分享了家乡小吃的做法，大家笑成一团。这种轻松的氛围，是加班日里难得的缓冲。'
    ]
  },
  {
    tags: ['学习', '笔记', '成长'],
    lines: [
      '整理了一周的技术笔记，把零散的点串成结构。写下来的过程，也是二次理解的过程。',
      '跟了一节线上公开课，关于信息架构的案例很实用。打算下周在 side project 里试一个小改动。'
    ]
  },
  {
    tags: ['家务', '整理', '秩序'],
    lines: [
      '花上午整理了书桌和线缆，空间立刻清爽。原来很多焦虑来自视觉上的杂乱。',
      '换季收衣服，发现几件几乎没穿过的单品。决定捐出一部分，给衣柜也给自己留点余地。'
    ]
  },
  {
    tags: ['电影', '放松', '周末'],
    lines: [
      '一个人看了场晚场电影。剧情中等，但配乐出色，散场时街道安静，心情也被抚平了些。',
      '重看了一部老片，发现年轻时没注意到的细节。好的作品会在不同年纪给出不同答案。'
    ]
  },
  {
    tags: ['旅行', '短途', '记录'],
    lines: [
      '坐高铁去了邻近城市，逛了旧街区和一家独立书店。行程不长，但切换环境确实能刷新状态。',
      '在海边走了很久，只听潮声和风声。回程车上睡了一路，像被自然按下了重置键。'
    ]
  },
  {
    tags: ['植物', '阳台', '日常'],
    lines: [
      '给阳台的绿萝和多肉换了盆，根须缠得比想象中密。照顾小生命，也需要一点耐心。',
      '薄荷长出新叶，掐了几片泡了水。清香很淡，却让整个下午都变得轻盈。'
    ]
  },
  {
    tags: ['音乐', '夜晚', '灵感'],
    lines: [
      '深夜写方案时循环一张爵士 playlist，复杂节奏反而让人专注。完成时窗外已见晨光。',
      '在地铁上听到街头艺人弹吉他，短短两首，却让通勤路不再只是通勤。'
    ]
  },
  {
    tags: ['摄影', '城市', '观察'],
    lines: [
      '带着相机在雨后出门，地面反光把街灯拉成长条。拍了几张并不完美的照片，但过程本身足够好。',
      '记录楼下树影随季节变化的小系列。今天补了春末的一张，打算做成年度对比。'
    ]
  },
  {
    tags: ['家人', '电话', '牵挂'],
    lines: [
      '和家里人通了长电话，聊近况也聊琐事。挂断后觉得距离被缩短了一些。',
      '收到家人寄来的家乡特产，包装朴素，味道熟悉。立刻分了一些给室友。'
    ]
  },
  {
    tags: ['写作', '反思', '记录'],
    lines: [
      '把最近几周的碎片想法写成短文，不追求发表，只为把感受从脑子里挪到纸上。',
      '回顾月初定的目标，完成度一般，但方向没有偏。调整节奏，比苛责自己更有用。'
    ]
  },
  {
    tags: ['咖啡', '早晨', '仪式'],
    lines: [
      '试了新的冲煮比例，酸质干净，尾韵带一点坚果香。早晨的十分钟，算是一天里最稳的锚点。',
      '工作日在公司楼底买了热拿铁，杯壁烫手，雾气糊了眼镜。平凡瞬间也有具体形状。'
    ]
  }
]

function pick(arr, i) {
  return arr[i % arr.length]
}

function buildDiaries() {
  const entries = []
  const offsets = [
    0, -1, -2, -3, -4, -5, -7, -9, -11, -14, -16, -18, -21, -24, -27, -30, -33, -36, -39, -42, -45,
    -48, -52, -56, -60, -65, -70, -75, -80, -86, -92, -98, -105, -112, -120, -128, -136, -145, -154,
    -163, -172, -181, -190, -200, -210, -220, -235, -250, -265, -280, -295, -310, -325, -340, -355,
    -370, -385, -400, -420, -440, -460, -480, -500, -530
  ]

  for (let i = 0; i < offsets.length; i++) {
    const theme = pick(DIARY_THEMES, i)
    const line = theme.lines[i % theme.lines.length]
    const hour = 7 + ((i * 3) % 14)
    const minute = (i * 11) % 60
    const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    const content = `##### ${time}\n\n${line}`

    entries.push({
      content,
      dateDaysOffset: offsets[i],
      tags: theme.tags,
      mood: pick(MOODS, i),
      weather: pick(WEATHERS, i + 2),
      location: pick(LOCATIONS, i + 1)
    })
  }

  // 同一天多条记录：演示追加块
  entries.push({
    content: '##### 20:15\n\n晚上整理了下周日程，把会议和深度工作块分开。希望节奏比这周从容一些。',
    dateDaysOffset: -2,
    tags: ['计划', '效率'],
    mood: 'Focused'
  })

  entries.push({
    content:
      '##### 08:40\n\n跨年夜没有外出，在家泡了茶看纪录片。零点时窗外有零星烟火，安静也很好。',
    dateFixed: '2025-12-31T20:40:00',
    tags: ['跨年', '独处', '回顾'],
    mood: 'Calm'
  })

  return entries
}

function fmt(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function mondayOf(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dow = d.getDay() || 7
  d.setDate(d.getDate() - (dow - 1))
  return d
}

function buildSummaries(reference = new Date(2026, 5, 29)) {
  const summaries = []

  // 最近 8 周周报
  for (let w = 1; w <= 8; w++) {
    const weekEnd = new Date(reference)
    weekEnd.setDate(weekEnd.getDate() - (w - 1) * 7)
    const start = mondayOf(weekEnd)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    const weekNum = Math.ceil(
      ((start - new Date(start.getFullYear(), 0, 1)) / 86400000 + start.getDay() + 1) / 7
    )

    summaries.push({
      type: 'weekly',
      startDateFixed: fmt(start),
      endDateFixed: fmt(end),
      content: `##### ${start.getFullYear()}年${start.getMonth() + 1}月第${weekNum}周总结

###### 📅 时间周期
- **日期范围**: ${fmt(start)} 至 ${fmt(end)}

###### 🎯 本周核心关键词
**专注**, **平衡**, **记录**

---

###### 👥 核心人物与关系进展
- **项目同事**: 联调协作增多，沟通更直接，问题关闭速度变快。
- **老朋友**: 约了一次饭，交换近况，彼此打气。

---

###### 🎞️ 关键事件回顾 (Timeline)
- **【工作里程碑】**
    - **细节**: 完成一个迭代交付，并整理了复盘笔记。
    - **意义**: 流程上的卡点减少，团队信心提升。
- **【生活恢复】**
    - **细节**: 恢复运动与阅读节奏，睡眠略有改善。
    - **意义**: 精力回升，决策不再那么仓促。

---

###### 💡 思考与认知迭代
- **关于技术/工作**: 先写清楚再优化，比反复返工更省时间。
- **关于生活/自我**: 小范围的秩序感，能支撑更大目标。

---

###### 📊 状态评估
- **身心能量**: 6/10，中段偏低，周末有所恢复。
- **本周遗憾**: 有两晚熬夜，第二天效率打折。
- **下周展望**: 保留两个无会议半天，用于深度工作。

---
###### 🍵 给月度总结的"胶囊"
> 在交付与恢复之间找到可执行的平衡。`
    })
  }

  // 最近 6 个月月报
  for (let m = 0; m < 6; m++) {
    const monthDate = new Date(reference.getFullYear(), reference.getMonth() - m, 1)
    const y = monthDate.getFullYear()
    const mo = monthDate.getMonth() + 1
    const start = new Date(y, monthDate.getMonth(), 1)
    const end = new Date(y, monthDate.getMonth() + 1, 0)

    summaries.push({
      type: 'monthly',
      startDateFixed: fmt(start),
      endDateFixed: fmt(end),
      content: `##### ${y}年${mo}月度总结

###### 📅 日期范围
- **范围**: ${fmt(start)} 至 ${fmt(end)}

###### 🎯 本月核心主题
**稳定输出**, **生活节律**

---

###### 📈 关键进展与成就
- **工作/技术**: 完成阶段性目标，文档与测试覆盖更完整；学会把任务切成可验证的小步。
- **生活/个人**: 维持运动频率，阅读 ${2 + (m % 3)} 本书；尝试减少无效刷手机时间。

---

###### 👥 核心关系动态
- **家人**: 通话次数增加，节日互寄小礼物。
- **同伴**: 小组协作更默契，冲突能当天澄清。

---

###### 💡 深度思考
本月意识到「记录」本身是一种自我对话。日记不必华丽，真实即可。把感受写下来，第二天往往更冷静。

---

###### 📊 状态评估 (0-10)
- **状态**: ${6 + (m % 3)}
- **满意度**: ${6 + ((m + 1) % 4)}

---
###### 🔮 下月展望
- **重点方向**: 保留固定写作时间；推进一个搁置 side project 的首个可用版本。`
    })
  }

  // Q1 / Q2 2026 季报
  const quarters = [
    { y: 2026, q: 1, start: '2026-01-01', end: '2026-03-31' },
    { y: 2026, q: 2, start: '2026-04-01', end: '2026-06-30' }
  ]
  for (const q of quarters) {
    summaries.push({
      type: 'quarterly',
      startDateFixed: q.start,
      endDateFixed: q.end,
      content: `##### ${q.y}年第${q.q}季度总结

###### 📅 时间范围
- **范围**: ${q.start} 至 ${q.end}

###### 🎯 季度主题
**构建系统**, **恢复弹性**

---

###### 📈 阶段成果
- 工作流从「救火」转向「可预测交付」，复盘机制固定下来。
- 个人层面重建运动与阅读习惯，睡眠质量整体改善。

---

###### 🔄 关系与协作
跨组沟通成本下降；与朋友保持低频但高质量的见面。

---

###### 💡 认知升级
开始区分「忙碌」与「有效」——日历满不等于进展满。学会拒绝低优先级请求。

---

###### 📊 季度状态 (0-10)
- **整体**: 7
- **工作**: 7
- **生活**: 6

---
###### 🧭 下季度方向
- 深化一个技术专题；安排一次短途出行作为奖励。`
    })
  }

  // 2025 年报
  summaries.push({
    type: 'yearly',
    startDateFixed: '2025-01-01',
    endDateFixed: '2025-12-31',
    content: `##### 2025年度总结

###### 📅 时间范围
- **范围**: 2025-01-01 至 2025-12-31

###### 🎯 年度关键词
**迁移**, **重建**, **记录**

---

###### 🏆 年度亮点
- 换了工作环境，适应新节奏并完成首个大版本发布。
- 坚持日记习惯，全年记录超过 200 天，回看时能看见情绪曲线。
- 学会一项新技能（基础摄影构图），旅行照片质量明显提升。

---

###### 📉 挑战与教训
- 上半年作息混乱，导致多次低效周；下半年用固定睡前流程拉回正轨。
- 曾过度承诺并行任务，后来改为「最多两个主战场」原则。

---

###### 👥 重要关系
家人支持是底色；几位老友是压力阀；团队里建立了互信。

---

###### 💡 年度领悟
生活不是连续高光，而是大量普通日子加上少量决定性瞬间。记录普通，才能留住决定性。

---

###### 📊 年度评分 (0-10)
- **成长**: 8
- **健康**: 6
- **关系**: 7
- **工作**: 7

---
###### 🌱 2026 展望
- 保持记录与运动；完成一个个人作品；留更多空白给意外之喜。`
  })

  return summaries
}

function serializeDiaries(entries) {
  return `/** 自动生成 — 运行 node scripts/generate-demo-data.mjs 更新 */\nimport type { DemoDiaryEntry } from './demo-data.types'\n\nexport const DEMO_DIARIES: DemoDiaryEntry[] = ${JSON.stringify(entries, null, 2)}\n`
}

function serializeSummaries(entries) {
  const body = entries
    .map((e) => {
      const content = JSON.stringify(e.content)
      return `  {
    type: SummaryType.${e.type},
    startDateFixed: ${JSON.stringify(e.startDateFixed)},
    endDateFixed: ${JSON.stringify(e.endDateFixed)},
    content: ${content}
  }`
    })
    .join(',\n')

  return `/** 自动生成 — 运行 node scripts/generate-demo-data.mjs 更新 */
import { SummaryType } from '../types/summary.types'
import type { DemoSummaryEntry } from './demo-data.types'

export const DEMO_SUMMARIES: DemoSummaryEntry[] = [
${body}
]
`
}

mkdirSync(OUT_DIR, { recursive: true })

const diaries = buildDiaries()
const summaries = buildSummaries()

writeFileSync(join(OUT_DIR, 'demo-diaries.generated.ts'), serializeDiaries(diaries))
writeFileSync(join(OUT_DIR, 'demo-summaries.generated.ts'), serializeSummaries(summaries))

console.log(`Generated ${diaries.length} diaries, ${summaries.length} summaries -> ${OUT_DIR}`)
