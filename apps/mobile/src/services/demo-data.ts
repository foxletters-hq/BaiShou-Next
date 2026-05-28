/** Minimal demo diaries for mobile developer tools (subset of desktop demo-data). */
export interface DemoDiaryEntry {
  content: string
  dateDaysOffset?: number
  dateMinutesOffset?: number
  dateFixed?: string
  tags?: string[]
  mood?: string
}

export const INITIAL_DIARIES: DemoDiaryEntry[] = [
  {
    content:
      '今天去听了一场小型音乐会。那把大提琴的音色像极了秋天被阳光晒过的落叶，沉稳又温暖。',
    dateDaysOffset: 0,
    dateMinutesOffset: -5,
    tags: ['音乐会', '治愈', '秋天'],
    mood: 'Peaceful'
  },
  {
    content:
      '在离家不远的小巷子里发现了一只三花猫。它懒洋洋地趴在长满青苔的石阶上，眯着眼冲我叫了一声。',
    dateDaysOffset: -1,
    tags: ['小猫', '偶遇', '温暖'],
    mood: 'Happy'
  },
  {
    content:
      '终于去吃了那家被推荐了很多次的拉面店。热气腾腾的骨汤，劲道的面条，还有那枚恰到好处的溏心蛋。',
    dateDaysOffset: -2,
    tags: ['美食', '拉面', '满足'],
    mood: 'Content'
  }
]
