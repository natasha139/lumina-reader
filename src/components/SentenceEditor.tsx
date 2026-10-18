import React, { useState } from 'react';
import type { Note, NoteKind } from '../types';
import { noteLabels, translationUrl } from '../lib/study';
import StudyDialog from './StudyDialog';
export default function SentenceEditor({ initial, onSave, onClose }: { initial: Note; onSave: (note: Note) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<Note>({ ...initial, originalText: initial.originalText ?? initial.text, kind: initial.kind || 'sentence' });
  return <StudyDialog title="句子精读笔记" onClose={onClose}>
    <form onSubmit={e => { e.preventDefault(); if (draft.text.trim()) onSave({ ...draft, text: draft.text.trim(), comment: draft.comment.trim(), rewrite: draft.rewrite?.trim() }); }} className="space-y-5">
      <div><label htmlFor="sentence-kind" className="study-label">笔记类型</label><select id="sentence-kind" className="study-input" value={draft.kind} onChange={e => setDraft({ ...draft, kind: e.target.value as NoteKind })}>
        {Object.entries(noteLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></div>
      <details open className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500"><summary className="cursor-pointer font-medium">原文摘录（保留作核对）</summary><p className="study-origin mt-2">{draft.originalText}</p></details>
      <div><label htmlFor="sentence-text" className="study-label">学习句子（可修改）</label><textarea autoFocus id="sentence-text" required rows={3} value={draft.text} onChange={e => setDraft({ ...draft, text: e.target.value })} className="study-input font-serif" />
        <div className="flex gap-4 mt-2 text-xs text-gray-500">
          <a href={translationUrl('deepl', draft.text)} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">用 DeepL 核对</a>
          <a href={translationUrl('kagi', draft.text)} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">用 Kagi 核对</a>
        </div>
      </div>
      <div><label htmlFor="sentence-comment" className="study-label">句意、结构与理解</label><textarea id="sentence-comment" rows={4} value={draft.comment} onChange={e => setDraft({ ...draft, comment: e.target.value })} placeholder="记录主干、从句关系、表达用法，或仍没读懂的问题…" className="study-input" /></div>
      <div><label htmlFor="sentence-rewrite" className="study-label">我的改写 / 仿写</label><textarea id="sentence-rewrite" rows={3} value={draft.rewrite || ''} onChange={e => setDraft({ ...draft, rewrite: e.target.value })} placeholder="用自己的话重述，或迁移到一个新句子…" className="study-input font-serif" /></div>
      <div className="flex justify-end gap-3"><button type="button" className="library-secondary" onClick={onClose}>取消</button><button type="submit" className="library-primary">保存句子笔记</button></div>
    </form>
  </StudyDialog>;
}
