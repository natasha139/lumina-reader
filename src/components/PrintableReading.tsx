import React from 'react';
import type { Article, DesignStyle, Note, Retell, Vocabulary } from '../types';
import { getParagraphs } from '../lib/library';
import { noteLabels } from '../lib/study';
import { hasRetell, normalizeRetell, retellFields } from '../lib/retell';
import { paragraphNumber, printOccurrences, printStyles } from '../lib/print';
interface Props { article: Article; vocabularies: Vocabulary[]; notes: Note[]; retell?: Retell; includeSources: boolean; includeRetell: boolean; designStyle?: DesignStyle }
export default function PrintableReading({ article, vocabularies, notes, retell, includeSources, includeRetell, designStyle = 'academic' }: Props) {
  const retellValue = normalizeRetell(retell);
  const paragraphs = getParagraphs(article);
  const reference = (id?: string, index?: number) => {
    const number = paragraphNumber(article, id, index);
    return number ? <a href={`#print-paragraph-${number}`}>出处：第 {number} 段</a> : '未标记段落';
  };
  return <article aria-label="PDF 精读文档预览" className="pdf-document" data-style={designStyle}>
    <style>{printStyles}</style>
    <header><p className="print-meta">Lumina Reader · 精读笔记</p><h1>{article.title}</h1>
      {article.subtitle && <p>{article.subtitle}</p>}
      <p className="print-meta">{article.wordCount} 词 · {article.difficulty}{article.date ? ` · ${article.date}` : ''}</p>
    </header>
    <section aria-label="阅读正文">{paragraphs.map((p, i) => <section id={`print-paragraph-${i + 1}`} className="print-paragraph" key={p.id}>
      <span className="print-label">第 {i + 1} 段</span>
      <div dangerouslySetInnerHTML={{ __html: p.en }} />
      {p.zh && <div className="print-translation" dangerouslySetInnerHTML={{ __html: p.zh }} />}
    </section>)}</section>
    {!!vocabularies.length && <section className="print-chapter" aria-label="词汇复习">
      <h2>{includeSources ? '词汇与原句复习' : '词汇复习'}</h2>
      {vocabularies.map((v, i) => <section className="print-entry" key={v.id}>
        <h3><span className="print-meta">V{String(i + 1).padStart(2, '0')} · </span>{v.word}</h3>
        {(v.partOfSpeech || v.phonetic) && <p className="print-meta">{v.partOfSpeech} {v.phonetic}</p>}
        {v.definition && <p className="print-answer">{v.definition}</p>}
        {v.collocations && <><span className="print-label">搭配与用法</span><p className="print-answer">{v.collocations}</p></>}
        {printOccurrences(article, v).filter(o => includeSources || o.examples.length > 0).map((o, j) => <div className="print-source" key={j}>
          {includeSources && <><span className="print-label">{o.paragraph ? <a href={`#print-paragraph-${o.paragraph}`}>原句出处 · 第 {o.paragraph} 段</a> : '原句出处 · 未标记段落'}</span>
            {o.sourceText && o.sourceText !== v.word && <p className="print-meta">原文写法：{o.sourceText}</p>}
            {o.original && <p>{o.original}</p>}</>}
          {o.examples.map((example, k) => <React.Fragment key={k}><span className="print-label">我的例句（已修改）</span><p>{example}</p></React.Fragment>)}
        </div>)}
      </section>)}
    </section>}
    {!!notes.length && <section className="print-chapter" aria-label="句子精读笔记"><h2>句子精读笔记</h2>
      {notes.map((n, i) => <section key={n.id} className="print-entry">
        <h3>N{String(i + 1).padStart(2, '0')} · {noteLabels[n.kind || 'sentence'] || '精读笔记'}</h3>
        {includeSources && <p className="print-meta">{reference(n.paragraphId, n.paragraphIndex)}</p>}
        {includeSources && n.originalText && n.originalText !== n.text && <><span className="print-label">原文摘录</span><p className="print-answer">{n.originalText}</p></>}
        <span className="print-label">学习句子</span><p className="print-answer">{n.text}</p>
        {n.comment && <><span className="print-label">句意、结构与理解</span><p className="print-answer">{n.comment}</p></>}
        {n.rewrite && <><span className="print-label">我的改写 / 仿写</span><p className="print-answer">{n.rewrite}</p></>}
      </section>)}
    </section>}
    {includeRetell && hasRetell(retellValue) && <section className="print-chapter" aria-label="读后复述"><h2>读后复述</h2>
      {retellFields.filter(({ key }) => retellValue[key].trim()).map(({ key, label }) => <section key={key}><h3>{label}</h3><p className="print-answer">{retellValue[key]}</p></section>)}
    </section>}
  </article>;
}
