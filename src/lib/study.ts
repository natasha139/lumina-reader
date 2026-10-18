import type { Note, NoteKind, Vocabulary, VocabularyOccurrence } from '../types';

export const noteLabels: Record<NoteKind, string> = { sentence: '长难句', expression: '表达积累', question: '阅读疑问' };
export const normalizeTerm = (word: string) => word.normalize('NFKC').replace(/[‘’]/g, "'").trim().replace(/\s+/g, ' ').toLowerCase();
export const duplicateVocabulary = (items: Vocabulary[], draft: Vocabulary) => items.find(v => v.id !== draft.id && normalizeTerm(v.word) === normalizeTerm(draft.word));
const joinDistinct = (a = '', b = '') => [...new Set([a.trim(), b.trim()].filter(Boolean))].join('\n');

export function vocabularyOccurrences(vocab: Vocabulary): VocabularyOccurrence[] {
  const first: VocabularyOccurrence = { sourceText: vocab.sourceText ?? vocab.word, originalContext: vocab.originalContext ?? vocab.context,
    context: vocab.context, paragraphId: vocab.paragraphId, paragraphIndex: vocab.paragraphIndex };
  const unique = new Map<string, VocabularyOccurrence>();
  for (const item of [first, ...(vocab.occurrences || [])]) unique.set(JSON.stringify(item), item);
  return [...unique.values()];
}

export function mergeVocabulary(existing: Vocabulary, incoming: Vocabulary): Vocabulary {
  const occurrences = vocabularyOccurrences({ ...existing, occurrences: [...vocabularyOccurrences(existing), ...vocabularyOccurrences(incoming)] });
  return { ...existing,
    sourceText: existing.sourceText ?? existing.word,
    originalContext: existing.originalContext ?? existing.context,
    definition: joinDistinct(existing.definition, incoming.definition),
    collocations: joinDistinct(existing.collocations, incoming.collocations),
    partOfSpeech: joinDistinct(existing.partOfSpeech, incoming.partOfSpeech),
    phonetic: existing.phonetic || incoming.phonetic,
    occurrences,
  };
}

export function saveVocabulary(items: Vocabulary[], draft: Vocabulary, mergeIntoId?: string): Vocabulary[] {
  if (mergeIntoId && mergeIntoId !== draft.id) {
    const target = items.find(v => v.id === mergeIntoId);
    if (target) return items.filter(v => v.id !== draft.id).map(v => v.id === target.id ? mergeVocabulary(v, draft) : v);
  }
  return items.some(v => v.id === draft.id) ? items.map(v => v.id === draft.id ? draft : v) : [...items, draft];
}

export function translationUrl(service: 'deepl' | 'kagi', text: string): string {
  return service === 'deepl'
    ? `https://www.deepl.com/en/translator#en/zh/${encodeURIComponent(text)}`
    : `https://translate.kagi.com/?text=${encodeURIComponent(text)}`;
}

export const escapeHtml = (value = '') => value.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
const color = (value?: string) => /^#[0-9a-f]{3,8}$/i.test(value || '') ? value : '#333333';
export function vocabularyHtml(v: Vocabulary) {
  return `<section style="background:white;padding:16px;border-left:3px solid ${color(v.color)};margin-bottom:12px;">
    <h3>${escapeHtml(v.word)}</h3>
    <p>${escapeHtml(v.partOfSpeech)} ${escapeHtml(v.phonetic)}</p>
    <p style="white-space:pre-wrap">${escapeHtml(v.definition)}</p>
    ${v.collocations ? `<p>搭配：${escapeHtml(v.collocations)}</p>` : ''}
    ${vocabularyOccurrences(v).map(o => `<blockquote><p>原文写法：${escapeHtml(o.sourceText)}</p><p>原句：${escapeHtml(o.originalContext)}</p><p>例句：${escapeHtml(o.context)}</p></blockquote>`).join('')}
  </section>`;
}
export function noteHtml(n: Note) {
  return `<section style="background:white;padding:16px;border-left:3px solid ${color(n.color)};margin-bottom:12px;">
    <h3>${noteLabels[n.kind || 'sentence'] || '精读笔记'}</h3>
    <p>原文摘录：${escapeHtml(n.originalText ?? n.text)}</p>
    <p>学习句子：${escapeHtml(n.text)}</p>
    <p style="white-space:pre-wrap">${escapeHtml(n.comment)}</p>
    ${n.rewrite ? `<p>我的改写：${escapeHtml(n.rewrite)}</p>` : ''}
  </section>`;
}
