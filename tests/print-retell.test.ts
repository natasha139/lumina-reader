import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PrintableReading from '../src/components/PrintableReading';
import { emptyRetell, appendExpression, normalizeRetell, retellHtml } from '../src/lib/retell';
import { getParagraphs, emptyLibrary, legacyEntry, mergeLibraries, normalizeLibrary } from '../src/lib/library';
import { paragraphNumber, printOccurrences } from '../src/lib/print';
import type { Article, Vocabulary } from '../src/types';
const article: Article = { title: 'A reading', subtitle: '', body: 'A first paragraph.\n\nA second paragraph.', date: '', wordCount: 6, difficulty: 'Advanced' };
const paragraphs = getParagraphs(article);
const vocab: Vocabulary = { id: 'v', word: 'fuel concerns', definition: '加剧担忧', sourceText: 'has fuelled concerns',
  originalContext: 'ORIGINAL_SOURCE_SENTENCE_END', context: 'MY_EDITED_EXAMPLE_END', paragraphId: paragraphs[1].id, paragraphIndex: 0 };
const retell = { mainIdea: '主旨内容', argumentStructure: '论证结构内容', englishRetell: 'My own retelling.', transferExpressions: 'fuel concerns — 加剧担忧' };
const render = (includeSources = true, includeRetell = true) => renderToStaticMarkup(React.createElement(PrintableReading, { article, vocabularies: [vocab], notes: [], retell, includeSources, includeRetell }));
test('PDF source references use stable IDs rather than a stale numeric index', () => {
  assert.equal(paragraphNumber(article, paragraphs[1].id, 0), 2);
  assert.equal(paragraphNumber(article, 'removed-paragraph', 0), null);
  assert.equal(paragraphNumber(article, undefined, 0), 1);
});
test('PDF keeps full original source, modified example and optional retell', () => {
  const html = render();
  assert.ok(html.includes('ORIGINAL_SOURCE_SENTENCE_END'));
  assert.ok(html.includes('MY_EDITED_EXAMPLE_END'));
  assert.ok(html.includes('第 2 段'));
  assert.ok(html.includes('My own retelling.'));
  assert.ok(!render(false).includes('ORIGINAL_SOURCE_SENTENCE_END'));
  assert.ok(render(false).includes('MY_EDITED_EXAMPLE_END'));
  assert.ok(!render(true, false).includes('My own retelling.'));
});
test('very long source sentences and retells are not truncated or line-clamped', () => {
  const source = 'A long source sentence. '.repeat(500) + 'SOURCE_FINAL_SENTINEL';
  const summary = 'A long retelling. '.repeat(500) + 'RETELL_FINAL_SENTINEL';
  const html = renderToStaticMarkup(React.createElement(PrintableReading, { article, vocabularies: [{ ...vocab, originalContext: source }], notes: [], retell: { ...retell, englishRetell: summary }, includeSources: true, includeRetell: true }));
  assert.ok(html.includes(source)); assert.ok(html.includes(summary));
  assert.ok(!html.includes('line-clamp')); assert.ok(!html.includes('overflow:hidden'));
});
test('multiple edits from one source are grouped without discarding their examples', () => {
  const result = printOccurrences(article, { ...vocab, occurrences: [{ ...vocab, sourceText: vocab.sourceText!, originalContext: vocab.originalContext!, context: 'ANOTHER_EXAMPLE_END' }] });
  assert.equal(result.length, 1); assert.deepEqual(result[0].examples, ['MY_EDITED_EXAMPLE_END', 'ANOTHER_EXAMPLE_END']);
});
test('retell fields safely normalize old records and preserve unfilled items', () => {
  assert.deepEqual(normalizeRetell(), emptyRetell());
  assert.equal(normalizeRetell({ mainIdea: 'Only one field' }).mainIdea, 'Only one field');
  const imported = normalizeLibrary({ ...emptyLibrary(), entries: [{ ...legacyEntry({ article }), retell }] });
  assert.deepEqual(imported.entries[0].retell, retell);
});
test('adding a collected expression preserves existing writing and avoids duplicate lines', () => {
  const first = appendExpression('My existing expression.', vocab);
  assert.ok(first.startsWith('My existing expression.'));
  assert.equal(appendExpression(first, vocab), first);
});
test('concurrent retell edits are detected and retained as two versions', () => {
  const entry = { ...legacyEntry({ article }), retell: emptyRetell() };
  const base = { ...emptyLibrary(), entries: [entry], activeId: entry.id };
  const local = structuredClone(base); const remote = structuredClone(base);
  local.entries[0].retell.mainIdea = 'Local idea'; remote.entries[0].retell.mainIdea = 'Remote idea';
  const merged = mergeLibraries(base, local, remote);
  assert.equal(merged.entries.length, 2);
  assert.deepEqual(new Set(merged.entries.map(e => e.retell?.mainIdea)), new Set(['Local idea', 'Remote idea']));
});
test('HTML export includes retell content with escaped user text and no blank worksheet', () => {
  assert.equal(retellHtml(), '');
  assert.equal(retellHtml(emptyRetell()), '');
  const html = retellHtml({ ...retell, mainIdea: '<script>bad()</script>' });
  assert.ok(html.includes('&lt;script&gt;')); assert.ok(!html.includes('<script>'));
});
