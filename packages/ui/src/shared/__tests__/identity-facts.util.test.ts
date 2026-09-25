import { describe, expect, it } from 'vitest'
import { applyIdentityFactEdit, deleteIdentityFact } from '../identity-facts.util'

describe('applyIdentityFactEdit', () => {
  it('should reject empty key or value', () => {
    expect(applyIdentityFactEdit({}, null, '  ', '独立开发者')).toEqual({
      ok: false,
      error: 'empty'
    })
    expect(applyIdentityFactEdit({}, null, '职业', '   ')).toEqual({
      ok: false,
      error: 'empty'
    })
  })

  it('should reject renaming onto an existing key', () => {
    expect(applyIdentityFactEdit({ 职业: '开发者', 姓名: 'A' }, '职业', '姓名', '开发者')).toEqual({
      ok: false,
      error: 'duplicate'
    })
  })

  it('should add a new fact and rename an existing key', () => {
    expect(applyIdentityFactEdit({ 姓名: 'A' }, null, '职业', '独立开发者')).toEqual({
      ok: true,
      facts: { 姓名: 'A', 职业: '独立开发者' }
    })
    expect(applyIdentityFactEdit({ 旧名: 'A' }, '旧名', '姓名', 'A')).toEqual({
      ok: true,
      facts: { 姓名: 'A' }
    })
  })
})

describe('deleteIdentityFact', () => {
  it('should remove the given key and leave others', () => {
    expect(deleteIdentityFact({ 姓名: 'A', 职业: 'B' }, '职业')).toEqual({ 姓名: 'A' })
  })
})
