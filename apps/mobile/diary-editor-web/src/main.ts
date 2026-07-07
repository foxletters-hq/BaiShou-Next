import './types'
import { bootstrap } from './diary-editor-messages'

try {
  bootstrap()
} catch (error) {
  console.error('[diary-cm] bootstrap failed:', error)
}
