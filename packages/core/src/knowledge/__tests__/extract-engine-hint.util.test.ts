import { describe, expect, it } from 'vitest'
import { recommendVisionExtract } from '../extract-engine-hint.util'

describe('recommendVisionExtract', () => {
  it('does not prompt when most sampled pages have usable text', () => {
    const page =
      '视听语言是电影艺术的基础，蒙太奇通过镜头组接创造新的意义，场面调度决定人物在空间中的位置与关系，声音则补足画面没有直接给出的信息。'
    expect(recommendVisionExtract([page, page, page])).toMatchObject({
      recommendVision: false,
      reason: null,
      usableTextPages: 3
    })
  })

  it('prompts vision when the text layer is garbled', () => {
    const garbled =
      '和 1 AR 1 次 兴 SN=A I E 4 人 人 0 0 加 Ar 区，和 0 人 0 人 N S ee 1 1 由 0 | 人 0 0 人 RE 省 区 的'
    const hint = recommendVisionExtract([garbled, garbled, garbled])
    expect(hint.recommendVision).toBe(true)
    expect(hint.reason).toBe('garbled-text-layer')
    expect(hint.garbledPages).toBe(3)
  })

  it('prompts vision when sampled pages have almost no text layer', () => {
    const hint = recommendVisionExtract(['', '   ', '封面'])
    expect(hint.recommendVision).toBe(true)
    expect(hint.reason).toBe('empty-text-layer')
  })

  it('does not prompt when two of three sampled pages are usable', () => {
    const page =
      '视听语言是电影艺术的基础，蒙太奇通过镜头组接创造新的意义，场面调度决定人物在空间中的位置与关系，声音则补足画面没有直接给出的信息。'
    const hint = recommendVisionExtract([page, '', page])
    expect(hint.recommendVision).toBe(false)
    expect(hint.usableTextPages).toBe(2)
  })
})
