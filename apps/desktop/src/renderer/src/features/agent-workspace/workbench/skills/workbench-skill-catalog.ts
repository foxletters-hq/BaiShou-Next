import { WRITER_SKILL_NAME } from '@baishou/shared'
import writerLatte from '../assets/writer-latte.png'

export type WorkbenchSkillCardDef = {
  name: string
  titleKey: string
  descriptionKey: string
  image: string
}

export const WORKBENCH_SKILL_CARDS: WorkbenchSkillCardDef[] = [
  {
    name: WRITER_SKILL_NAME,
    titleKey: 'workbench.skill_writer_title',
    descriptionKey: 'workbench.skill_writer_desc',
    image: writerLatte
  }
]
