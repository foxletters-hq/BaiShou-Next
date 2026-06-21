import { StateEffect } from '@codemirror/state'

export const forceImageRefresh = StateEffect.define()

let updateImageWidthCallback: ((from: number, to: number, newWidth: number) => void) | null = null

export function setUpdateImageWidthCallback(
  callback: (from: number, to: number, newWidth: number) => void
) {
  updateImageWidthCallback = callback
}

export function invokeUpdateImageWidth(from: number, to: number, newWidth: number) {
  updateImageWidthCallback?.(from, to, newWidth)
}

export type ImageAction = 'delete' | 'copy' | 'open'

let imageActionCallback:
  | ((action: ImageAction, from: number, to: number, src: string) => void)
  | null = null

export function setImageActionCallback(
  callback: ((action: ImageAction, from: number, to: number, src: string) => void) | null
) {
  imageActionCallback = callback
}

export function invokeImageAction(action: ImageAction, from: number, to: number, src: string) {
  imageActionCallback?.(action, from, to, src)
}
