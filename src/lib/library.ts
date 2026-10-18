import type { Article, Vocabulary, Note } from '../types';

export type ReadingStatus = 'unread' | 'reading' | 'completed';
export interface ReadingProgress { paragraphId: string; offset: number }
export interface LibraryEntry {
  id: string;
  article: Article;
  vocabularies: Vocabulary[];
  notes: Note[];
  status: ReadingStatus;
  updatedAt: number;
  trashedAt?: number;
  progress?: ReadingProgress;
}
export interface ReadingLibrary { version: 2; entries: LibraryEntry[]; activeId: string | null }
export const emptyLibrary = (): ReadingLibrary => ({ version: 2, entries: [], activeId: null });

export function hashText(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(36);
}

export function getParagraphs(article: Article) {
  if (Array.isArray(article.paragraphs) && article.paragraphs.length) return article.paragraphs.map((p, i) => ({
    id: typeof p?.id === 'string' && p.id ? p.id : `p-${i}-${hashText(p?.en || '')}`,
    en: typeof p?.en === 'string' ? p.en : '', zh: typeof p?.zh === 'string' ? p.zh : '',
  }));
  const en = article.body.replace(/\r\n/g, '\n').split(/\n+/).filter(p => p.trim());
  const rawZh = typeof article.translationBody === 'string' ? article.translationBody.replace(/\r\n/g, '\n').trimEnd() : '';
  // The old editor serialized empty translations as adjacent double newlines.
  const zh = rawZh.includes('\n\n') ? rawZh.split('\n\n') : rawZh.split('\n');
  return Array.from({ length: Math.max(en.length, rawZh ? zh.length : 0) }, (_, i) => ({
    id: `p-${i}-${hashText(en[i] || '')}`, en: en[i] || '', zh: zh[i]?.trim() || '',
  }));
}

export function withParagraphs(article: Article, paragraphs: NonNullable<Article['paragraphs']>): Article {
  const body = paragraphs.map(p => p.en).join('\n\n');
  return { ...article, paragraphs, body,
    wordCount: body.replace(/<[^>]*>/g, '').trim().split(/\s+/).filter(Boolean).length,
    translationBody: article.translationBody !== undefined || paragraphs.some(p => p.zh)
      ? paragraphs.map(p => p.zh).join('\n\n') : undefined };
}

export function legacyEntry(session: { article: Article; vocabularies?: Vocabulary[]; notes?: Note[] }, updatedAt = 0): LibraryEntry {
  const article = withParagraphs(session.article, getParagraphs(session.article));
  const id = `legacy-${hashText(article.title + '\n' + article.body)}`;
  return { id, article, vocabularies: session.vocabularies || [], notes: session.notes || [], status: 'reading', updatedAt };
}

export function normalizeLibrary(value: unknown): ReadingLibrary {
  if (!value || typeof value !== 'object') return emptyLibrary();
  const v = value as Partial<ReadingLibrary> & { article?: Article; vocabularies?: Vocabulary[]; notes?: Note[] };
  if (v.version !== 2) {
    if (v.article && typeof v.article.body === 'string' && typeof v.article.title === 'string') {
      const entry = legacyEntry({ article: v.article, vocabularies: v.vocabularies, notes: v.notes });
      return { version: 2, entries: [entry], activeId: entry.id };
    }
    return emptyLibrary();
  }
  if (!Array.isArray(v.entries)) return emptyLibrary();
  const entries = v.entries.filter(e => e && typeof e.id === 'string' && e.article &&
    typeof e.article.body === 'string' && typeof e.article.title === 'string').map(e => ({
      ...e, article: withParagraphs(e.article, getParagraphs(e.article)),
      vocabularies: Array.isArray(e.vocabularies) ? e.vocabularies : [],
      notes: Array.isArray(e.notes) ? e.notes : [],
      status: ['unread', 'reading', 'completed'].includes(e.status) ? e.status : 'unread' as ReadingStatus,
      updatedAt: Number.isFinite(e.updatedAt) ? e.updatedAt : 0,
    }));
  return { version: 2, entries, activeId: entries.some(e => e.id === v.activeId) ? v.activeId! : entries[0]?.id ?? null };
}

const fingerprint = (entry: LibraryEntry | undefined) => entry ? JSON.stringify({
  article: entry.article, vocabularies: entry.vocabularies, notes: entry.notes, status: entry.status, trashedAt: entry.trashedAt,
}) : '';

// Three-way merge: edits to different articles combine; concurrent edits to one
// article retain both versions, rather than silently overwriting either device.
export function mergeLibraries(base: ReadingLibrary, local: ReadingLibrary, remote: ReadingLibrary): ReadingLibrary {
  const result = new Map(remote.entries.map(e => [e.id, e]));
  for (const entry of local.entries) {
    const previous = base.entries.find(e => e.id === entry.id);
    const other = result.get(entry.id);
    const changedLocal = fingerprint(entry) !== fingerprint(previous);
    const changedRemote = fingerprint(other) !== fingerprint(previous);
    if (!other || (changedLocal && !changedRemote)) result.set(entry.id, entry);
    else if (changedLocal && changedRemote && fingerprint(entry) !== fingerprint(other)) {
      const id = `${entry.id}-conflict-${hashText(fingerprint(entry))}`;
      result.set(id, { ...entry, id, article: { ...entry.article, title: `${entry.article.title}（本机冲突副本）` } });
    } else if (entry.updatedAt > other.updatedAt && !changedRemote) result.set(entry.id, entry);
  }
  const entries = [...result.values()];
  return { version: 2, entries, activeId: entries.some(e => e.id === local.activeId) ? local.activeId : remote.activeId };
}

export function trashLibraryEntry(library: ReadingLibrary, id: string, now = Date.now()): ReadingLibrary {
  const entries = library.entries.map(e => e.id === id ? { ...e, trashedAt: now, updatedAt: now } : e);
  return { ...library, entries, activeId: library.activeId === id ? entries.find(e => !e.trashedAt)?.id ?? null : library.activeId };
}
export function restoreLibraryEntry(library: ReadingLibrary, id: string, now = Date.now()): ReadingLibrary {
  return { ...library, entries: library.entries.map(e => e.id === id ? { ...e, trashedAt: undefined, updatedAt: now } : e) };
}
export const articleContentKey = (article: Article) => article.body.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&').normalize('NFKC').replace(/\s+/g, ' ').trim();
