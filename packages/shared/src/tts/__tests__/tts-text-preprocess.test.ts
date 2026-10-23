import { describe, expect, it } from 'vitest'
import {
  prepareTtsSpeechChunks,
  splitTtsTextIntoChunks,
  stripFencedCodeBlocks,
  stripMarkdownForTts
} from '../tts-text-preprocess'
import {
  getTtsPlaybackGeneration,
  registerTtsPlaybackStopHandler,
  stopAllTtsPlayback
} from '../tts-playback-coordinator'

describe('stripFencedCodeBlocks', () => {
  it('removes fenced code blocks', () => {
    const input = '前言\n```ts\nconst x = 1\n```\n后语'
    expect(stripFencedCodeBlocks(input)).toBe('前言\n \n后语')
  })

  it('removes tilde fenced blocks', () => {
    const input = 'A\n~~~js\ncode()\n~~~\nB'
    expect(stripFencedCodeBlocks(input)).toBe('A\n \nB')
  })
})

describe('stripMarkdownForTts', () => {
  it('strips inline formatting, links, images and hashtags', () => {
    const input = '**今天** #日记 很开心，见[官网](https://example.com)和![截图](a.png)。'
    expect(stripMarkdownForTts(input)).toBe('今天 日记 很开心，见官网和截图。')
  })

  it('strips headings, quotes and list markers', () => {
    const input = '##### 12:30\n> 引用一句\n- 列表项'
    expect(stripMarkdownForTts(input)).toBe('12:30\n引用一句\n列表项')
  })

  it('strips markdown tables and joins cells naturally', () => {
    const input = [
      '| 事项 | 金额 | 状态 |',
      '| :--- | :---: | ---: |',
      '| 咖啡 | 25元 | 已完成 |',
      '| 午餐 | 40元 | 未完成 |'
    ].join('\n')
    expect(stripMarkdownForTts(input)).toBe(
      ['事项，金额，状态', '咖啡，25元，已完成', '午餐，40元，未完成'].join('\n')
    )
  })

  it('strips tables without outer pipes and handles empty cells', () => {
    const input = ['项目 | 备注', '--- | ---', '散步 | ', '看书 | 读完一章'].join('\n')
    expect(stripMarkdownForTts(input)).toBe(['项目，备注', '散步', '看书，读完一章'].join('\n'))
  })

  it('strips bare URLs while preserving punctuation', () => {
    const input = '查看 https://example.com/guide/123。另外请看 https://github.com/foo. 很好！'
    expect(stripMarkdownForTts(input)).toBe('查看。另外请看. 很好！')
  })

  it('strips HTML tags, comments and decodes entities', () => {
    const input =
      '<div class="card"><strong>重要提示</strong><!-- 隐藏注释 --></div>&nbsp;&amp;&nbsp;测试'
    expect(stripMarkdownForTts(input)).toBe('重要提示 & 测试')
  })

  it('strips math blocks and simplifies inline math formulas', () => {
    const input = '公式：$$\n\\sum x_i\n$$ 以及行内公式 $a \\times b = c$。衣服价格 $100。'
    expect(stripMarkdownForTts(input)).toBe('公式： 以及行内公式 a × b = c。衣服价格 $100。')
  })
})

describe('splitTtsTextIntoChunks', () => {
  it('splits on Chinese punctuation', () => {
    expect(splitTtsTextIntoChunks('你好，世界。再见！')).toEqual(['你好，', '世界。', '再见！'])
  })

  it('splits on English punctuation', () => {
    expect(splitTtsTextIntoChunks('Hello, world. Bye!')).toEqual(['Hello,', 'world.', 'Bye!'])
  })

  it('does not split decimals at period', () => {
    expect(splitTtsTextIntoChunks('Version 3.14 is stable.')).toEqual(['Version 3.14 is stable.'])
  })
})

describe('prepareTtsSpeechChunks', () => {
  it('strips code and splits mixed content', () => {
    const input = '请看说明，```python\nprint(1)\n```然后继续。OK, done.'
    expect(prepareTtsSpeechChunks(input)).toEqual(['请看说明，', '然后继续。', 'OK,', 'done.'])
  })

  it('returns empty array for code-only content', () => {
    expect(prepareTtsSpeechChunks('```js\nonly code\n```')).toEqual([])
  })
})

describe('tts-playback-coordinator', () => {
  it('stopAllTtsPlayback invokes all registered handlers and bumps generation', async () => {
    const calls: string[] = []
    const unregisterA = registerTtsPlaybackStopHandler(() => {
      calls.push('a')
    })
    const unregisterB = registerTtsPlaybackStopHandler(async () => {
      calls.push('b')
    })
    const before = getTtsPlaybackGeneration()

    await stopAllTtsPlayback()

    expect(calls).toEqual(['a', 'b'])
    expect(getTtsPlaybackGeneration()).toBe(before + 1)

    unregisterA()
    unregisterB()
  })
})
