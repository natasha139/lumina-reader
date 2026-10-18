import type { Article, Vocabulary } from '../types';
import { getParagraphs } from './library';
import { vocabularyOccurrences } from './study';
export function paragraphNumber(article: Article, id?: string, index?: number): number | null {
  const paragraphs = getParagraphs(article);
  const found = id ? paragraphs.findIndex(p => p.id === id) : -1;
  if (id) return found >= 0 ? found + 1 : null;
  return Number.isInteger(index) && index! >= 0 && index! < paragraphs.length ? index! + 1 : null;
}
// A merged lemma may have several examples from one source sentence.
export function printOccurrences(article: Article, vocab: Vocabulary) {
  const grouped = new Map<string, { original: string; sourceText: string; paragraph: number | null; examples: string[] }>();
  for (const occurrence of vocabularyOccurrences(vocab)) {
    const paragraph = paragraphNumber(article, occurrence.paragraphId, occurrence.paragraphIndex);
    const original = occurrence.originalContext || occurrence.context;
    const key = JSON.stringify([original, paragraph, occurrence.sourceText]);
    const item = grouped.get(key) || { original, paragraph, sourceText: occurrence.sourceText, examples: [] };
    if (occurrence.context && occurrence.context !== original && !item.examples.includes(occurrence.context)) item.examples.push(occurrence.context);
    grouped.set(key, item);
  }
  return [...grouped.values()];
}
export const printStyles = `
.pdf-document { box-sizing:border-box; width:210mm; max-width:none; padding:15mm; color:#292824; background:white; font-family:Georgia,"Songti SC","Times New Roman",serif; font-size:11pt; line-height:1.7; overflow-wrap:anywhere; }
.pdf-document * { box-sizing:border-box; }
.pdf-document header { padding-bottom:7mm; border-bottom:1px solid #d9d7d0; margin-bottom:8mm; }
.pdf-document h1 { font-size:25pt; line-height:1.25; margin:0 0 4mm; font-weight:700; }
.pdf-document h2 { font-size:17pt; line-height:1.4; margin:10mm 0 5mm; border-bottom:1px solid #d9d7d0; padding-bottom:2mm; break-after:avoid; }
.pdf-document h3 { font-size:12pt; margin:5mm 0 2mm; line-height:1.5; break-after:avoid; }
.pdf-document p, .pdf-document blockquote { margin:0 0 3mm; }
.pdf-document .print-meta { font-family:Arial,"PingFang SC",sans-serif; font-size:8.5pt; color:#777; }
.pdf-document .print-paragraph { margin-bottom:6mm; }
.pdf-document .print-translation { font-family:Arial,"PingFang SC",sans-serif; font-size:10pt; color:#777; margin-top:2mm; white-space:pre-wrap; }
.pdf-document .print-label { font-family:Arial,"PingFang SC",sans-serif; font-size:8pt; color:#888; display:block; margin:2mm 0 1mm; break-after:avoid; }
.pdf-document .print-entry { padding-bottom:4mm; border-bottom:1px solid #eeece7; }
.pdf-document .print-source { padding-left:4mm; border-left:2px solid #d9d7d0; margin:3mm 0 4mm; }
.pdf-document .print-source p, .pdf-document .print-answer { white-space:pre-wrap; }
.pdf-document a { color:inherit; text-decoration:none; }
.pdf-document p, .pdf-document .print-answer { orphans:3; widows:3; }
.pdf-document[data-style="editorial"] h1 { font-size:30pt; letter-spacing:-.025em; }
.pdf-document[data-style="handwritten"] { color:#483f32; }
.pdf-document[data-style="handwritten"] h1 { font-style:italic; }
.pdf-document img { max-width:100%; height:auto; }
.pdf-document pre { white-space:pre-wrap; }
.pdf-document ul, .pdf-document ol { padding-left:6mm; }
@media screen { .pdf-document { box-shadow:0 2px 12px #0001; } }
@media print {
  @page { size:A4; margin:15mm; }
  html, body, #root { margin:0!important; padding:0!important; width:auto!important; min-height:0!important; background:white!important; }
  body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .print\\:hidden { display:none!important; }
  .pdf-preview-frame { width:auto!important; overflow:visible!important; }
  .print-layout { display:block!important; min-height:0!important; margin:0!important; padding:0!important; }
  .pdf-document { width:auto!important; max-width:none!important; padding:0!important; margin:0!important; box-shadow:none!important; border:0!important; }
  .pdf-document .print-paragraph, .pdf-document .print-entry, .pdf-document .print-source, .pdf-document .print-answer { height:auto; max-height:none; overflow:visible; break-inside:auto; }
  .pdf-document .print-chapter { break-before:auto; }
}
`;
