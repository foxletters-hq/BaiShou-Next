import { TABLE_CHROME_LONG_PRESS_MS } from '../table/tableChromeTouchConstants'

export function touchPoint(el: HTMLElement, clientX = 10, clientY = 10): Touch {
  return {
    clientX,
    clientY,
    identifier: 0,
    pageX: clientX,
    pageY: clientY,
    screenX: clientX,
    screenY: clientY,
    radiusX: 0,
    radiusY: 0,
    rotationAngle: 0,
    force: 1,
    target: el
  } as Touch
}

/** 模拟触摸端长按把手 */
export function longPressChromeHandle(el: HTMLElement): void {
  const touch = touchPoint(el)
  el.dispatchEvent(
    new TouchEvent('touchstart', {
      bubbles: true,
      cancelable: true,
      touches: [touch],
      changedTouches: [touch]
    })
  )
}

export function finishLongPressChromeHandle(): void {
  document.dispatchEvent(
    new TouchEvent('touchend', {
      bubbles: true,
      cancelable: true,
      touches: [],
      changedTouches: []
    })
  )
}

export { TABLE_CHROME_LONG_PRESS_MS }
