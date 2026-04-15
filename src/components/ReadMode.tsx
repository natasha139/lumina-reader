import React, { useState, useEffect, useRef } from 'react';
import { Article, Vocabulary, Note } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { BookmarkPlus, LayoutTemplate, ArrowLeft, Bold, Italic, Underline, Highlighter, Eraser, Languages, Share2, FileDown, BookOpen, Library, Send, X, Loader2, Pencil, Trash2, Check, PenLine } from 'lucide-react';

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
  onAddVocabulary: (vocab: Vocabulary) => void;
  onDeleteVocabulary: (id: string) => void;
  onUpdateVocabulary: (vocab: Vocabulary) => void;
  onUpdateArticle?: (article: Article) => void;
  onGoToLayout: () => void;
  onBack: () => void;
}

export default function ReadMode({
  article,
  vocabularies,
  notes,
  onAddVocabulary,
  onDeleteVocabulary,
  onUpdateVocabulary,
  onUpdateArticle,
  onGoToLayout,
  onBack
}: ReadModeProps) {
  const [selection, setSelection] = useState<{ text: string; rect: DOMRect; paragraphIndex: number } | null>(null);
  const [popupMode, setPopupMode] = useState<'menu' | 'vocab'>('menu');
  const [inputValue, setInputValue] = useState('');
  const [selectedColor, setSelectedColor] = useState('#FF6B6B');
  const contentRef = useRef<HTMLDivElement>(null);

  const colorOptions = ['#FF6B6B', '#4ECDC4', '#FFD93D', '#6C5CE7', '#FF8A5C'];

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showStudentPicker, setShowStudentPicker] = useState(false);
  const [editingVocabId, setEditingVocabId] = useState<string | null>(null);
  const [editingDefinition, setEditingDefinition] = useState('');
  const [students, setStudents] = useState<{ id: number; student_name: string }[]>([]);
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
    const vocabHtml = vocabularies.map(v => `
      <div style="background:#fff;padding:16px;border-radius:8px;border-left:3px solid ${v.color || '#1a1a1a'};margin-bottom:12px;">
        <div style="font-family:Georgia,serif;font-weight:bold;font-size:18px;color:#1a1a1a;">${v.word}</div>
        <div style="font-size:14px;color:#666;margin-top:4px;">${v.definition}</div>
        <div style="font-size:12px;color:#999;margin-top:8px;font-style:italic;">${v.context}</div>
      </div>`).join('');

    const notesHtml = notes.map(n => `
      <div style="background:#fff;padding:16px;border-radius:8px;border-left:3px solid ${n.color || '#1a1a1a'};margin-bottom:12px;">
        <div style="font-family:Georgia,serif;font-size:13px;color:#999;font-style:italic;margin-bottom:8px;">"${n.text}"</div>
        <div style="font-size:14px;color:#1a1a1a;">${n.comment}</div>
      </div>`).join('');

    const enParas = article.body.split(/\n+/).filter(p => p.trim());
    const zhParas = article.translationBody ? article.translationBody.split(/\n+/).filter(p => p.trim()) : [];
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
              definition_cn: v.definition,
              definition_en: '',
              example_sentence: v.context,
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
          annotated_html: '',
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
      if (sel && sel.toString().trim().length > 0 && contentRef.current?.contains(sel.anchorNode)) {
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
        setPopupMode('menu');
        setInputValue('');
      }
    };

    document.addEventListener('mouseup', handleSelection);
    return () => document.removeEventListener('mouseup', handleSelection);
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

  const handleAddVocab = () => {
    if (!selection) return;
    onAddVocabulary({
      id: uuidv4(),
      word: selection.text,
      definition: inputValue || 'Definition placeholder...',
      context: getContextSentence(selection.text, selection.paragraphIndex),
      paragraphIndex: selection.paragraphIndex,
      color: selectedColor
    });
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  };

  const getContextSentence = (word: string, pIdx: number) => {
    const paragraphs = article.body.split(/\n+/).filter(p => p.trim());
    const targetP = paragraphs[pIdx] || article.body;
    const sentences = targetP.match(/[^.!?]+[.!?]+/g) || [targetP];
    const sentence = sentences.find(s => s.includes(word));
    return sentence ? sentence.trim() : word;
  };

  const applyFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
  };

  const handleEnEdit = (idx: number, newHtml: string) => {
    if (!onUpdateArticle) return;
    const paras = article.body.split(/\n+/).filter(p => p.trim());
    paras[idx] = newHtml;
    onUpdateArticle({
      ...article,
      body: paras.join('\n\n')
    });
  };

  const handleZhEdit = (idx: number, newHtml: string) => {
    if (!onUpdateArticle || !article.translationBody) return;
    const paras = article.translationBody.split(/\n+/).filter(p => p.trim());
    paras[idx] = newHtml;
    onUpdateArticle({
      ...article,
      translationBody: paras.join('\n\n')
    });
  };

  // Highlight words in the text
  const renderHighlightedText = () => {
    const enParas = article.body.split(/\n+/).filter(p => p.trim());
    const zhParas = article.translationBody ? article.translationBody.split(/\n+/).filter(p => p.trim()) : [];
    const maxLen = Math.max(enParas.length, zhParas.length);

    return (
      <div className="article-content" style={{ columnCount: 2, columnGap: '2.5rem' }}>
        {Array.from({ length: maxLen }).map((_, idx) => {
          return (
            <div key={idx} className="mb-8 break-inside-avoid relative group">
              <RichTextParagraph
                data-paragraph-index={idx}
                className="rich-text-content text-[1.05rem] leading-[1.8] text-[#2c2c2c] hover:text-black transition-colors outline-none focus:ring-2 focus:ring-gray-200 rounded hover:bg-black/5"
                style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
                html={enParas[idx] || ''}
                onChange={(newHtml) => handleEnEdit(idx, newHtml)}
              />
              {zhParas[idx] !== undefined && (
                <RichTextParagraph
                  data-paragraph-index={idx}
                  className="rich-text-content font-sans text-[0.95rem] leading-[1.7] text-gray-500 pt-3 break-words outline-none focus:ring-2 focus:ring-gray-200 rounded hover:bg-black/5"
                  html={zhParas[idx] || ''}
                  onChange={(newHtml) => handleZhEdit(idx, newHtml)}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  };

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
        `}
      </style>
      
      <div className="max-w-[1000px] mx-auto bg-white shadow-sm border border-gray-200 relative overflow-hidden">
        {/* Header */}
        <header className="p-8 md:p-12 border-b border-gray-200">
          <div className="flex justify-between items-start mb-10">
            <button 
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
              <button
                onClick={onGoToLayout}
                className="bg-[#1a1a1a] text-white px-5 py-2 rounded-full hover:bg-black transition-all flex items-center gap-2 font-sans text-xs font-bold tracking-wide"
              >
                <LayoutTemplate className="w-4 h-4" /> 生成海报
              </button>
              <div className="relative" ref={exportMenuRef}>
                <button
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
            <h1 className="text-4xl md:text-5xl font-bold text-[#1a1a1a] mb-6 leading-[1.15] tracking-tight" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
              {article.title}
            </h1>
            {article.subtitle && (
              <h2 className="font-sans text-xl text-gray-500 font-medium leading-relaxed">
                {article.subtitle}
              </h2>
            )}
          </div>
        </header>

        {/* Core Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 min-h-[500px]">
          {/* Left: Main Content */}
          <div className="md:col-span-8 p-8 md:p-12 border-r border-gray-100" ref={contentRef}>
            {renderHighlightedText()}
          </div>

          {/* Right: Sidebar */}
          <div className="md:col-span-4 bg-[#fafafa] p-8 md:p-10 flex flex-col gap-12 border-l border-gray-100">
            {/* Vocabulary Section */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <h4 className="font-sans font-bold text-gray-400 text-[10px] uppercase tracking-[0.2em] flex items-center gap-2">
                  <BookmarkPlus className="w-3.5 h-3.5" /> Vocabulary
                </h4>
                <span className="text-gray-400 font-bold text-xs">{vocabularies.length}</span>
              </div>
              <div className="space-y-4">
                {vocabularies.map(v => (
                  <div key={v.id} className="group bg-white p-5 rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100/50 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-shadow border-l-[3px]" style={{ borderLeftColor: v.color || '#1a1a1a' }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-bold text-lg text-[#1a1a1a] mb-1" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>{v.word}</div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        {editingVocabId === v.id ? (
                          <button
                            onClick={() => {
                              onUpdateVocabulary({ ...v, definition: editingDefinition });
                              setEditingVocabId(null);
                            }}
                            className="p-1 rounded hover:bg-green-50 text-green-500"
                            title="保存"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingVocabId(v.id);
                              setEditingDefinition(v.definition);
                            }}
                            className="p-1 rounded hover:bg-gray-100 text-gray-400"
                            title="编辑"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => onDeleteVocabulary(v.id)}
                          className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                          title="删除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {editingVocabId === v.id ? (
                      <textarea
                        value={editingDefinition}
                        onChange={e => setEditingDefinition(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            onUpdateVocabulary({ ...v, definition: editingDefinition });
                            setEditingVocabId(null);
                          }
                          if (e.key === 'Escape') setEditingVocabId(null);
                        }}
                        className="w-full font-sans text-sm text-gray-600 leading-relaxed bg-gray-50 border border-gray-200 rounded px-2 py-1 resize-none focus:outline-none focus:border-gray-400"
                        rows={2}
                        autoFocus
                      />
                    ) : (
                      <div className="font-sans text-sm text-gray-600 leading-relaxed">{v.definition}</div>
                    )}
                    {v.paragraphIndex !== undefined && (
                      <div className="mt-3 text-[9px] font-bold text-gray-300 uppercase tracking-widest">
                        Para {v.paragraphIndex + 1}
                      </div>
                    )}
                  </div>
                ))}
                {vocabularies.length === 0 && (
                  <div className="py-10 text-center border border-dashed border-gray-200 rounded-lg bg-gray-50/50">
                    <p className="text-xs text-gray-400 font-medium">Select text to add vocabulary</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>

        {/* Selection Popup */}
        {selection && (
          <div 
            className="selection-popup fixed z-50 bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-gray-100 overflow-hidden font-sans text-sm flex flex-col animate-in fade-in zoom-in duration-200"
            style={{
              top: Math.min(window.innerHeight - 250, selection.rect.bottom + 15),
              left: Math.max(20, Math.min(window.innerWidth - 280, selection.rect.left + (selection.rect.width / 2) - 130)),
              width: '260px'
            }}
          >
            {popupMode === 'menu' && (
              <div className="flex flex-col p-2 gap-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => setPopupMode('vocab')}
                    className="flex-1 h-10 rounded-xl bg-xhs-red text-white hover:bg-xhs-red/90 transition-all flex items-center justify-center gap-2 font-bold"
                  >
                    <BookmarkPlus className="w-4 h-4" /> 记生词
                  </button>
                </div>
                <button 
                  onClick={() => window.open(`https://translate.kagi.com/?text=${encodeURIComponent(selection.text)}`, '_blank')}
                  className="w-full h-10 rounded-xl bg-[#F5F3FF] text-[#6366F1] hover:bg-[#EEEBFF] transition-all flex items-center justify-center gap-2 font-bold"
                >
                  <Languages className="w-4 h-4" /> Kagi 翻译
                </button>
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
            )}

            {popupMode === 'vocab' && (
              <div className="p-4 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 rounded-full" style={{ backgroundColor: selectedColor }} />
                  <div className="font-serif font-black truncate text-lg" style={{ color: selectedColor }}>{selection.text}</div>
                </div>
                <div className="flex items-center gap-2">
                  {colorOptions.map(c => (
                    <button
                      key={c}
                      onClick={() => setSelectedColor(c)}
                      className="w-6 h-6 rounded-full transition-all"
                      style={{
                        backgroundColor: c,
                        boxShadow: selectedColor === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : 'none'
                      }}
                    />
                  ))}
                </div>
                <input 
                  autoFocus
                  type="text" 
                  placeholder="输入单词释义..." 
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="w-full bg-gray-50 text-ink px-4 py-3 rounded-2xl outline-none placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-xhs-red/10 transition-all"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddVocab()}
                />
                <div className="flex gap-2">
                  <button onClick={() => setPopupMode('menu')} className="flex-1 h-10 rounded-xl text-gray-400 font-bold hover:bg-gray-50 transition-all">取消</button>
                  <button onClick={handleAddVocab} className="flex-1 h-10 rounded-xl bg-xhs-red text-white font-bold hover:shadow-lg hover:shadow-xhs-red/20 transition-all">保存</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

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
                    {s.student_name}
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
