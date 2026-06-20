import { describe, expect, it } from 'vitest'
import {
  prepareTtsSpeechChunks,
  splitTtsTextIntoChunks,
  stripFencedCodeBlocks
} from '../tts-text-preprocess'

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
