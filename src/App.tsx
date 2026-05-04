import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppMode, Article, Vocabulary, Note } from './types';
import InputMode from './components/InputMode';
import ReadMode from './components/ReadMode';
import LayoutMode from './components/LayoutMode';
import SyncPanel from './components/SyncPanel';

const API_BASE = '/api/session';

function getOrCreateUserId(): string {
  let id = localStorage.getItem('lumina-user-id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('lumina-user-id', id);
  }
  return id;
}

interface SessionData {
  article: Article;
  vocabularies: Vocabulary[];
  notes: Note[];
}

export default function App() {
  const [mode, setMode] = useState<AppMode>('input');
  const [article, setArticle] = useState<Article | null>(null);
  const [vocabularies, setVocabularies] = useState<Vocabulary[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [hasSavedSession, setHasSavedSession] = useState(false);
  const [syncCode, setSyncCode] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [showSyncPanel, setShowSyncPanel] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userId = useRef(getOrCreateUserId());

  // 启动时从云端拉取，没有则用 localStorage
  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch(`${API_BASE}?user_id=${userId.current}`);
        const data = await res.json();
        if (data.found && data.session?.article) {
          const { article: a, vocabularies: v, notes: n } = data.session as SessionData;
          setArticle(a);
          setVocabularies(v || []);
          setNotes(n || []);
          setHasSavedSession(true);
          setSyncCode(data.sync_code);
          // 同步到 localStorage 作为离线缓存
          localStorage.setItem('lumina-reader-session', JSON.stringify(data.session));
          return;
        }
      } catch {
        // 云端失败，降级到 localStorage
      }
      // 降级：读 localStorage
      const saved = localStorage.getItem('lumina-reader-session');
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as SessionData;
          if (parsed.article) {
            setArticle(parsed.article);
            setVocabularies(parsed.vocabularies || []);
            setNotes(parsed.notes || []);
            setHasSavedSession(true);
          }
        } catch { /* ignore */ }
      }
    }
    loadSession();
  }, []);

  // 数据变化时 debounce 同步到云端
  const syncToCloud = useCallback((session: SessionData, currentSyncCode: string | null) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      setSyncStatus('syncing');
      try {
        const res = await fetch(API_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId.current,
            session,
            sync_code: currentSyncCode ?? undefined,
          }),
        });
        const data = await res.json();
        if (data.ok) {
          setSyncCode(data.sync_code);
          setSyncStatus('synced');
        } else {
          setSyncStatus('error');
        }
      } catch {
        setSyncStatus('error');
      }
    }, 3000);
  }, []);

  useEffect(() => {
    if (article) {
      const session: SessionData = { article, vocabularies, notes };
      localStorage.setItem('lumina-reader-session', JSON.stringify(session));
      setHasSavedSession(true);
      syncToCloud(session, syncCode);
    }
  }, [article, vocabularies, notes]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLoadSession = () => {
    const saved = localStorage.getItem('lumina-reader-session');
    if (saved) {
      try {
        const { article: a, vocabularies: v, notes: n } = JSON.parse(saved) as SessionData;
        if (a) {
          setArticle(a);
          setVocabularies(v || []);
          setNotes(n || []);
          setMode('read');
        }
      } catch { /* ignore */ }
    }
  };

  // 用同步码绑定设备，拉取对方数据
  const handleLinkDevice = async (code: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch(`${API_BASE}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId.current, sync_code: code }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        return { ok: false, error: data.error || '同步码无效' };
      }
      const session = data.session as SessionData;
      if (session?.article) {
        setArticle(session.article);
        setVocabularies(session.vocabularies || []);
        setNotes(session.notes || []);
        setHasSavedSession(true);
        setMode('read');
        localStorage.setItem('lumina-reader-session', JSON.stringify(session));
      }
      setSyncCode(data.sync_code);
      return { ok: true };
    } catch {
      return { ok: false, error: '网络错误，请重试' };
    }
  };

  const handleStartReading = (newArticle: Article) => {
    setArticle(newArticle);
    setVocabularies([]);
    setNotes([]);
    setMode('read');
  };

  const handleAddVocabulary = (vocab: Vocabulary) => setVocabularies(prev => [...prev, vocab]);
  const handleDeleteVocabulary = (id: string) => setVocabularies(prev => prev.filter(v => v.id !== id));
  const handleUpdateVocabulary = (updated: Vocabulary) => setVocabularies(prev => prev.map(v => v.id === updated.id ? updated : v));
  const handleAddNote = (note: Note) => setNotes(prev => [...prev, note]);
  const handleDeleteNote = (id: string) => setNotes(prev => prev.filter(n => n.id !== id));
  const handleUpdateNote = (updated: Note) => setNotes(prev => prev.map(n => n.id === updated.id ? updated : n));
  const handleUpdateArticle = (updatedArticle: Article) => setArticle(updatedArticle);

  return (
    <div className="min-h-screen font-sans selection:bg-highlight selection:text-ink">
      {mode === 'input' && (
        <InputMode
          onStartReading={handleStartReading}
          hasSavedSession={hasSavedSession}
          onLoadSession={handleLoadSession}
          initialArticle={article}
          syncCode={syncCode}
          syncStatus={syncStatus}
          onOpenSyncPanel={() => setShowSyncPanel(true)}
        />
      )}

      {mode === 'read' && article && (
        <ReadMode
          article={article}
          vocabularies={vocabularies}
          notes={notes}
          onAddVocabulary={handleAddVocabulary}
          onDeleteVocabulary={handleDeleteVocabulary}
          onUpdateVocabulary={handleUpdateVocabulary}
          onUpdateArticle={handleUpdateArticle}
          onGoToLayout={() => setMode('layout')}
          onBack={() => setMode('input')}
          syncStatus={syncStatus}
          onOpenSyncPanel={() => setShowSyncPanel(true)}
        />
      )}

      {mode === 'layout' && article && (
        <LayoutMode
          article={article}
          vocabularies={vocabularies}
          notes={notes}
          onUpdateArticle={handleUpdateArticle}
          onBack={() => setMode('read')}
        />
      )}

      {showSyncPanel && (
        <SyncPanel
          syncCode={syncCode}
          onLinkDevice={handleLinkDevice}
          onClose={() => setShowSyncPanel(false)}
        />
      )}
    </div>
  );
}
