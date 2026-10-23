import { describe, expect, it } from 'vitest'
import {
  buildCompanionAskQuestionAnswers,
  companionAskAnswersComplete,
  companionAskQuestionAnswered,
  normalizeCompanionAskQuestions,
  readQuestionAnswer,
  resolveCompanionAskQuestions
} from '../companion-ask-questions.util'

describe('normalizeCompanionAskQuestions', () => {
  it('should keep a single question when questions is omitted', () => {
    const questions = normalizeCompanionAskQuestions({
      question: '文件夹叫什么？',
      options: ['写作-3', '先不创建'],
      allowCustomInput: true
    })
    expect(questions).toHaveLength(1)
    expect(questions[0]).toMatchObject({
      id: '0',
      question: '文件夹叫什么？',
      allowCustomInput: true
    })
    expect(questions[0]?.options.map((option) => option.label)).toEqual(['写作-3', '先不创建'])
  })

  it('should keep independent questions in one batch', () => {
    const questions = normalizeCompanionAskQuestions({
      questions: [
        { question: '放在哪个文件夹？', options: ['当前根目录下新建', '先不创建'] },
        { question: '文件夹叫什么？', options: ['写作-3'], allowCustomInput: true }
      ]
    })
    expect(questions).toHaveLength(2)
    expect(questions.map((item) => item.question)).toEqual(['放在哪个文件夹？', '文件夹叫什么？'])
  })

  it('should preserve multiple flag on single and batched questions', () => {
    const single = normalizeCompanionAskQuestions({
      question: '要检查哪几篇总结？',
      options: ['2026-03-02 周总结', '2026-03-09 周总结'],
      multiple: true
    })
    expect(single[0]?.multiple).toBe(true)

    const batched = normalizeCompanionAskQuestions({
      questions: [
        { question: '检查方式？', options: ['指定几篇', '最近几篇'] },
        { question: '选哪几篇？', options: ['A', 'B'], multiple: true }
      ]
    })
    expect(batched[0]?.multiple).toBeUndefined()
    expect(batched[1]?.multiple).toBe(true)
  })
})

describe('companionAskAnswersComplete', () => {
  const questions = normalizeCompanionAskQuestions({
    questions: [
      { question: '放在哪？', options: ['A', 'B'], allowCustomInput: false },
      { question: '叫什么？', options: ['写作'], allowCustomInput: true }
    ]
  })

  it('should treat a question as unanswered when no option or custom text is set', () => {
    expect(
      companionAskQuestionAnswered(questions[0]!, { questionId: '0', selectedOptionId: null })
    ).toBe(false)
    expect(
      companionAskQuestionAnswered(questions[0]!, { questionId: '0', selectedOptionId: '0' })
    ).toBe(true)
  })

  it('should wait until every question has an option or custom answer', () => {
    expect(
      companionAskAnswersComplete(questions, [{ questionId: '0', selectedOptionId: '0' }])
    ).toBe(false)
    expect(
      companionAskAnswersComplete(questions, [
        { questionId: '0', selectedOptionId: '0' },
        { questionId: '1', message: '写作-3' }
      ])
    ).toBe(true)
  })
})

describe('buildCompanionAskQuestionAnswers', () => {
  it('should keep selected option and custom text per question', () => {
    const questions = normalizeCompanionAskQuestions({
      questions: [
        { question: '放在哪？', options: ['A', 'B'] },
        { question: '叫什么？', options: ['写作'] }
      ]
    })
    expect(
      buildCompanionAskQuestionAnswers(questions, [
        { questionId: '0', selectedOptionId: '1' },
        { questionId: '1', message: '写作-3' }
      ])
    ).toEqual([
      { questionId: '0', selectedOptionIds: ['1'], message: undefined },
      { questionId: '1', selectedOptionIds: [], message: '写作-3' }
    ])
  })

  it('should keep multiple selectedOptionIds when multiple options are chosen', () => {
    const questions = normalizeCompanionAskQuestions({
      question: '要修复哪几篇？',
      options: ['A', 'B', 'C'],
      multiple: true
    })
    expect(
      buildCompanionAskQuestionAnswers(questions, [
        { questionId: '0', selectedOptionIds: ['0', '2'] }
      ])
    ).toEqual([{ questionId: '0', selectedOptionIds: ['0', '2'], message: undefined }])
  })
})

describe('resolveCompanionAskQuestions', () => {
  it('should fall back to title and options for a single-question card', () => {
    const questions = resolveCompanionAskQuestions({
      title: '继续吗？',
      options: [{ id: '0', label: '是' }],
      allowCustomInput: false
    })
    expect(questions).toEqual([
      {
        id: '0',
        question: '继续吗？',
        options: [{ id: '0', label: '是' }],
        allowCustomInput: false
      }
    ])
  })
})

describe('readQuestionAnswer', () => {
  it('should read the selected label for a single question from selectedOptionIds', () => {
    const [question] = normalizeCompanionAskQuestions({
      question: '选哪个？',
      options: ['A', 'B']
    })
    expect(readQuestionAnswer(question!, { selectedOptionIds: ['1'] }, true)).toEqual({
      answer: 'B',
      selectedOptionIds: ['1']
    })
  })

  it('should join multiple selected labels for a multi-select question', () => {
    const [question] = normalizeCompanionAskQuestions({
      question: '要修哪几篇？',
      options: ['第10周', '第11周', '3月月报'],
      multiple: true
    })
    expect(readQuestionAnswer(question!, { selectedOptionIds: ['0', '2'] }, true)).toEqual({
      answer: '第10周、3月月报',
      selectedOptionIds: ['0', '2']
    })
  })
})
