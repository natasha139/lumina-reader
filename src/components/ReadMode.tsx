import React, { useState, useEffect, useRef } from 'react';
import { Article, Vocabulary, Note } from '../types';
import { getParagraphs, withParagraphs, type ReadingProgress } from '../lib/library';
import { v4 as uuidv4 } from 'uuid';
import VocabularyEditor from './VocabularyEditor';
import SentenceEditor from './SentenceEditor';
import StudySidebar from './StudySidebar';
import { noteHtml, vocabularyHtml, translationUrl } from '../lib/study';
import { BookmarkPlus, LayoutTemplate, ArrowLeft, Bold, Italic, Underline, Highlighter, Eraser, Share2, FileDown, BookOpen, Library, Send, X, Loader2, PenLine, Cloud } from 'lucide-react';

const RichTextParagraph = ({
  html,
  onChange,
  className,
  style,
  'data-paragraph-index': dataParagraphIndex,
  'data-placeholder': dataPlaceholder
}: {
  html: string;
  onChange: (html: string) => void;
  className?: string;
  style?: React.CSSProperties;
  'data-paragraph-index'?: number;
  'data-placeholder'?: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const lastHtmlRef = useRef(html);

  useEffect(() => {
    if (ref.current && html !== lastHtmlRef.current) {
      ref.current.innerHTML = html;
      lastHtmlRef.current = html;
    }
  }, [html]);

  useEffect(() => {
    if (ref.current && !ref.current.innerHTML) {
      ref.current.innerHTML = html;
    }
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={style}
      data-paragraph-index={dataParagraphIndex}
      data-placeholder={dataPlaceholder}
      contentEditable={true}
      suppressContentEditableWarning={true}
      onClick={(e) => e.stopPropagation()}
      onInput={() => {
        if (ref.current) {
          const currentHtml = ref.current.innerHTML;
          if (currentHtml !== lastHtmlRef.current) {
            lastHtmlRef.current = currentHtml;
            onChange(currentHtml);
          }
        }
      }}
      onBlur={() => {
        if (ref.current) {
          const currentHtml = ref.current.innerHTML;
          if (currentHtml !== lastHtmlRef.current) {
            lastHtmlRef.current = currentHtml;
            onChange(currentHtml);
          }
        }
      }}
    />
  );
};

interface ReadModeProps {
  article: Article;
  vocabularies: Vocabulary[];
  notes: Note[];
  onSaveVocabulary: (vocab: Vocabulary, mergeIntoId?: string) => void;
  onSaveNote: (note: Note) => void;
  onDeleteNote: (id: string) => void;
  onDeleteVocabulary: (id: string) => void;
  onUpdateArticle?: (article: Article) => void;
  progress?: ReadingProgress;
  onProgress?: (progress: ReadingProgress) => void;
  onGoToLayout: () => void;
  onBack: () => void;
  syncStatus?: 'idle' | 'syncing' | 'synced' | 'error';
  onOpenSyncPanel?: () => void;
}

export default function ReadMode({
  article,
  progress,
  onProgress,
  vocabularies,
  notes,
  onSaveVocabulary,
  onSaveNote,
  onDeleteNote,
  onDeleteVocabulary,
  onUpdateArticle,
  onGoToLayout,
  onBack,
  syncStatus,
  onOpenSyncPanel,
}: ReadModeProps) {
  const [selection, setSelection] = useState<{ text: string; rect: DOMRect; paragraphIndex: number } | null>(null);
  const [vocabDraft, setVocabDraft] = useState<Vocabulary | null>(null);
  const [noteDraft, setNoteDraft] = useState<Note | null>(null);
  const [jumpTarget, setJumpTarget] = useState<string | null>(null);
  const jumpTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const contentRef = useRef<HTMLDivElement>(null);

  const paragraphs = getParagraphs(article);
  const [showAllTranslations, setShowAllTranslations] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const progressCallback = useRef(onProgress);
  progressCallback.current = onProgress;
  const initialProgress = useRef(progress);
  useEffect(() => {
    let ready = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let last = initialProgress.current ? JSON.stringify(initialProgress.current) : '';
    const frame = requestAnimationFrame(() => {
      const saved = initialProgress.current;
      const target = saved && Array.from(contentRef.current?.querySelectorAll<HTMLElement>('[data-reading-paragraph]') || [])
        .find(el => el.dataset.readingParagraph === saved.paragraphId);
      if (target) window.scrollTo(0, Math.max(0, target.getBoundingClientRect().top + window.scrollY + saved!.offset));
      else window.scrollTo(0, 0);
      ready = true;
    });
    let pending: ReadingProgress | null = null;
    const measure = () => {
      if (!ready) return;
      const elements = Array.from(contentRef.current?.querySelectorAll<HTMLElement>('[data-reading-paragraph]') || []);
      const target = elements.find(el => el.getBoundingClientRect().bottom > 100) || elements.at(-1);
      if (target) pending = { paragraphId: target.dataset.readingParagraph!, offset: -target.getBoundingClientRect().top };
    };
    const capture = () => {
      if (!pending) return;
      const value = JSON.stringify(pending);
      if (last !== value) { last = value; progressCallback.current?.(pending); }
      pending = null;
    };
    const onScroll = () => { measure(); clearTimeout(timer); timer = setTimeout(capture, 350); };
    const onPageHide = () => { measure(); capture(); };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pagehide', onPageHide);
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); window.removeEventListener('scroll', onScroll); window.removeEventListener('pagehide', onPageHide); capture(); };
  }, []);


  const [showExportMenu, setShowExportMenu] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showStudentPicker, setShowStudentPicker] = useState(false);
  const [students, setStudents] = useState<{ id: number; name: string }[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [pushing, setPushing] = useState('');
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const API = {
    INPUT: 'https://input-pipeline-api.100170403natasha.workers.dev',
    ENCOUNTER: 'https://encounter-backend.100170403natasha.workers.dev',
    WRITING: 'https://dawn-sky-c473ielts-api.100170403natasha.workers.dev',
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Close export menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleExportHTML = () => {
    const vocabHtml = vocabularies.map(vocabularyHtml).join('');
    const notesHtml = notes.map(noteHtml).join('');

    const enParas = getParagraphs(article).map(p => p.en);
    const zhParas = getParagraphs(article).map(p => p.zh);
    const bodyHtml = enParas.map((en, i) => `
      <div style="margin-bottom:24px;">
        <p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#2c2c2c;">${en}</p>
        ${zhParas[i] ? `<p style="font-size:14px;line-height:1.7;color:#999;margin-top:8px;">${zhParas[i]}</p>` : ''}
      </div>`).join('');

    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${article.title} - Lumina Reader</title>
<style>body{font-family:-apple-system,sans-serif;max-width:800px;margin:0 auto;padding:40px 20px;background:#f5f5f5;color:#1a1a1a;}
.header{margin-bottom:40px;}.sidebar{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:40px;padding-top:24px;border-top:1px solid #ddd;}
.section-title{font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:2px;color:#999;margin-bottom:16px;}</style></head>
<body><div class="header"><h1 style="font-family:Georgia,serif;font-size:36px;line-height:1.15;">${article.title}</h1>
${article.subtitle ? `<h2 style="font-size:18px;color:#666;margin-top:12px;">${article.subtitle}</h2>` : ''}
<div style="margin-top:12px;font-size:12px;color:#999;">${article.wordCount} words | ${article.difficulty} | ${article.date}</div></div>
<div>${bodyHtml}</div>
<div class="sidebar">
<div><div class="section-title">Vocabulary (${vocabularies.length})</div>${vocabHtml || '<p style="color:#ccc;">No vocabulary saved</p>'}</div>
<div><div class="section-title">Notes (${notes.length})</div>${notesHtml || '<p style="color:#ccc;">No notes saved</p>'}</div>
</div></body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${article.title.replace(/\s+/g, '-').toLowerCase()}-lumina.html`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('HTML 文件已下载');
    setShowExportMenu(false);
  };

  const handlePushToInput = async () => {
    setPushing('input');
    try {
      const res = await fetch(`${API.INPUT}/api/materials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: article.title,
          title_cn: article.subtitle || '',
          type: 'reading',
          content_text: article.body,
          cefr_level: article.difficulty,
          tags: 'lumina-reader',
        }),
      });
      if (!res.ok) throw new Error('Failed');
      showToast('已推送到素材库');
    } catch {
      showToast('推送失败，请重试', 'error');
    } finally {
      setPushing('');
      setShowExportMenu(false);
    }
  };

  const handlePushToEncounter = async () => {
    if (vocabularies.length === 0) {
      showToast('没有生词可推送', 'error');
      setShowExportMenu(false);
      return;
    }
    setShowExportMenu(false);
    setLoadingStudents(true);
    setShowStudentPicker(true);
    try {
      const res = await fetch(`${API.ENCOUNTER}/api/students`);
      const data = await res.json();
      setStudents(data.students || []);
    } catch {
      showToast('获取学生列表失败', 'error');
      setShowStudentPicker(false);
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleSelectStudent = async (studentId: number) => {
    setPushing('encounter');
    try {
      const res = await fetch(`${API.ENCOUNTER}/api/words/add-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          words: vocabularies.map(v => ({
            word: v.word,
            word_data: {
              word: v.word,
              definition_cn: v.definition.replace(/<[^>]*>/g, ''),
              definition_en: '',
              example_sentence: v.context.replace(/<[^>]*>/g, ''),
              source_tag: 'lumina-reader',
              academic_level: article.difficulty,
            },
          })),
        }),
      });
      if (!res.ok) throw new Error('Failed');
      const result = await res.json();
      showToast(`已推送 ${result.added || vocabularies.length} 个生词`);
    } catch {
      showToast('推送失败，请重试', 'error');
    } finally {
      setPushing('');
      setShowStudentPicker(false);
    }
  };

  const handlePushToWriting = async () => {
    setPushing('writing');
    try {
      const res = await fetch(`${API.WRITING}/practice/excerpts/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: article.title,
          source_name: 'Lumina Reader',
          raw_text: article.body,
          annotated_html: article.body,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      showToast('已推送到写作库');
    } catch {
      showToast('推送失败，请重试', 'error');
    } finally {
      setPushing('');
      setShowExportMenu(false);
    }
  };

  useEffect(() => {
    const handleSelection = () => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && sel.toString().trim().length > 0 && contentRef.current?.contains(sel.anchorNode) && contentRef.current?.contains(sel.focusNode)) {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        // Find the paragraph index
        let node = sel.anchorNode;
        let paragraphIndex = -1;
        while (node && node !== contentRef.current) {
          if (node instanceof HTMLElement && node.hasAttribute('data-paragraph-index')) {
            paragraphIndex = parseInt(node.getAttribute('data-paragraph-index') || '-1');
            break;
          }
          node = node.parentNode;
        }

        setSelection({ text: sel.toString().trim(), rect, paragraphIndex });
      }
    };

    let selectionTimer: ReturnType<typeof setTimeout> | undefined;
    const handleSelectionDelayed = () => { clearTimeout(selectionTimer); selectionTimer = setTimeout(handleSelection, 80); };

    document.addEventListener('selectionchange', handleSelectionDelayed);
    document.addEventListener('mouseup', handleSelection);
    document.addEventListener('touchend', handleSelectionDelayed);
    return () => {
      clearTimeout(selectionTimer);
      document.removeEventListener('selectionchange', handleSelectionDelayed);
      document.removeEventListener('mouseup', handleSelection);
      document.removeEventListener('touchend', handleSelectionDelayed);
    };
  }, []);

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.selection-popup') && !window.getSelection()?.toString().trim()) {
        setSelection(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const closeSelection = () => { setSelection(null); window.getSelection()?.removeAllRanges(); };
  const beginVocabulary = () => {
    const index = selection?.paragraphIndex;
    const text = selection?.text || '';
    const context = selection ? getContextSentence(text, selection.paragraphIndex) : '';
    setVocabDraft({ id: uuidv4(), word: text, sourceText: text, definition: '', context, originalContext: context,
      paragraphIndex: index, paragraphId: index !== undefined ? paragraphs[index]?.id : undefined, color: '#6b7280' });
    closeSelection();
  };
  const beginNote = () => {
    const index = selection?.paragraphIndex;
    const text = selection?.text || '';
    setNoteDraft({ id: uuidv4(), text, originalText: text, comment: '', rewrite: '', kind: 'sentence',
      paragraphIndex: index, paragraphId: index !== undefined ? paragraphs[index]?.id : undefined });
    closeSelection();
  };
  const jumpToParagraph = (id?: string, index?: number) => {
    const paragraph = paragraphs.find(p => p.id === id) || (index !== undefined && index >= 0 ? paragraphs[index] : undefined);
    const target = paragraph && Array.from(contentRef.current?.querySelectorAll<HTMLElement>('[data-reading-paragraph]') || []).find(el => el.dataset.readingParagraph === paragraph.id);
    if (!target) { showToast('原段落已更改，可通过保存的原句核对。'); return; }
    closeSelection();
    target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    setJumpTarget(paragraph.id); clearTimeout(jumpTimer.current); jumpTimer.current = setTimeout(() => setJumpTarget(null), 1600);
  };
  useEffect(() => () => clearTimeout(jumpTimer.current), []);
  useEffect(() => {
    const close = () => setSelection(null);
    window.addEventListener('scroll', close, { passive: true }); window.addEventListener('resize', close);
    return () => { window.removeEventListener('scroll', close); window.removeEventListener('resize', close); };
  }, []);

  const getContextSentence = (word: string, pIdx: number) => {
    const contextParagraphs = getParagraphs(article);
    const targetP = contextParagraphs[pIdx]?.en || article.body;
    const plain = targetP.replace(/<[^>]*>/g, '');
    const sentences = plain.match(/[^.!?]+[.!?]+/g) || [plain];
    const sentence = sentences.find(s => s.includes(word));
    return sentence ? sentence.trim() : word;
  };

  const applyFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
  };

  const editParagraph = (idx: number, language: 'en' | 'zh', html: string) => {
    if (!onUpdateArticle) return;
    onUpdateArticle(withParagraphs(article, paragraphs.map((p, i) => i === idx ? { ...p, [language]: html } : p)));
  };
  const handleEnEdit = (idx: number, html: string) => editParagraph(idx, 'en', html);
  const handleZhEdit = (idx: number, html: string) => editParagraph(idx, 'zh', html);
  const swapTranslation = (index: number, otherIndex: number) => {
    if (!onUpdateArticle || otherIndex < 0 || otherIndex >= paragraphs.length) return;
    const next = paragraphs.map(p => ({ ...p }));
    [next[index].zh, next[otherIndex].zh] = [next[otherIndex].zh, next[index].zh];
    onUpdateArticle(withParagraphs(article, next));
  };

  const renderHighlightedText = () => (
    <div className="article-content max-w-[65ch] mx-auto">
      {paragraphs.map((paragraph, idx) => {
        const visible = showAllTranslations || revealed.has(paragraph.id);
        return <section key={paragraph.id} data-reading-paragraph={paragraph.id} className={`mb-9 relative group rounded-lg transition-colors duration-500 ${jumpTarget === paragraph.id ? 'bg-amber-50 ring-4 ring-amber-50' : ''}`}>
          <div className="text-[10px] text-gray-300 font-sans mb-2 select-none">{String(idx + 1).padStart(2, '0')}</div>
          <RichTextParagraph data-paragraph-index={idx}
            className="rich-text-content text-[1.05rem] leading-[1.9] text-[#2c2c2c] outline-none focus:ring-2 focus:ring-gray-200 rounded"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }} html={paragraph.en} onChange={html => handleEnEdit(idx, html)} />
          <button type="button" aria-expanded={visible} onClick={() => {
            if (showAllTranslations) { setShowAllTranslations(false); setRevealed(new Set(paragraphs.filter(p => p.id !== paragraph.id).map(p => p.id))); }
            else setRevealed(current => { const next = new Set(current); if (next.has(paragraph.id)) next.delete(paragraph.id); else next.add(paragraph.id); return next; });
          }} className="mt-3 text-xs font-sans text-gray-400 hover:text-ink py-1">
            {visible ? '收起译文' : paragraph.zh ? '查看译文' : '补充译文'}
          </button>
          {visible && <div className="mt-1 pl-4 border-l-2 border-gray-100">
            <RichTextParagraph data-paragraph-index={idx} data-placeholder="这一段暂时没有译文，点击填写…"
              className="rich-text-content font-sans text-[0.95rem] leading-[1.8] text-gray-500 min-h-8 outline-none focus:ring-2 focus:ring-gray-200 rounded"
              html={paragraph.zh} onChange={html => handleZhEdit(idx, html)} />
            {paragraphs.length > 1 && <div className="flex gap-3 mt-2 text-[11px] text-gray-400 font-sans">
              <span>译文对齐：</span>
              <button type="button" disabled={idx === 0} onClick={() => swapTranslation(idx, idx - 1)} className="hover:text-ink disabled:opacity-30" aria-label={`第 ${idx + 1} 段译文上移`}>与上一段交换</button>
              <button type="button" disabled={idx === paragraphs.length - 1} onClick={() => swapTranslation(idx, idx + 1)} className="hover:text-ink disabled:opacity-30" aria-label={`第 ${idx + 1} 段译文下移`}>与下一段交换</button>
            </div>}
          </div>}
        </section>;
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#eef0f2] py-8 md:py-12 pb-32">
      <style>
        {`
          .rich-text-content b, 
          .rich-text-content strong {
            font-weight: bold !important;
          }
          .rich-text-content i, 
          .rich-text-content em {
            font-style: italic !important;
          }
          .rich-text-content u {
            text-decoration: underline !important;
            text-underline-offset: 4px;
          }
          .rich-text-content::selection,
          .rich-text-content *::selection {
            background-color: rgba(0, 0, 0, 0.15);
            color: inherit;
          }
          .rich-text-content[data-placeholder]:empty::before {
            content: attr(data-placeholder);
            color: #ccc;
            font-style: italic;
            pointer-events: none;
          }
        `}
      </style>
      
      <div className="max-w-[1000px] mx-auto bg-white shadow-sm border border-gray-200 relative overflow-hidden">
        {/* Header */}
        <header className="p-5 md:p-12 border-b border-gray-200">
          <div className="flex justify-between items-start mb-10">
            <button 
              aria-label="返回书架"
              onClick={onBack} 
              className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-50 text-gray-500 hover:text-black hover:bg-gray-100 transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-4">
              <div className="flex gap-2">
                <span className="px-3 py-1 rounded-full border border-gray-200 text-gray-600 text-[10px] font-bold uppercase tracking-widest">{article.wordCount} WORDS</span>
                <span className="px-3 py-1 rounded-full border border-gray-200 text-gray-600 text-[10px] font-bold uppercase tracking-widest">{article.difficulty}</span>
              </div>
              {onOpenSyncPanel && (
                <button
                  onClick={onOpenSyncPanel}
                  title={syncStatus === 'synced' ? '已同步' : syncStatus === 'syncing' ? '同步中...' : syncStatus === 'error' ? '同步失败' : '跨设备同步'}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-50 text-gray-500 hover:text-black hover:bg-gray-100 transition-all relative"
                >
                  <Cloud className="w-5 h-5" />
                  {syncStatus === 'syncing' && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />}
                  {syncStatus === 'synced' && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-400" />}
                  {syncStatus === 'error' && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-400" />}
                </button>
              )}
              <button
                onClick={onGoToLayout}
                className="bg-[#1a1a1a] text-white px-5 py-2 rounded-full hover:bg-black transition-all flex items-center gap-2 font-sans text-xs font-bold tracking-wide"
              >
                <LayoutTemplate className="w-4 h-4" /> 生成海报
              </button>
              <div className="relative" ref={exportMenuRef}>
                <button
                  aria-label="导出和分享"
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-50 text-gray-500 hover:text-black hover:bg-gray-100 transition-all"
                >
                  <Share2 className="w-5 h-5" />
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 top-12 w-52 bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.12)] border border-gray-100 overflow-hidden z-50 font-sans text-sm">
                    <button onClick={handleExportHTML} className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left">
                      <FileDown className="w-4 h-4 text-gray-400" /> 下载 HTML
                    </button>
                    <div className="h-px bg-gray-100" />
                    <button onClick={handlePushToInput} disabled={pushing === 'input'} className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left disabled:opacity-50">
                      {pushing === 'input' ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : <Library className="w-4 h-4 text-gray-400" />} 推送到素材库
                    </button>
                    <button onClick={handlePushToEncounter} className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left">
                      <BookOpen className="w-4 h-4 text-gray-400" /> 推送到生词本
                    </button>
                    <button onClick={handlePushToWriting} disabled={pushing === 'writing'} className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left disabled:opacity-50">
                      {pushing === 'writing' ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : <Send className="w-4 h-4 text-gray-400" />} 推送到写作库
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold text-[#1a1a1a] mb-4 leading-[1.15] tracking-tight" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
              {article.title}
            </h1>
            {article.date && (
              <div className="font-sans text-xs text-gray-400 font-medium uppercase tracking-widest mb-4">{article.date}</div>
            )}
            {article.subtitle && (
              <h2 className="font-sans text-xl text-gray-500 font-medium leading-relaxed">
                {article.subtitle}
              </h2>
            )}
          </div>
        </header>

        <div className="px-5 md:px-12 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3 font-sans text-xs text-gray-400">
          <span>先读原文，再逐段核对译文 · 阅读位置自动保存</span>
          <button type="button" onClick={() => { setShowAllTranslations(!showAllTranslations); setRevealed(new Set()); }} className="text-gray-600 hover:text-ink underline underline-offset-4">
            {showAllTranslations ? '隐藏全部译文' : '显示全部译文'}
          </button>
        </div>
        {/* Core Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 min-h-[500px]">
          {/* Left: Main Content */}
          <div className="md:col-span-8 p-5 md:p-12 border-r border-gray-100" ref={contentRef}>
            {renderHighlightedText()}
          </div>

          <StudySidebar vocabularies={vocabularies} notes={notes}
            onEditVocabulary={setVocabDraft} onDeleteVocabulary={onDeleteVocabulary}
            onEditNote={setNoteDraft} onDeleteNote={onDeleteNote}
            onNewVocabulary={beginVocabulary} onNewNote={beginNote} onJump={jumpToParagraph} />
        </div>

        {/* Selection Popup */}
        {selection && (
          <div 
            className="selection-popup fixed z-50 bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-gray-100 overflow-hidden font-sans text-sm flex flex-col animate-in fade-in zoom-in duration-200"
            style={{
              top: Math.max(12, Math.min(window.innerHeight - 240, selection.rect.bottom + 12)),
              left: Math.max(20, Math.min(window.innerWidth - 280, selection.rect.left + (selection.rect.width / 2) - 130)),
              width: 'min(280px, calc(100vw - 32px))', maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto'
            }}
          >
              <div className="flex flex-col p-2 gap-2">
                <div className="flex gap-2">
                  <button onClick={beginVocabulary} className="flex-1 h-10 rounded-xl bg-ink text-white hover:bg-black flex items-center justify-center gap-1 font-bold"><BookmarkPlus size={15} />记词汇</button>
                  <button onClick={beginNote} className="flex-1 h-10 rounded-xl bg-gray-100 text-ink hover:bg-gray-200 flex items-center justify-center gap-1 font-bold"><PenLine size={15} />记句子</button>
                </div>
                <div className="flex gap-2 text-xs text-gray-600">
                  <a href={translationUrl('deepl', selection.text)} target="_blank" rel="noopener noreferrer" className="flex-1 py-2 text-center rounded-lg hover:bg-gray-100">DeepL 翻译 ↗</a>
                  <a href={translationUrl('kagi', selection.text)} target="_blank" rel="noopener noreferrer" className="flex-1 py-2 text-center rounded-lg hover:bg-gray-100">Kagi 翻译 ↗</a>
                </div>
                <div className="h-px w-full bg-gray-100 my-1" />
                <div className="flex items-center justify-between px-1">
                  <button onMouseDown={(e) => { e.preventDefault(); applyFormat('bold'); }} className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 transition-colors" title="加粗"><Bold size={16}/></button>
                  <button onMouseDown={(e) => { e.preventDefault(); applyFormat('italic'); }} className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 transition-colors" title="斜体"><Italic size={16}/></button>
                  <button onMouseDown={(e) => { e.preventDefault(); applyFormat('underline'); }} className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 transition-colors" title="下划线"><Underline size={16}/></button>
                  <div className="w-px h-4 bg-gray-200 mx-1" />
                  <button onMouseDown={(e) => { e.preventDefault(); applyFormat('foreColor', '#6C5CE7'); }} className="p-2 hover:bg-gray-100 rounded-lg text-[#6C5CE7] transition-colors" title="批注"><PenLine size={16}/></button>
                  <button onMouseDown={(e) => { e.preventDefault(); applyFormat('hiliteColor', '#ffeb3b'); }} className="p-2 hover:bg-gray-100 rounded-lg text-yellow-500 transition-colors" title="高亮"><Highlighter size={16}/></button>
                  <button onMouseDown={(e) => { e.preventDefault(); applyFormat('removeFormat'); }} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors" title="清除格式"><Eraser size={16}/></button>
                </div>
              </div>
          </div>
        )}
      </div>

      {vocabDraft && <VocabularyEditor initial={vocabDraft} vocabularies={vocabularies} onClose={() => setVocabDraft(null)}
        onSave={(value, mergeId) => { onSaveVocabulary(value, mergeId); setVocabDraft(null); showToast(mergeId ? '已合并词条，双方例句和出处均已保留' : '词汇已保存'); }} />}
      {noteDraft && <SentenceEditor initial={noteDraft} onClose={() => setNoteDraft(null)}
        onSave={value => { onSaveNote(value); setNoteDraft(null); showToast('句子笔记已保存'); }} />}

      {/* Student Picker Modal */}
      {showStudentPicker && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-80 max-h-[60vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-bold text-sm">选择学生</h3>
              <button onClick={() => setShowStudentPicker(false)} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {loadingStudents ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : students.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-400">没有找到学生</div>
              ) : (
                students.map(s => (
                  <button
                    key={s.id}
                    onClick={() => handleSelectStudent(s.id)}
                    disabled={pushing === 'encounter'}
                    className="w-full px-4 py-3 text-left rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-between"
                  >
                    {s.name}
                    {pushing === 'encounter' && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-full shadow-lg font-sans text-sm font-medium transition-all ${
          toast.type === 'success' ? 'bg-[#1a1a1a] text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
