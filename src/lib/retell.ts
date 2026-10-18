import type { Retell, Vocabulary } from '../types';
import { escapeHtml } from './study';
export const retellFields: { key: keyof Retell; label: string; prompt: string }[] = [
  { key: 'mainIdea', label: '主旨一句话', prompt: '作者最想说明什么？用一句话概括。' },
  { key: 'argumentStructure', label: '论证结构', prompt: '梳理问题、观点、证据、转折和结论之间的关系。' },
  { key: 'englishRetell', label: '英文复述', prompt: '暂时不看原文，用自己的英语复述关键观点和证据。' },
  { key: 'transferExpressions', label: '想迁移使用的表达', prompt: '挑选值得用于口语或写作的表达，并尝试写进自己的句子。' },
];
export const emptyRetell = (): Retell => ({ mainIdea: '', argumentStructure: '', englishRetell: '', transferExpressions: '' });
export function normalizeRetell(value?: Partial<Retell>): Retell {
  return { mainIdea: typeof value?.mainIdea === 'string' ? value.mainIdea : '',
    argumentStructure: typeof value?.argumentStructure === 'string' ? value.argumentStructure : '',
    englishRetell: typeof value?.englishRetell === 'string' ? value.englishRetell : '',
    transferExpressions: typeof value?.transferExpressions === 'string' ? value.transferExpressions : '' };
}
export const hasRetell = (value?: Partial<Retell>) => retellFields.some(({ key }) => typeof value?.[key] === 'string' && value[key]!.trim());
export function appendExpression(current: string, vocab: Vocabulary): string {
  const line = [vocab.word.trim(), vocab.definition.replace(/\s*\n+\s*/g, ' / ').trim()].filter(Boolean).join(' - ');
  if (current.split('\n').some(existing => existing.trim() === line.trim())) return current;
  return [current.trimEnd(), line].filter(Boolean).join('\n');
}
export function retellHtml(value?: Partial<Retell>): string {
  const cleaned = normalizeRetell(value);
  if (!hasRetell(cleaned)) return '';
  return `<section><h2>读后复述</h2>${retellFields.filter(({ key }) => cleaned[key].trim()).map(({ key, label }) =>
    `<h3>${label}</h3><p style="white-space:pre-wrap">${escapeHtml(cleaned[key])}</p>`).join('')}</section>`;
}
