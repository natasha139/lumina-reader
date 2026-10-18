import React, { useEffect, useRef, useState } from 'react';
import type { Vocabulary } from '../types';
import { duplicateVocabulary } from '../lib/study';
import StudyDialog from './StudyDialog';

export default function VocabularyEditor({ initial, vocabularies, onSave, onClose }: {
  initial: Vocabulary; vocabularies: Vocabulary[]; onSave: (vocab: Vocabulary, mergeIntoId?: string) => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState<Vocabulary>({ ...initial, sourceText: initial.sourceText ?? initial.word, originalContext: initial.originalContext ?? initial.context });
  const [loading, setLoading] = useState(false);
  const [lookupMessage, setLookupMessage] = useState('');
  const request = useRef<AbortController | null>(null);
  const duplicate = duplicateVocabulary(vocabularies, draft);
  const lookup = async (word: string) => {
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setLoading(true); setLookupMessage('');
    try {
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.trim().toLowerCase())}`, { signal: controller.signal });
      if (!response.ok) throw new Error();
      const data = await response.json();
      const ipa = data[0]?.phonetic || data[0]?.phonetics?.find((p: { text?: string }) => p.text)?.text || '';
      if (!controller.signal.aborted) {
        setDraft(current => current.word === word ? { ...current, phonetic: current.phonetic || ipa } : current);
        setLookupMessage(ipa ? '' : '未查到音标，可手动填写。');
      }
    } catch { if (!controller.signal.aborted) setLookupMessage('未查到音标，可手动填写。'); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  };
  useEffect(() => {
    if (!initial.phonetic && initial.word.trim() && !/\s/.test(initial.word.trim())) void lookup(initial.word);
    return () => request.current?.abort();
  }, []);
  const save = (merge: boolean) => {
    if (!draft.word.trim()) return;
    onSave({ ...draft, word: draft.word.trim(), definition: draft.definition.trim(), context: draft.context.trim(),
      collocations: draft.collocations?.trim(), partOfSpeech: draft.partOfSpeech?.trim(), phonetic: draft.phonetic?.trim() }, merge ? duplicate?.id : undefined);
  };
  return <StudyDialog title={vocabularies.some(v => v.id === initial.id) ? '编辑词汇' : '收集词汇'} onClose={onClose}>
    <form onSubmit={event => { event.preventDefault(); save((event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') !== 'separate'); }} className="space-y-5">
      <div><label htmlFor="study-word" className="study-label">词条（可改为原形）</label>
        <input id="study-word" autoFocus required value={draft.word} onChange={e => { request.current?.abort(); setLoading(false); setLookupMessage(''); setDraft({ ...draft, word: e.target.value, phonetic: '' }); }} className="study-input font-serif text-lg" />
        <p className="text-xs text-gray-400 mt-2">例如：把 was weighing on 改成 weigh on，不会修改原文。</p>
      </div>
      <details className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500" open>
        <summary className="cursor-pointer font-medium">原文写法与原句（保留作核对）</summary>
        <p className="study-origin mt-2">{draft.sourceText}</p><p className="study-origin mt-1">{draft.originalContext}</p>
      </details>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div><label htmlFor="study-pos" className="study-label">词性</label><input id="study-pos" value={draft.partOfSpeech || ''} onChange={e => setDraft({ ...draft, partOfSpeech: e.target.value })} placeholder="如：动词短语 / phrasal verb" className="study-input" /></div>
        <div><label htmlFor="study-phonetic" className="study-label">音标</label><div className="flex gap-2"><input id="study-phonetic" value={draft.phonetic || ''} onChange={e => setDraft({ ...draft, phonetic: e.target.value })} className="study-input min-w-0" />
          <button type="button" disabled={loading || !draft.word.trim()} onClick={() => void lookup(draft.word)} className="text-xs text-gray-500 shrink-0 disabled:opacity-50">{loading ? '查询中…' : '查音标'}</button></div>
          {lookupMessage && <p role="status" className="text-xs text-gray-400 mt-1">{lookupMessage}</p>}
        </div>
      </div>
      <div><label htmlFor="study-definition" className="study-label">语境义</label><textarea id="study-definition" rows={2} value={draft.definition} onChange={e => setDraft({ ...draft, definition: e.target.value })} placeholder="这个词在本句中的意思，可稍后补充" className="study-input" /></div>
      <div><label htmlFor="study-collocations" className="study-label">搭配与用法</label><textarea id="study-collocations" rows={2} value={draft.collocations || ''} onChange={e => setDraft({ ...draft, collocations: e.target.value })} placeholder="如：weigh on someone's mind" className="study-input" /></div>
      <div><label htmlFor="study-context" className="study-label">例句（可修改）</label><textarea id="study-context" rows={3} value={draft.context} onChange={e => setDraft({ ...draft, context: e.target.value })} className="study-input font-serif" />
        <p className="text-xs text-gray-400 mt-1">可整理成便于复习的句子，原句会单独保留。</p>
      </div>
      {duplicate && <div role="status" className="text-sm leading-relaxed p-3 rounded-lg bg-amber-50 text-amber-800">本篇已有词条「{duplicate.word}」。合并会保留双方释义、搭配及句子出处。</div>}
      <div className="flex gap-3 flex-wrap justify-end pt-2">
        <button type="button" onClick={onClose} className="library-secondary">取消</button>
        {duplicate && <button type="submit" value="separate" className="library-secondary">仍保存为独立词条</button>}
        <button type="submit" value="merge" className="library-primary">{duplicate ? '合并到已有词条' : '保存词汇'}</button>
      </div>
    </form>
  </StudyDialog>;
}
