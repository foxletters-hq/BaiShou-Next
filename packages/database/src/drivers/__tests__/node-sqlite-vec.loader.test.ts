import { describe, it, expect, vi } from 'vitest'
import { resolveNodeSqliteVecPath, loadNodeSqliteVecExtension } from '../node-sqlite.driver'

describe('node-sqlite-vec loader', () => {
  describe('resolveNodeSqliteVecPath', () => {
    it('should replace app.asar with app.asar.unpacked on Windows paths', () => {
      const raw =
        'C:\\Program Files\\BaiShou\\resources\\app.asar\\node_modules\\sqlite-vec-windows-x64\\vec0.dll'
      expect(resolveNodeSqliteVecPath(raw)).toBe(
        'C:\\Program Files\\BaiShou\\resources\\app.asar.unpacked\\node_modules\\sqlite-vec-windows-x64\\vec0.dll'
      )
    })

    it('should replace app.asar with app.asar.unpacked on POSIX paths', () => {
      const raw = '/opt/BaiShou/resources/app.asar/node_modules/sqlite-vec-linux-x64/vec0.so'
      expect(resolveNodeSqliteVecPath(raw)).toBe(
        '/opt/BaiShou/resources/app.asar.unpacked/node_modules/sqlite-vec-linux-x64/vec0.so'
      )
    })

    it('should keep non-asar development paths unchanged', () => {
      const raw = '/home/dev/BaiShou-Next/node_modules/sqlite-vec-linux-x64/vec0.so'
      expect(resolveNodeSqliteVecPath(raw)).toBe(raw)
    })

    it('should not double-replace paths already pointing to app.asar.unpacked', () => {
      const raw =
        'C:\\Program Files\\BaiShou\\resources\\app.asar.unpacked\\node_modules\\sqlite-vec-windows-x64\\vec0.dll'
      expect(resolveNodeSqliteVecPath(raw)).toBe(raw)
    })
  })

  describe('loadNodeSqliteVecExtension', () => {
    it('should load extension using unpacked path when getLoadablePath is provided', () => {
      const loadExtension = vi.fn()
      const load = vi.fn()
      const resolved = loadNodeSqliteVecExtension(
        { loadExtension },
        {
          getLoadablePath: () =>
            'C:\\Apps\\BaiShou\\resources\\app.asar\\node_modules\\sqlite-vec-windows-x64\\vec0.dll',
          load
        }
      )

      expect(resolved).toBe(
        'C:\\Apps\\BaiShou\\resources\\app.asar.unpacked\\node_modules\\sqlite-vec-windows-x64\\vec0.dll'
      )
      expect(loadExtension).toHaveBeenCalledTimes(1)
      expect(loadExtension).toHaveBeenCalledWith(
        'C:\\Apps\\BaiShou\\resources\\app.asar.unpacked\\node_modules\\sqlite-vec-windows-x64\\vec0.dll'
      )
      expect(load).not.toHaveBeenCalled()
    })

    it('should fall back to sqliteVec.load when getLoadablePath is not available', () => {
      const sqlite = { loadExtension: vi.fn() }
      const load = vi.fn()

      const resolved = loadNodeSqliteVecExtension(sqlite, { load })

      expect(resolved).toBe('')
      expect(load).toHaveBeenCalledTimes(1)
      expect(load).toHaveBeenCalledWith(sqlite)
      expect(sqlite.loadExtension).not.toHaveBeenCalled()
    })
  })
})
