import React from 'react';
import { BookmarkPlus, PenLine, Pencil, Trash2, CornerUpLeft, Plus } from 'lucide-react';
import type { Note, Vocabulary } from '../types';
import { noteLabels, vocabularyOccurrences } from '../lib/study';
interface Props {
  vocabularies: Vocabulary[]; notes: Note[];
  onEditVocabulary: (value: Vocabulary) => void; onDeleteVocabulary: (id: string) => void;
  onEditNote: (value: Note) => void; onDeleteNote: (id: string) => void;
  onNewVocabulary: () => void; onNewNote: () => void;
  onJump: (paragraphId?: string, paragraphIndex?: number) => void;
}
export default function StudySidebar({ vocabularies, notes, onEditVocabulary, onDeleteVocabulary, onEditNote, onDeleteNote, onNewVocabulary, onNewNote, onJump }: Props) {
  const canJump = (id?: string, index?: number) => !!id || (index !== undefined && index >= 0);
  return <aside aria-label="精读积累" className="md:col-span-4 bg-[#fafafa] p-5 md:p-8 flex flex-col gap-9 border-l border-gray-100 break-words">
    <section aria-label="语境词汇">
      <div className="flex items-center justify-between mb-5 gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-gray-600"><BookmarkPlus size={15} />语境词汇 <span className="text-gray-400 font-normal">{vocabularies.length}</span></h3>
        <button onClick={onNewVocabulary} aria-label="添加词汇" className="p-1.5 text-gray-400 hover:text-ink rounded hover:bg-white"><Plus size={16} /></button>
      </div>
      <div className="space-y-4">
        {vocabularies.map(v => <article key={v.id} className="bg-white p-4 rounded-lg border-l-[3px] border border-gray-100" style={{ borderLeftColor: v.color || '#777' }}>
          <div className="flex items-start justify-between gap-2">
            <button onClick={() => onJump(v.paragraphId, v.paragraphIndex)} disabled={!canJump(v.paragraphId, v.paragraphIndex)} className="font-serif text-lg font-bold text-ink text-left hover:underline disabled:no-underline" title="回到原文">{v.word}</button>
            <div className="flex shrink-0 gap-1 text-gray-400">
              <button onClick={() => onEditVocabulary(v)} aria-label={`编辑词汇 ${v.word}`} className="p-1 hover:text-ink"><Pencil size={14} /></button>
              <button onClick={() => onDeleteVocabulary(v.id)} aria-label={`删除词汇 ${v.word}`} className="p-1 hover:text-red-500"><Trash2 size={14} /></button>
            </div>
          </div>
          {(v.partOfSpeech || v.phonetic) && <p className="text-xs text-gray-400 mt-1 whitespace-pre-wrap">{v.partOfSpeech} {v.phonetic}</p>}
          {v.sourceText && v.sourceText !== v.word && <p className="text-[11px] text-gray-400 mt-2">原文：{v.sourceText}</p>}
          <p className="text-sm text-gray-600 leading-relaxed mt-2 whitespace-pre-wrap">{v.definition || '待补充语境义'}</p>
          {v.collocations && <p className="mt-2 text-xs text-gray-500 leading-relaxed whitespace-pre-wrap">搭配：{v.collocations}</p>}
          <details className="mt-3 text-xs text-gray-400">
            <summary className="cursor-pointer hover:text-ink">例句与出处{vocabularyOccurrences(v).length > 1 ? ` · ${vocabularyOccurrences(v).length} 处` : ''}</summary>
            <div className="mt-3 space-y-3">
              {vocabularyOccurrences(v).map((o, i) => <div key={i} className="border-t border-gray-100 pt-2">
                {o.context && <p className="font-serif text-gray-600 leading-relaxed whitespace-pre-wrap">{o.context}</p>}
                {o.originalContext && o.originalContext !== o.context && <p className="mt-2 leading-relaxed whitespace-pre-wrap">原句：{o.originalContext}</p>}
                {canJump(o.paragraphId, o.paragraphIndex) && <button onClick={() => onJump(o.paragraphId, o.paragraphIndex)} className="mt-2 inline-flex items-center gap-1 text-gray-500 hover:text-ink"><CornerUpLeft size={12} />回到原文{o.paragraphIndex !== undefined && o.paragraphIndex >= 0 ? ` · 第 ${o.paragraphIndex + 1} 段` : ''}</button>}
              </div>)}
            </div>
          </details>
        </article>)}
        {!vocabularies.length && <p className="text-xs text-gray-400 leading-relaxed py-6 border-y border-gray-100">划词后点“记词汇”，可把词条改成原形，并保留原句。</p>}
      </div>
    </section>
    <section aria-label="句子精读">
      <div className="flex items-center justify-between mb-5 gap-2">
        <h3 className="flex gap-2 items-center text-sm font-bold text-gray-600"><PenLine size={15} />句子精读 <span className="text-gray-400 font-normal">{notes.length}</span></h3>
        <button onClick={onNewNote} aria-label="添加句子笔记" className="p-1.5 text-gray-400 hover:text-ink rounded hover:bg-white"><Plus size={16} /></button>
      </div>
      <div className="space-y-4">
        {notes.map(n => <article key={n.id} className="bg-white p-4 rounded-lg border border-gray-100">
          <div className="flex gap-2 justify-between items-start mb-3">
            <span className="text-xs text-gray-400">{noteLabels[n.kind || 'sentence'] || '精读笔记'}</span>
            <div className="flex gap-1 text-gray-400 shrink-0"><button onClick={() => onEditNote(n)} aria-label="编辑句子笔记" className="p-1 hover:text-ink"><Pencil size={14} /></button><button onClick={() => onDeleteNote(n.id)} aria-label="删除句子笔记" className="p-1 hover:text-red-500"><Trash2 size={14} /></button></div>
          </div>
          <p className="font-serif text-sm leading-relaxed text-ink whitespace-pre-wrap">{n.text}</p>
          {n.comment && <p className="mt-3 text-xs leading-relaxed text-gray-500 whitespace-pre-wrap">{n.comment}</p>}
          {n.rewrite && <div className="mt-3 border-l-2 border-gray-100 pl-3"><p className="text-[11px] text-gray-400 mb-1">我的改写</p><p className="text-xs font-serif text-gray-600 leading-relaxed whitespace-pre-wrap">{n.rewrite}</p></div>}
          {n.originalText && n.originalText !== n.text && <details className="mt-3 text-xs text-gray-400"><summary className="cursor-pointer">核对原文摘录</summary><p className="mt-2 leading-relaxed">{n.originalText}</p></details>}
          {canJump(n.paragraphId, n.paragraphIndex) && <button onClick={() => onJump(n.paragraphId, n.paragraphIndex)} className="mt-3 text-xs text-gray-400 hover:text-ink inline-flex items-center gap-1"><CornerUpLeft size={12} />回到原文</button>}
        </article>)}
        {!notes.length && <p className="text-xs text-gray-400 leading-relaxed py-6 border-y border-gray-100">划出句子，记录结构、理解和仿写；保存后还可以修改。</p>}
      </div>
    </section>
  </aside>;
}
