import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Vocabulary } from '../src/types';
import { duplicateVocabulary, mergeVocabulary, noteHtml, normalizeTerm, saveVocabulary, translationUrl, vocabularyHtml, vocabularyOccurrences } from '../src/lib/study';
import { articleContentKey, emptyLibrary, legacyEntry, mergeLibraries, restoreLibraryEntry, trashLibraryEntry } from '../src/lib/library';
const vocab = (id: string): Vocabulary => ({ id, word: 'weigh on', sourceText: 'was weighing on', definition: '使人担忧',
  context: 'The decision weighed on her mind.', originalContext: 'The decision was weighing on her mind.', paragraphId: 'p-first', paragraphIndex: 0 });
test('editing a lemma or example retains the captured original spelling and sentence', () => {
  const original = vocab('a'); const draft = { ...original, word: 'weigh', context: 'I weigh the options.', partOfSpeech: 'verb' };
  const saved = saveVocabulary([original], draft)[0];
  assert.equal(saved.word, 'weigh'); assert.equal(saved.context, 'I weigh the options.');
  assert.equal(saved.sourceText, 'was weighing on'); assert.equal(saved.originalContext, original.originalContext);
});
test('duplicate matching ignores whitespace/case without guessing grammatical forms', () => {
  assert.equal(normalizeTerm('  WEIGH   ON '), 'weigh on');
  assert.equal(duplicateVocabulary([vocab('a')], { ...vocab('b'), word: 'WEIGH ON' })?.id, 'a');
  assert.equal(duplicateVocabulary([vocab('a')], { ...vocab('b'), word: 'weighing on' }), undefined);
  assert.equal(duplicateVocabulary([vocab('a')], vocab('a')), undefined);
});
test('merging duplicates retains both meanings, examples and paragraph origins', () => {
  const first = vocab('a'); const second = { ...vocab('b'), definition: '给人压力', collocations: "weigh on someone's mind", context: 'The costs weigh on us.', originalContext: 'The costs were weighing on us.', paragraphId: 'p-second', paragraphIndex: 1 };
  const result = saveVocabulary([first, second], { ...second, word: 'WEIGH ON' }, first.id);
  assert.equal(result.length, 1); assert.equal(result[0].id, first.id);
  assert.equal(vocabularyOccurrences(result[0]).length, 2);
  assert.ok(result[0].definition.includes(first.definition)); assert.ok(result[0].definition.includes(second.definition));
  assert.deepEqual(new Set(vocabularyOccurrences(result[0]).map(o => o.paragraphId)), new Set(['p-first', 'p-second']));
  assert.equal(vocabularyOccurrences(mergeVocabulary(result[0], second)).length, 2);
});
test('an explicit separate save keeps both duplicate entries', () => {
  assert.equal(saveVocabulary([vocab('a')], vocab('b')).length, 2);
});
test('HTML export includes edited and original learning content with escaped user text', () => {
  const html = vocabularyHtml({ ...vocab('a'), word: '<script>bad()</script>', collocations: 'weigh on <b>someone</b>', partOfSpeech: 'verb' });
  assert.ok(!html.includes('<script>')); assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('was weighing on')); assert.ok(html.includes('The decision weighed on her mind.'));
  const note = noteHtml({ id: 'note', text: 'Edited sentence.', originalText: 'Original sentence.', rewrite: '<img onerror=bad()>', comment: 'Structure notes', kind: 'sentence' });
  assert.ok(note.includes('Original sentence.')); assert.ok(note.includes('Edited sentence.')); assert.ok(note.includes('&lt;img'));
});
test('translation links preserve punctuation and slashes as one encoded text payload', () => {
  const text = 'Was it A/B? Yes & no.';
  assert.ok(translationUrl('deepl', text).endsWith(encodeURIComponent(text)));
  assert.equal(new URL(translationUrl('kagi', text)).searchParams.get('text'), text);
});
const article = { title: 'An article', subtitle: '', body: 'A reading paragraph.', date: '', difficulty: 'Advanced', wordCount: 3 };
test('trash is reversible and preserves the article, vocabulary and notes', () => {
  const entry = legacyEntry({ article, vocabularies: [vocab('a')], notes: [{ id: 'n', text: 'A reading paragraph.', comment: 'note' }] });
  const library = { ...emptyLibrary(), entries: [entry], activeId: entry.id };
  const trashed = trashLibraryEntry(library, entry.id, 10);
  assert.equal(trashed.entries[0].trashedAt, 10); assert.equal(trashed.activeId, null);
  const restored = restoreLibraryEntry(trashed, entry.id, 20);
  assert.equal(restored.entries[0].trashedAt, undefined);
  assert.deepEqual(restored.entries[0].article, entry.article); assert.deepEqual(restored.entries[0].vocabularies, entry.vocabularies); assert.deepEqual(restored.entries[0].notes, entry.notes);
});
test('a stale offline device cannot silently resurrect a trashed article', () => {
  const entry = legacyEntry({ article });
  const base = { ...emptyLibrary(), entries: [entry], activeId: entry.id };
  const remote = trashLibraryEntry(base, entry.id, 20);
  const merged = mergeLibraries(base, structuredClone(base), remote);
  assert.equal(merged.entries[0].trashedAt, 20);
});
test('duplicate import comparison tolerates HTML and whitespace without conflating different text', () => {
  assert.equal(articleContentKey({ ...article, body: '<b>A</b> reading&nbsp; paragraph.' }), articleContentKey(article));
  assert.notEqual(articleContentKey({ ...article, body: 'A different paragraph.' }), articleContentKey(article));
});
