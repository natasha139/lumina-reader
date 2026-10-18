import React, { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import type { AppMode, Article } from './types';
import InputMode from './components/InputMode';
import ReadMode from './components/ReadMode';
const LayoutMode = lazy(() => import('./components/LayoutMode'));
import SyncPanel from './components/SyncPanel';
import ArticleLibrary from './components/ArticleLibrary';
import { saveVocabulary } from './lib/study';
import { useReadingLibrary } from './lib/useReadingLibrary';
import { emptyLibrary, getParagraphs, trashLibraryEntry, restoreLibraryEntry, mergeLibraries, withParagraphs, type LibraryEntry, type ReadingProgress, type ReadingStatus } from './lib/library';

export default function App() {
  const [mode, setMode] = useState<AppMode>('library');
  const [showSyncPanel, setShowSyncPanel] = useState(false);
  const { library, update, status, message, storageError, syncCode, sync, linkDevice } = useReadingLibrary();
  const entry = library.entries.find(e => e.id === library.activeId && !e.trashedAt);
  useEffect(() => { if ((mode === 'read' || mode === 'layout') && !entry) setMode('library'); }, [mode, entry]);
  const patchEntry = useCallback((id: string, fn: (entry: LibraryEntry) => LibraryEntry) => {
    update(current => ({ ...current, entries: current.entries.map(e => e.id === id ? { ...fn(e), updatedAt: Date.now() } : e) }));
  }, [update]);
  const open = (id: string) => {
    update(current => ({ ...current, activeId: id, entries: current.entries.map(e => e.id === id && e.status === 'unread' ? { ...e, status: 'reading', updatedAt: Date.now() } : e) }));
    setMode('read');
  };
  const start = (article: Article, readingStatus: ReadingStatus = 'reading') => {
    const id = crypto.randomUUID();
    const newEntry: LibraryEntry = { id, article: withParagraphs(article, getParagraphs(article)), vocabularies: [], notes: [], status: readingStatus, updatedAt: Date.now() };
    update(current => ({ ...current, activeId: readingStatus === 'unread' ? (current.activeId || id) : id, entries: [...current.entries, newEntry] }));
    setMode(readingStatus === 'unread' ? 'library' : 'read');
    window.scrollTo(0, 0);
  };
  const progress = useCallback((position: ReadingProgress) => {
    if (library.activeId) patchEntry(library.activeId, e => ({ ...e, progress: position }));
  }, [library.activeId, patchEntry]);
  const updateArticle = (article: Article) => { if (entry) patchEntry(entry.id, e => ({ ...e, article })); };
  const back = () => { setMode('library'); window.scrollTo(0, 0); };

  return <div className="min-h-screen font-sans selection:bg-highlight selection:text-ink">
    {mode === 'library' && <ArticleLibrary library={library} onOpen={open} onNew={() => { setMode('input'); window.scrollTo(0, 0); }}
      onStatus={(id, value) => patchEntry(id, e => ({ ...e, status: value }))}
      onTrash={id => update(current => trashLibraryEntry(current, id))}
      onRestore={id => update(current => restoreLibraryEntry(current, id))}
      onImport={imported => update(current => mergeLibraries(emptyLibrary(), imported, current))}
      onSync={() => void sync()} onOpenSync={() => setShowSyncPanel(true)} syncStatus={status} syncMessage={message} storageError={storageError} />}
    {mode !== 'library' && (message || storageError) && <div role="status" className="bg-amber-50 text-amber-800 text-sm p-3 text-center">
      {storageError || message} <button className="underline ml-3" onClick={() => void sync()}>重试同步</button>
      <button className="underline ml-3" onClick={back}>返回书架备份</button>
    </div>}
    {mode === 'input' && <InputMode existingArticles={library.entries.filter(e => !e.trashedAt)} onOpenDuplicate={open} onStartReading={start} onBack={back} syncCode={syncCode} syncStatus={status} onOpenSyncPanel={() => setShowSyncPanel(true)} />}
    {(mode === 'read' || mode === 'layout') && entry && <>
      <div className="sticky top-0 z-40 bg-cream max-w-5xl mx-auto px-5 py-3 flex justify-between items-center gap-3 text-sm">
        <button onClick={back} className="text-gray-500 hover:text-ink">← 我的书架</button>
        <label className="flex gap-2 items-center text-gray-500">阅读状态
          <select aria-label="当前文章阅读状态" value={entry.status} onChange={e => patchEntry(entry.id, item => ({ ...item, status: e.target.value as ReadingStatus }))} className="bg-white border border-gray-200 rounded-lg px-3 py-2">
            <option value="unread">待读</option><option value="reading">精读中</option><option value="completed">已完成</option>
          </select>
        </label>
      </div>
      {mode === 'read' && <ReadMode key={entry.id} article={entry.article} vocabularies={entry.vocabularies} notes={entry.notes}
        onSaveVocabulary={(vocab, mergeId) => patchEntry(entry.id, e => ({ ...e, vocabularies: saveVocabulary(e.vocabularies, vocab, mergeId) }))}
        onSaveNote={note => patchEntry(entry.id, e => ({ ...e, notes: e.notes.some(n => n.id === note.id) ? e.notes.map(n => n.id === note.id ? note : n) : [...e.notes, note] }))}
        onDeleteNote={id => patchEntry(entry.id, e => ({ ...e, notes: e.notes.filter(n => n.id !== id) }))}
        onDeleteVocabulary={id => patchEntry(entry.id, e => ({ ...e, vocabularies: e.vocabularies.filter(v => v.id !== id) }))}
        onUpdateArticle={updateArticle} onGoToLayout={() => { setMode('layout'); window.scrollTo(0, 0); }} onBack={back}
        progress={entry.progress} onProgress={progress} syncStatus={status} onOpenSyncPanel={() => setShowSyncPanel(true)} />}
      {mode === 'layout' && <Suspense fallback={<p role="status" className="p-10 text-center text-gray-500">正在打开排版预览…</p>}><LayoutMode key={entry.id} article={entry.article} vocabularies={entry.vocabularies} notes={entry.notes} onUpdateArticle={updateArticle} onBack={() => setMode('read')} /></Suspense>}
    </>}
    {showSyncPanel && <SyncPanel syncCode={syncCode} onLinkDevice={linkDevice} onClose={() => setShowSyncPanel(false)} />}
  </div>;
}
