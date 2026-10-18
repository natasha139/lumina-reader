import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyLibrary, getParagraphs, legacyEntry, mergeLibraries, normalizeLibrary, withParagraphs, type ReadingLibrary } from '../src/lib/library';
import type { Article } from '../src/types';
const article: Article = { title: 'A careful reading', subtitle: '', body: 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.', translationBody: '第一段\n\n\n\n第三段', date: '', difficulty: 'Advanced', wordCount: 6 };
const library = (): ReadingLibrary => { const entry = legacyEntry({ article }); return { version: 2, entries: [entry], activeId: entry.id }; };
test('migrates a saved session without losing vocabulary or empty translations', () => {
  const migrated = normalizeLibrary({ article, vocabularies: [{ id: 'word-1', word: 'careful', definition: '仔细的', context: 'A careful reading' }], notes: [] });
  assert.equal(migrated.entries[0].vocabularies.length, 1);
  assert.deepEqual(getParagraphs(migrated.entries[0].article).map(p => p.zh), ['第一段', '', '第三段']);
  assert.deepEqual(normalizeLibrary(migrated), migrated);
});
test('editing an empty middle translation preserves paragraph IDs and later alignment', () => {
  const original = getParagraphs(article);
  const edited = withParagraphs(article, original.map((p, i) => i === 1 ? { ...p, zh: '第二段' } : p));
  assert.deepEqual(getParagraphs(edited).map(p => p.id), original.map(p => p.id));
  const cleared = withParagraphs(edited, getParagraphs(edited).map((p, i) => i === 0 ? { ...p, en: '', zh: '' } : p));
  assert.equal(getParagraphs(cleared).length, 3);
  assert.equal(getParagraphs(cleared)[2].zh, '第三段');
});
test('offline edits to different articles are merged', () => {
  const base = library();
  const local = structuredClone(base); local.entries[0].status = 'completed';
  const remote = structuredClone(base); remote.entries.push({ ...legacyEntry({ article: { ...article, title: 'Another article' } }), id: 'new' });
  const merged = mergeLibraries(base, local, remote);
  assert.equal(merged.entries.length, 2);
  assert.equal(merged.entries.find(e => e.id === base.activeId)?.status, 'completed');
});
test('concurrent changes to one article retain both versions and merge idempotently', () => {
  const base = library(); const local = structuredClone(base); const remote = structuredClone(base);
  local.entries[0].article.subtitle = 'local'; remote.entries[0].article.subtitle = 'remote';
  const merged = mergeLibraries(base, local, remote);
  assert.equal(merged.entries.length, 2);
  assert.deepEqual(new Set(merged.entries.map(e => e.article.subtitle)), new Set(['local', 'remote']));
  assert.deepEqual(mergeLibraries(remote, merged, merged), merged);
});
test('initial import into a different library retains local articles', () => {
  const local = library(); const remote = library(); remote.entries[0].id = 'remote-article';
  assert.equal(mergeLibraries(emptyLibrary(), local, remote).entries.length, 2);
});
