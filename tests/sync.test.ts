import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { onRequestGet, onRequestPost } from '../functions/api/library';
import { emptyLibrary, legacyEntry } from '../src/lib/library';

// Exercise the actual route SQL against SQLite, including atomic revision checks.
function fixture() {
  const sql = new DatabaseSync(':memory:');
  sql.exec('CREATE TABLE sessions (user_id TEXT PRIMARY KEY, sync_code TEXT, session_json TEXT, updated_at INTEGER)');
  sql.exec(readFileSync(new URL('../migrations/0001_reading_library.sql', import.meta.url), 'utf8'));
  const db = { prepare(query: string) {
    let values: any[] = [];
    const statement = { bind(...args: any[]) { values = args; return statement; },
      async first() { return sql.prepare(query).get(...values) ?? null; },
      async all() { return { results: sql.prepare(query).all(...values) }; },
      async run() { const result = sql.prepare(query).run(...values); return { meta: { changes: Number(result.changes) } }; },
    }; return statement;
  }, async batch(statements: any[]) {
    sql.exec('BEGIN'); try { const results = []; for (const statement of statements) results.push(await statement.run()); sql.exec('COMMIT'); return results; }
    catch (err) { sql.exec('ROLLBACK'); throw err; }
  } };
  const get = async (device: string) => {
    const response = await onRequestGet({ request: new Request(`https://example.test/api/library?user_id=${device}`), env: { lumina_reader_db: db } } as any);
    return { status: response.status, data: await response.json() as any };
  };
  const post = async (body: unknown) => {
    const response = await onRequestPost({ request: new Request('https://example.test/api/library', { method: 'POST', body: JSON.stringify(body) }), env: { lumina_reader_db: db } } as any);
    return { status: response.status, data: await response.json() as any };
  };
  return { sql, get, post };
}
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const article = { title: 'Test', subtitle: '', body: 'A paragraph.', date: '', wordCount: 2, difficulty: 'Advanced' };
test('linked devices share subsequent writes in both directions', async () => {
  const f = fixture(); const a = await f.get(A); assert.equal(a.status, 200);
  const library = emptyLibrary(); library.entries.push(legacyEntry({ article })); library.activeId = library.entries[0].id;
  assert.equal((await f.post({ user_id: A, library, revision: 0 })).status, 200);
  const linked = await f.post({ user_id: B, action: 'link', sync_code: a.data.sync_code });
  assert.equal(linked.status, 200); assert.equal(linked.data.library.entries.length, 1);
  library.entries[0].status = 'completed';
  assert.equal((await f.post({ user_id: B, library, revision: 1 })).status, 200);
  assert.equal((await f.get(A)).data.library.entries[0].status, 'completed');
  assert.equal((await f.get(B)).data.revision, 2);
});
test('stale device cannot overwrite the current shared library', async () => {
  const f = fixture(); await f.get(A);
  const first = emptyLibrary(); first.entries.push(legacyEntry({ article }));
  await f.post({ user_id: A, library: first, revision: 0 });
  const stale = await f.post({ user_id: A, library: emptyLibrary(), revision: 0 });
  assert.equal(stale.status, 409); assert.equal(stale.data.library.entries.length, 1);
  assert.equal((await f.get(A)).data.library.entries.length, 1);
});
test('legacy linked sessions migrate together and remain in the original table', async () => {
  const f = fixture();
  f.sql.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?)').run(A, 'ABCDEF', JSON.stringify({ article, vocabularies: [], notes: [] }), 10);
  f.sql.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?)').run(B, 'ABCDEF', JSON.stringify({ article: { ...article, title: 'Second article' }, vocabularies: [], notes: [] }), 20);
  const migrated = await f.get(A);
  assert.equal(migrated.data.library.entries.length, 2); assert.equal(migrated.data.sync_code, 'ABCDEF');
  assert.equal((await f.get(B)).data.library.entries.length, 2);
  assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM sessions').get()!.n, 2);
});
test('invalid sync codes and malformed libraries do not replace saved data', async () => {
  const f = fixture(); await f.get(A);
  assert.equal((await f.post({ user_id: A, action: 'link', sync_code: '!!!!!!' })).status, 400);
  assert.equal((await f.post({ user_id: A, action: 'link', sync_code: 'ZZZZZZ' })).status, 404);
  assert.equal((await f.post({ user_id: A, library: { version: 2, entries: [{}] }, revision: 0 })).status, 400);
  assert.equal((await f.get(A)).data.revision, 0);
});
test('edited learning content and trash state survive an actual shared-library round trip', async () => {
  const f = fixture(); const account = await f.get(A);
  const library = emptyLibrary(); const entry = legacyEntry({ article });
  entry.vocabularies = [{ id: 'word', word: 'weigh on', sourceText: 'was weighing on', originalContext: 'It was weighing on her mind.', context: 'It weighs on my mind.', partOfSpeech: '动词短语', collocations: 'weigh on someone', definition: '使人担忧', paragraphId: 'p-first' }];
  entry.notes = [{ id: 'sentence', text: 'Edited sentence.', originalText: 'Original sentence.', rewrite: 'My own sentence.', comment: '主干分析', kind: 'sentence', paragraphId: 'p-first' }];
  entry.trashedAt = 42; library.entries = [entry];
  assert.equal((await f.post({ user_id: A, library, revision: 0 })).status, 200);
  const linked = await f.post({ user_id: B, action: 'link', sync_code: account.data.sync_code });
  assert.deepEqual(linked.data.library.entries[0].vocabularies, entry.vocabularies);
  assert.deepEqual(linked.data.library.entries[0].notes, entry.notes);
  assert.equal(linked.data.library.entries[0].trashedAt, 42);
});
