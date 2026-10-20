import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { VaultIsolationFixture } from './vault-isolation.v1.test-helpers'
import {
  VAULT_A,
  VAULT_B,
  createVaultIsolationFixture,
  disposeVaultIsolationFixture
} from './vault-isolation.v1.test-helpers'

describe('vault isolation V2.2 (vault_id) — 会话与配置隔离', () => {
  let fixture: VaultIsolationFixture

  beforeEach(async () => {
    fixture = await createVaultIsolationFixture()
  })

  afterEach(async () => {
    await disposeVaultIsolationFixture(fixture)
  })

  it('3) session list scoped by vault_id', async () => {
    const { db } = fixture
    await db.execute({
      sql: `INSERT INTO agent_sessions (id, title, vault_id) VALUES (?, ?, ?)`,
      args: ['sA', 'Session A', VAULT_A]
    })
    await db.execute({
      sql: `INSERT INTO agent_sessions (id, title, vault_id) VALUES (?, ?, ?)`,
      args: ['sB', 'Session B', VAULT_B]
    })

    const inA = await db.execute({
      sql: `SELECT id FROM agent_sessions WHERE vault_id = ?`,
      args: [VAULT_A]
    })
    expect(inA.rows.map((r) => r.id)).toEqual(['sA'])
  })

  it('4b) assistant list scoped by vault_id; same id can coexist across vaults', async () => {
    const { db } = fixture
    await db.execute({
      sql: `INSERT INTO agent_assistants (id, vault_id, name) VALUES ('default', ?, 'A')`,
      args: [VAULT_A]
    })
    await db.execute({
      sql: `INSERT INTO agent_assistants (id, vault_id, name) VALUES ('default', ?, 'B')`,
      args: [VAULT_B]
    })

    const inA = await db.execute({
      sql: `SELECT name FROM agent_assistants WHERE vault_id = ?`,
      args: [VAULT_A]
    })
    expect(inA.rows.map((r) => r.name)).toEqual(['A'])

    const allDefaults = await db.execute({
      sql: `SELECT count(*) as c FROM agent_assistants WHERE id = 'default'`
    })
    expect(Number(allDefaults.rows[0]?.c)).toBe(2)
  })

  it('4c) summaries unique allows same period in different vaults', async () => {
    const { db } = fixture
    await db.execute({
      sql: `INSERT INTO summaries (vault_id, type, start_date, end_date, content, generated_at)
            VALUES (?, 'weekly', 10, 20, 'A', 1)`,
      args: [VAULT_A]
    })
    await db.execute({
      sql: `INSERT INTO summaries (vault_id, type, start_date, end_date, content, generated_at)
            VALUES (?, 'weekly', 10, 20, 'B', 1)`,
      args: [VAULT_B]
    })
    const inA = await db.execute({
      sql: `SELECT content FROM summaries WHERE vault_id = ?`,
      args: [VAULT_A]
    })
    expect(inA.rows.map((r) => r.content)).toEqual(['A'])
  })

  it('5b) §9 switch to B: session/assistant lists are B; A rows remain in DB', async () => {
    const { db } = fixture
    await db.execute({
      sql: `INSERT INTO agent_sessions (id, title, vault_id) VALUES (?, ?, ?)`,
      args: ['sA', 'Session A', VAULT_A]
    })
    await db.execute({
      sql: `INSERT INTO agent_sessions (id, title, vault_id) VALUES (?, ?, ?)`,
      args: ['sB', 'Session B', VAULT_B]
    })
    await db.execute({
      sql: `INSERT INTO agent_assistants (id, vault_id, name) VALUES ('default', ?, 'Ast A')`,
      args: [VAULT_A]
    })
    await db.execute({
      sql: `INSERT INTO agent_assistants (id, vault_id, name) VALUES ('default', ?, 'Ast B')`,
      args: [VAULT_B]
    })
    await db.execute({
      sql: `INSERT INTO summaries (vault_id, type, start_date, end_date, content, generated_at)
            VALUES (?, 'monthly', 1, 2, 'sumA', 1)`,
      args: [VAULT_A]
    })
    await db.execute({
      sql: `INSERT INTO summaries (vault_id, type, start_date, end_date, content, generated_at)
            VALUES (?, 'monthly', 1, 2, 'sumB', 1)`,
      args: [VAULT_B]
    })

    // 模拟切到 B：列表只看 B
    const sessionsB = await db.execute({
      sql: `SELECT id FROM agent_sessions WHERE vault_id = ?`,
      args: [VAULT_B]
    })
    expect(sessionsB.rows.map((r) => r.id)).toEqual(['sB'])
    const assistantsB = await db.execute({
      sql: `SELECT name FROM agent_assistants WHERE vault_id = ?`,
      args: [VAULT_B]
    })
    expect(assistantsB.rows.map((r) => r.name)).toEqual(['Ast B'])
    const summariesB = await db.execute({
      sql: `SELECT content FROM summaries WHERE vault_id = ?`,
      args: [VAULT_B]
    })
    expect(summariesB.rows.map((r) => r.content)).toEqual(['sumB'])

    // A 的行仍在库（废除切换重建）
    const assistantsA = await db.execute({
      sql: `SELECT name FROM agent_assistants WHERE vault_id = ?`,
      args: [VAULT_A]
    })
    expect(assistantsA.rows.map((r) => r.name)).toEqual(['Ast A'])
    const sessionsA = await db.execute({
      sql: `SELECT id FROM agent_sessions WHERE vault_id = ?`,
      args: [VAULT_A]
    })
    expect(sessionsA.rows.map((r) => r.id)).toEqual(['sA'])
  })
})
