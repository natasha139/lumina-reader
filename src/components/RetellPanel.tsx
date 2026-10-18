import React from 'react';
import type { Retell, Vocabulary } from '../types';
import { appendExpression, normalizeRetell, retellFields } from '../lib/retell';
export default function RetellPanel({ value, onChange, vocabularies }: { value?: Retell; onChange: (value: Retell) => void; vocabularies: Vocabulary[] }) {
  const draft = normalizeRetell(value);
  const count = retellFields.filter(({ key }) => draft[key].trim()).length;
  return <section aria-label="读后复述" className="max-w-[1000px] mx-auto mt-8 bg-white border border-gray-200 rounded-xl p-5 md:p-10 print:hidden">
    <div className="flex flex-wrap items-start justify-between gap-3 mb-7">
      <div><p className="text-xs tracking-widest text-gray-400 mb-2">读懂之后，试着说出来</p><h2 className="font-serif text-2xl font-bold text-ink">读后复述</h2></div>
      <span className="text-xs text-gray-400 pt-1">已填写 {count} / 4 项 · 自动保存到文章库</span>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {retellFields.map(({ key, label, prompt }) => <div key={key} className={(key === 'englishRetell' || key === 'transferExpressions') ? 'md:col-span-2' : ''}>
        <label htmlFor={`retell-${key}`} className="study-label">{label}</label>
        <p className="text-xs text-gray-400 mb-3 leading-relaxed">{prompt}</p>
        <textarea id={`retell-${key}`} rows={key === 'englishRetell' ? 7 : 4} value={draft[key]}
          onChange={event => onChange({ ...draft, [key]: event.target.value })}
          className={`study-input ${key === 'englishRetell' ? 'font-serif' : ''}`} />
        {key === 'transferExpressions' && vocabularies.length > 0 && <label className="block text-xs text-gray-500 mt-3">从本篇词汇加入
          <select aria-label="从本篇词汇加入迁移表达" value="" className="study-input mt-2" onChange={event => {
            const vocab = vocabularies.find(v => v.id === event.target.value);
            if (vocab) onChange({ ...draft, transferExpressions: appendExpression(draft.transferExpressions, vocab) });
          }}><option value="">选择一个表达…</option>{vocabularies.map(v => <option key={v.id} value={v.id}>{v.word}</option>)}</select>
        </label>}
      </div>)}
    </div>
    <p className="text-xs text-gray-400 mt-6">可分几次完成；已填写的内容可随 PDF 或 HTML 一起导出。</p>
  </section>;
}
