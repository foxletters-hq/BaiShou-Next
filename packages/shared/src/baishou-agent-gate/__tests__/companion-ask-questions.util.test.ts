import { describe, expect, it } from 'vitest'
import {
  buildCompanionAskQuestionAnswers,
  companionAskAnswersComplete,
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
})

describe('companionAskAnswersComplete', () => {
  const questions = normalizeCompanionAskQuestions({
    questions: [
      { question: '放在哪？', options: ['A', 'B'], allowCustomInput: false },
      { question: '叫什么？', options: ['写作'], allowCustomInput: true }
    ]
  })

  it('should wait until every question has an option or custom answer', () => {
    expect(companionAskAnswersComplete(questions, [{ questionId: '0', selectedOptionId: '0' }])).toBe(
      false
    )
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
    expect(
      readQuestionAnswer(question!, { selectedOptionIds: ['1'] }, true)
    ).toEqual({
      answer: 'B',
      selectedOptionIds: ['1']
    })
  })
})