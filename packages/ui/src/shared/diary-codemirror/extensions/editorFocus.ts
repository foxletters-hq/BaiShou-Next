import { StateEffect, StateField } from '@codemirror/state'

export const editorFocusEffect = StateEffect.define<boolean>()

export const editorFocusField = StateField.define<boolean>({
  create: () => false,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(editorFocusEffect)) return effect.value
    }
    return value
  }
})
