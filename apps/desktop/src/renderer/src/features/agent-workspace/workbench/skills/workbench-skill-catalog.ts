import { WRITER_SKILL_NAME } from '@baishou/shared'
import writerLatte from '../assets/writer-latte.png'

export type WorkbenchSkillCardDef = {
  name: string
  titleKey: string
  titleFallback: string
  descriptionKey: string
  descriptionFallback: string
  image: string
}

export const WORKBENCH_SKILL_CARDS: WorkbenchSkillCardDef[] = [
  {
    name: WRITER_SKILL_NAME,
    titleKey: 'workbench.skill_writer_title',
    titleFallback: '故事初始化',
    descriptionKey: 'workbench.skill_writer_desc',
    descriptionFallback: '创建写作目录，并在各目录写入规范，之后按规范写作',
    image: writerLatte
  }
]
