import React, { useState, useEffect } from 'react';
import { AppMode, Article, Vocabulary, Note } from './types';
import InputMode from './components/InputMode';
import ReadMode from './components/ReadMode';
import LayoutMode from './components/LayoutMode';

export default function App() {
  const [mode, setMode] = useState<AppMode>('input');
  const [article, setArticle] = useState<Article | null>(null);
  const [vocabularies, setVocabularies] = useState<Vocabulary[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [hasSavedSession, setHasSavedSession] = useState(false);

  useEffect(() => {
    setHasSavedSession(!!localStorage.getItem('lumina-reader-session'));
  }, []);

  useEffect(() => {
    if (article) {
      const sessionData = { article, vocabularies, notes };
      localStorage.setItem('lumina-reader-session', JSON.stringify(sessionData));
      setHasSavedSession(true);
    }
  }, [article, vocabularies, notes]);

  const handleLoadSession = () => {
    const saved = localStorage.getItem('lumina-reader-session');
    if (saved) {
      try {
        const { article: savedArticle, vocabularies: savedVocab, notes: savedNotes } = JSON.parse(saved);
        if (savedArticle) {
          setArticle(savedArticle);
          setVocabularies(savedVocab || []);
          setNotes(savedNotes || []);
          setMode('read');
        }
      } catch (e) {
        console.error('Failed to parse saved session', e);
      }
    }
  };

  const handleStartReading = (newArticle: Article) => {
    setArticle(newArticle);
    setMode('read');
    // Reset session data when starting a new article
    setVocabularies([]);
    setNotes([]);
  };

  const handleAddVocabulary = (vocab: Vocabulary) => {
    setVocabularies(prev => [...prev, vocab]);
  };

  const handleDeleteVocabulary = (id: string) => {
    setVocabularies(prev => prev.filter(v => v.id !== id));
  };

  const handleUpdateVocabulary = (updated: Vocabulary) => {
    setVocabularies(prev => prev.map(v => v.id === updated.id ? updated : v));
  };

  const handleAddNote = (note: Note) => {
    setNotes(prev => [...prev, note]);
  };

  const handleDeleteNote = (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  const handleUpdateNote = (updated: Note) => {
    setNotes(prev => prev.map(n => n.id === updated.id ? updated : n));
  };

  const handleUpdateArticle = (updatedArticle: Article) => {
    setArticle(updatedArticle);
  };

  return (
    <div className="min-h-screen font-sans selection:bg-highlight selection:text-ink">
      {mode === 'input' && (
        <InputMode 
          onStartReading={handleStartReading} 
          hasSavedSession={hasSavedSession}
          onLoadSession={handleLoadSession}
          initialArticle={article}
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
    </div>
  );
}
