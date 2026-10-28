// Aplica as migrations num Postgres embutido (PGlite) com um esqueleto do
// ambiente Supabase (roles, auth.uid(), publicação Realtime) e testa RLS e funções.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'

const ANA = '11111111-1111-4111-8111-111111111111'
const BIA = '22222222-2222-4222-8222-222222222222'
const EVE = '33333333-3333-4333-8333-333333333333'
const M1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  create publication supabase_realtime;
`

let db: PGlite

/** Executa como um papel do Supabase; `sub` simula o usuário do JWT. */
async function as<T>(role: 'anon' | 'authenticated' | 'service_role', sub: string | null, sql: string, params: unknown[] = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${sub ?? ''}', false); set role ${role};`)
  try {
    return (await db.query<T>(sql, params)).rows
  } finally {
    await db.exec('reset role;')
  }
}

const create = (id: string, code: string, p1: string) =>
  as<{ ok: boolean }>(
    'service_role',
    null,
    `select public.create_match($1, $2, $3, 'WAITING_OPPONENT', 1::smallint, '{"v":1}'::jsonb, '{"s":1}'::jsonb, now() + interval '3 days') as ok`,
    [id, code, p1],
  )

const commit = (id: string, version: number, p2: string | null, view = '{"v":2}') =>
  as<{ ok: boolean }>(
    'service_role',
    null,
    `select public.commit_match($1, $2, $3, 'ACTIVE', 2::smallint, $4::jsonb, '{"s":2}'::jsonb, now() + interval '3 days') as ok`,
    [id, version, p2, view],
  )

beforeAll(async () => {
  db = new PGlite()
  await db.exec(SUPABASE_STUB)
  const dir = new URL('./migrations/', import.meta.url)
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(new URL(file, dir), 'utf8'))
  }
})

describe('funções do servidor', () => {
  it('create_match cria e recusa código repetido', async () => {
    expect(await create(M1, 'ABC123', ANA)).toEqual([{ ok: true }])
    expect(await create('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'ABC123', BIA)).toEqual([{ ok: false }])
  })

  it('load_match por id e por código (maiúsculas)', async () => {
    const byId = await as<{ version: number; state: unknown }>('service_role', null, 'select * from public.load_match(p_id => $1)', [M1])
    expect(byId[0]).toMatchObject({ version: 1, state: { s: 1 } })
    const byCode = await as<{ id: string }>('service_role', null, 'select * from public.load_match(p_code => $1)', ['abc123'])
    expect(byCode[0]?.id).toBe(M1)
  })

  it('commit_match exige a versão atual e preenche p2 uma vez', async () => {
    expect(await commit(M1, 1, BIA)).toEqual([{ ok: true }])
    expect(await commit(M1, 1, BIA)).toEqual([{ ok: false }])
    expect(await commit(M1, 2, EVE, '{"v":3}')).toEqual([{ ok: true }])
    const row = await as<{ version: number; p2: string; view: unknown }>('service_role', null, 'select version, p2, view from public.matches where id = $1', [M1])
    expect(row[0]).toEqual({ version: 3, p2: BIA, view: { v: 3 } })
    const st = await as<{ state: unknown }>('service_role', null, 'select state from public.match_state where match_id = $1', [M1])
    expect(st[0]?.state).toEqual({ s: 2 })
  })

  it('matches está na publicação do Realtime', async () => {
    const rows = await db.query<{ tablename: string }>(`select tablename from pg_publication_tables where pubname = 'supabase_realtime'`)
    expect(rows.rows.map((r) => r.tablename)).toContain('matches')
  })
})

describe('segurança (RLS e permissões)', () => {
  it('jogadores leem a própria partida; outros não veem nada', async () => {
    expect(await as('authenticated', ANA, 'select id from public.matches')).toHaveLength(1)
    expect(await as('authenticated', BIA, 'select id from public.matches')).toHaveLength(1)
    expect(await as('authenticated', EVE, 'select id from public.matches')).toHaveLength(0)
    expect(await as('anon', null, 'select id from public.matches').catch(() => [])).toHaveLength(0)
  })

  it('estado completo é inacessível ao cliente', async () => {
    await expect(as('authenticated', ANA, 'select * from public.match_state')).rejects.toThrow(/permission denied/)
    await expect(as('anon', null, 'select * from public.match_state')).rejects.toThrow(/permission denied/)
  })

  it('cliente não escreve em matches', async () => {
    await expect(as('authenticated', ANA, `update public.matches set view = '{}' where id = $1`, [M1])).rejects.toThrow(/permission denied/)
    await expect(as('authenticated', ANA, `delete from public.matches`)).rejects.toThrow(/permission denied/)
    await expect(
      as('authenticated', EVE, `insert into public.matches (id, code, p1, status, turn_of, view, expires_at) values ($1, 'ZZZ999', $2, 'ACTIVE', 1, '{}', now())`, [
        'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        EVE,
      ]),
    ).rejects.toThrow(/permission denied/)
  })

  it('cliente não chama as funções do servidor', async () => {
    await expect(as('authenticated', ANA, 'select public.commit_match($1, 3, null, $$ENDED$$, 1::smallint, $${}$$, $${}$$, now())', [M1])).rejects.toThrow(
      /permission denied/,
    )
    await expect(as('authenticated', ANA, 'select * from public.load_match(p_id => $1)', [M1])).rejects.toThrow(/permission denied/)
    await expect(as('anon', null, `select public.create_match($1, 'QQQ111', $2, 'ACTIVE', 1::smallint, '{}', '{}', now())`, [M1, ANA])).rejects.toThrow(
      /permission denied/,
    )
  })
})
