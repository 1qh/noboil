import { describe, expect, test } from 'bun:test'
import { rlsChildSql, rlsJoinWhereSender, rlsSql, rlsWherePub, rlsWhereSender } from '../rls'
describe('stdb rls SQL builders', () => {
  test('rlsWhereSender produces SELECT WHERE :sender clause', () => {
    expect(rlsWhereSender('blog', 'userId')).toContain(':sender')
  })
  test('rlsWherePub uses pub column = true', () => {
    expect(rlsWherePub('blog', 'published')).toContain('"published" = true')
  })
  test('rlsJoinWhereSender wires JOIN + WHERE', () => {
    const sql = rlsJoinWhereSender('blog', 'orgMember', 'orgId')
    expect(sql).toContain('JOIN')
    expect(sql).toContain(':sender')
  })
  test('rlsChildSql with parentPub=true returns empty (RLS-free)', () => {
    expect(rlsChildSql({ fk: 'parent', name: 'msg', parent: 'chat', parentPub: true })).toEqual([])
  })
  test('rlsChildSql without parentPub yields one WHERE clause', () => {
    const out = rlsChildSql({ fk: 'parent', name: 'msg', parent: 'chat' })
    expect(out.length).toBe(1)
  })
  test('rlsSql owned + string pub yields PubOrSender', () => {
    const sql = rlsSql('blog', 'owned', 'published')
    expect(sql[0]).toContain(':sender')
  })
  test('rlsSql kv yields SELECT *', () => {
    expect(rlsSql('settings', 'kv')[0]).toContain('SELECT *')
  })
  test('rlsSql log yields sender clause', () => {
    expect(rlsSql('vote', 'log')[0]).toContain(':sender')
  })
  test('rlsSql pub=true yields no clauses', () => {
    expect(rlsSql('blog', 'owned', true)).toEqual([])
  })
  test('rlsSql orgScoped + base + quota + org yield empty', () => {
    expect(rlsSql('p', 'orgScoped')).toEqual([])
    expect(rlsSql('p', 'base')).toEqual([])
    expect(rlsSql('p', 'quota')).toEqual([])
    expect(rlsSql('p', 'org')).toEqual([])
  })
  test('rlsSql singleton + file behave like owned', () => {
    expect(rlsSql('profile', 'singleton')[0]).toContain(':sender')
    expect(rlsSql('upload', 'file')[0]).toContain(':sender')
  })
})
