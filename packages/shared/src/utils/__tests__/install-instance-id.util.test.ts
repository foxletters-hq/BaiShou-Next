import { describe, it, expect, beforeEach } from 'vitest'
import { resolveInstallInstanceId } from '../install-instance-id.util'

describe('resolveInstallInstanceId', () => {
  const storageDir = '/app/private'
  let files: Map<string, string>

  beforeEach(() => {
    files = new Map()
  })

  const storage = {
    exists: (path: string) => files.has(path),
    read: async (path: string) => files.get(path) || '',
    write: async (path: string, content: string) => {
      files.set(path, content)
    },
    mkdir: async () => {}
  }

  it('reuses persisted install instance id', async () => {
    files.set(`${storageDir}/install_instance_id`, 'desktop-abc')

    const id = await resolveInstallInstanceId('desktop', storageDir, storage)
    expect(id).toBe('desktop-abc')
  })

  it('creates a new id when missing', async () => {
    const id = await resolveInstallInstanceId('mobile', storageDir, storage)
    expect(id.startsWith('mobile-')).toBe(true)
    expect(files.get(`${storageDir}/install_instance_id`)).toBe(id)
  })

  it('regenerates when saved file is empty', async () => {
    files.set(`${storageDir}/install_instance_id`, '   ')
    const id = await resolveInstallInstanceId('desktop', storageDir, storage)
    expect(id.startsWith('desktop-')).toBe(true)
    expect(id.trim()).not.toBe('')
  })
})
