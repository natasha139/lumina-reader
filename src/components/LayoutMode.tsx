import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Article, Vocabulary, Note, DesignStyle } from '../types';
import html2canvas from 'html2canvas';
import { Download, ArrowLeft, Loader2, Bold, Italic, Underline, Highlighter, Eraser, GraduationCap, Newspaper, PenTool } from 'lucide-react';

const RichTextParagraph = ({
  html,
  onChange,
  className,
  style
}: {
  html: string;
  onChange: (html: string) => void;
  className?: string;
  style?: React.CSSProperties;
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

interface LayoutModeProps {
  article: Article;
  vocabularies: Vocabulary[];
  notes: Note[];
  onUpdateArticle?: (article: Article) => void;
  onBack: () => void;
}

interface PageData {
  pageIndex: number;
  paragraphs: { en: string; zh: string; originalIndex: number }[];
  vocabs: Vocabulary[];
  notes: Note[];
}

export default function LayoutMode({ article, vocabularies, notes, onUpdateArticle, onBack }: LayoutModeProps) {
  const layoutRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'png' | 'pdf'>('pdf');
  const [showIframeWarning, setShowIframeWarning] = useState(false);
  const [designStyle, setDesignStyle] = useState<DesignStyle>('academic');

  const [localEnParas, setLocalEnParas] = useState<string[]>(() => article.body.split(/\n+/).filter(p => p.trim()));
  const [localZhParas, setLocalZhParas] = useState<string[]>(() => article.translationBody ? article.translationBody.split(/\n+/).filter(p => p.trim()) : []);
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    setLocalEnParas(article.body.split(/\n+/).filter(p => p.trim()));
    setLocalZhParas(article.translationBody ? article.translationBody.split(/\n+/).filter(p => p.trim()) : []);
  }, [article.body, article.translationBody]);

  const pages = useMemo(() => {
    const result: PageData[] = [];
    let currentPage: PageData = { pageIndex: 1, paragraphs: [], vocabs: [], notes: [] };
    let currentCharCount = 0;
    const PAGE_1_LIMIT = designStyle === 'editorial' ? 1200 : 1500;
    const PAGE_N_LIMIT = designStyle === 'editorial' ? 2800 : 3200;

    localEnParas.forEach((en, idx) => {
      const zh = localZhParas[idx] || '';
      const paraChars = en.length + zh.length;
      const limit = currentPage.pageIndex === 1 ? PAGE_1_LIMIT : PAGE_N_LIMIT;

      if (currentCharCount + paraChars > limit && currentPage.paragraphs.length > 0) {
        result.push(currentPage);
        currentPage = { pageIndex: result.length + 1, paragraphs: [], vocabs: [], notes: [] };
        currentCharCount = 0;
      }

      currentPage.paragraphs.push({ en, zh, originalIndex: idx });
      currentCharCount += paraChars;

      const pVocabs = vocabularies.filter(v => v.paragraphIndex === idx);
      const pNotes = notes.filter(n => n.paragraphIndex === idx);
      currentPage.vocabs.push(...pVocabs);
      currentPage.notes.push(...pNotes);
    });

    if (currentPage.paragraphs.length > 0) {
      result.push(currentPage);
    }
    return result;
  }, [localEnParas, localZhParas, vocabularies, notes, designStyle]);

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
        let isEditable = false;
        let node = selection.anchorNode;
        while (node) {
          if (node.nodeType === 1 && (node as HTMLElement).getAttribute('contenteditable') === 'true') {
            isEditable = true;
            break;
          }
          node = node.parentNode;
        }
        if (isEditable) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          if (rect.width > 0) { setSelectionRect(rect); return; }
        }
      }
      setSelectionRect(null);
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  const applyFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
  };

  const handleEnEdit = (idx: number, newHtml: string) => {
    const newParas = [...localEnParas];
    newParas[idx] = newHtml;
    setLocalEnParas(newParas);
    if (onUpdateArticle) onUpdateArticle({ ...article, body: newParas.join('\n\n') });
  };

  const handleZhEdit = (idx: number, newHtml: string) => {
    const newParas = [...localZhParas];
    newParas[idx] = newHtml;
    setLocalZhParas(newParas);
    if (onUpdateArticle) onUpdateArticle({ ...article, translationBody: newParas.join('\n\n') });
  };

  const handleExport = async () => {
    if (exportFormat === 'pdf') {
      if (window !== window.parent) { setShowIframeWarning(true); return; }
      const style = document.createElement('style');
      style.innerHTML = `
        @page { size: A4; margin: 0; }
        @media print {
          html, body { width: 210mm !important; margin: 0 !important; padding: 0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white !important; }
          body > *:not(#root) { display: none !important; }
          .print\\:hidden { display: none !important; }
          #root { width: 210mm !important; }
          .a4-page { width: 210mm !important; height: 297mm !important; margin: 0 !important; padding: 15mm !important; box-shadow: none !important; page-break-after: always !important; break-after: page !important; }
          .a4-page:last-child { page-break-after: auto !important; break-after: auto !important; }
        }
      `;
      document.head.appendChild(style);
      window.getComputedStyle(document.body).getPropertyValue('display');
      window.print();
      setTimeout(() => { if (document.head.contains(style)) document.head.removeChild(style); }, 2000);
      return;
    }
    if (!layoutRef.current) return;
    setIsExporting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const el = layoutRef.current;
      // Force A4 width for capture regardless of viewport (fixes mobile)
      const prevWidth = el.style.width;
      const prevMinWidth = el.style.minWidth;
      el.style.width = '794px';
      el.style.minWidth = '794px';
      await new Promise(resolve => setTimeout(resolve, 100));
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#e5e7eb', logging: false, width: el.scrollWidth, windowWidth: 794 });
      el.style.width = prevWidth;
      el.style.minWidth = prevMinWidth;
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `${article.title.replace(/\s+/g, '-').toLowerCase()}-curation.png`;
      link.click();
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // ─── Academic Style (Digital Scholar) ───
  const renderAcademicPage = (page: PageData) => (
    <div
      key={`academic-${page.pageIndex}`}
      className="a4-page bg-white shadow-2xl print:shadow-none relative flex flex-col"
      style={{ width: '210mm', height: '297mm', padding: '15mm', boxSizing: 'border-box', overflow: 'hidden' }}
    >
      {page.pageIndex === 1 ? (
        <header className="mb-6 shrink-0">
          <div className="flex justify-between items-start mb-4">
            <div className="academic-title px-3 py-1 bg-black text-white text-[8pt] font-bold uppercase tracking-widest">Digital Scholar</div>
            <div className="flex gap-2">
              <span className="academic-title px-2 py-1 border border-gray-300 text-gray-600 text-[8pt] font-bold rounded-full uppercase">#{article.difficulty || 'READING'}</span>
              <span className="academic-title px-2 py-1 border border-gray-300 text-gray-600 text-[8pt] font-bold rounded-full uppercase">#{article.wordCount}W</span>
            </div>
          </div>
          <h1 className="academic-title font-black text-4xl leading-[1.1] text-gray-900 mb-3 text-justify">{article.title}</h1>
          {article.subtitle && <h2 className="academic-title text-sm text-gray-600 italic text-justify border-l-2 border-red-500 pl-3">{article.subtitle}</h2>}
        </header>
      ) : (
        <header className="mb-4 shrink-0 border-b border-gray-200 pb-2 flex justify-between items-end">
          <h1 className="academic-title font-bold text-[10pt] text-gray-900 uppercase tracking-widest line-clamp-1">{article.title}</h1>
          <span className="academic-title text-[8pt] text-gray-400">Part {page.pageIndex}</span>
        </header>
      )}
      <div className="flex-1 min-h-0 grid grid-cols-12 gap-6">
        <div className="col-span-8 overflow-hidden" style={{ columnCount: 2, columnGap: '15px', textAlign: 'justify' }}>
          {page.paragraphs.map((p) => (
            <div key={p.originalIndex} className="mb-4 break-inside-avoid relative" style={{ breakInside: 'avoid', orphans: 3, widows: 3 }}>
              <span className="academic-title text-[7pt] text-gray-300 font-bold absolute -left-0 top-0 select-none" style={{ marginLeft: '-2px' }}>{p.originalIndex + 1}</span>
              <RichTextParagraph className="rich-text-content academic-body text-[10.5pt] leading-relaxed text-gray-900 outline-none pl-3" html={p.en} onChange={(h) => handleEnEdit(p.originalIndex, h)} />
              {p.zh && <RichTextParagraph className="rich-text-content academic-title text-[8pt] leading-snug text-gray-500 mt-1 outline-none pl-3" html={p.zh} onChange={(h) => handleZhEdit(p.originalIndex, h)} />}
            </div>
          ))}
        </div>
        <div className="col-span-4 bg-[#f9f9f9] p-4 rounded-lg overflow-hidden flex flex-col gap-4 border border-gray-100">
          {page.pageIndex === 1 && (
            <div className="mb-2 shrink-0">
              <h3 className="academic-title font-bold text-[8pt] uppercase tracking-widest text-gray-900 mb-2 border-b border-gray-200 pb-1">Summary</h3>
              <p className="academic-body text-[8.5pt] text-gray-600 leading-relaxed">{article.subtitle || 'An in-depth exploration of the topic.'}</p>
            </div>
          )}
          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            {page.vocabs.length > 0 && (
              <div>
                <h3 className="academic-title font-bold text-[8pt] uppercase tracking-widest text-gray-400 mb-3 border-b border-gray-200 pb-1">Core Vocabulary</h3>
                <div className="space-y-2">
                  {page.vocabs.map(v => (
                    <div key={v.id} className="bg-white border-l-[3px] p-2 rounded shadow-sm" style={{ borderLeftColor: v.color || '#333' }}>
                      <div className="academic-body font-bold text-[9.5pt] text-gray-900">{v.word}</div>
                      {v.phonetic && <div className="text-[7pt] text-gray-400">{v.phonetic}</div>}
                      <div className="academic-title text-[7.5pt] text-gray-600 mt-1 leading-tight">{v.definition}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {page.notes.length > 0 && (
              <div className="mt-2">
                <h3 className="academic-title font-bold text-[8pt] uppercase tracking-widest text-gray-400 mb-3 border-b border-gray-200 pb-1">Annotations</h3>
                <div className="space-y-2">
                  {page.notes.map(n => (
                    <div key={n.id} className="bg-white p-2 rounded shadow-sm border border-gray-100 border-l-[3px]" style={{ borderLeftColor: n.color || '#333' }}>
                      <div className="academic-body text-[7.5pt] text-gray-500 italic mb-1 line-clamp-2">&ldquo;{n.text}&rdquo;</div>
                      <div className="academic-title text-[8.5pt] text-gray-900 leading-tight">{n.comment}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <footer className="shrink-0 mt-4 pt-2 border-t border-gray-200 flex justify-between items-center">
        <span className="academic-title text-[7pt] text-gray-400 uppercase tracking-widest">Digital Scholar Journal</span>
        <span className="academic-title text-[8pt] font-bold text-gray-900">Page {page.pageIndex}</span>
      </footer>
    </div>
  );

  // ─── Editorial Prestige Style ───
  const renderEditorialPage = (page: PageData) => (
    <div
      key={`editorial-${page.pageIndex}`}
      className="a4-page bg-white shadow-2xl print:shadow-none relative flex flex-col"
      style={{ width: '210mm', height: '297mm', padding: '18mm 20mm', boxSizing: 'border-box', overflow: 'hidden' }}
    >
      {page.pageIndex === 1 ? (
        <header className="mb-8 shrink-0">
          <div className="flex justify-between items-center mb-6">
            <span className="editorial-serif text-[9pt] uppercase tracking-[0.3em] text-[#8b0000]">The Reader&rsquo;s Digest</span>
            <div className="flex gap-3 items-center">
              <span className="text-[8pt] text-gray-400 uppercase tracking-widest">{article.difficulty}</span>
              <span className="text-[8pt] text-gray-400">&bull;</span>
              <span className="text-[8pt] text-gray-400 uppercase tracking-widest">{article.wordCount} Words</span>
            </div>
          </div>
          <div className="w-full h-[2px] bg-[#8b0000] mb-6" />
          <h1 className="editorial-serif text-[36pt] leading-[1.05] text-[#1a1a1a] mb-4 tracking-tight">{article.title}</h1>
          {article.subtitle && <p className="editorial-serif text-[12pt] text-gray-500 italic leading-relaxed border-l-2 border-[#8b0000] pl-4">{article.subtitle}</p>}
          <div className="w-16 h-[1px] bg-[#8b0000] mt-6" />
        </header>
      ) : (
        <header className="mb-6 shrink-0 flex justify-between items-end pb-3 border-b border-[#8b0000]">
          <span className="editorial-serif text-[9pt] uppercase tracking-[0.3em] text-[#8b0000]">The Reader&rsquo;s Digest</span>
          <span className="editorial-serif text-[9pt] text-gray-400 italic">{article.title} &mdash; Part {page.pageIndex}</span>
        </header>
      )}
      <div className="flex-1 min-h-0 grid grid-cols-12 gap-8">
        <div className="col-span-8 overflow-hidden" style={{ columnCount: 2, columnGap: '20px', textAlign: 'justify' }}>
          {page.paragraphs.map((p) => (
            <div key={p.originalIndex} className="mb-5 break-inside-avoid relative" style={{ breakInside: 'avoid', orphans: 3, widows: 3 }}>
              <span className="editorial-serif text-[7pt] text-[#c4a882] font-bold absolute -left-0 top-0 select-none">{p.originalIndex + 1}</span>
              <RichTextParagraph className="rich-text-content editorial-serif text-[10.5pt] leading-[1.9] text-[#2a2a2a] outline-none pl-3" html={p.en} onChange={(h) => handleEnEdit(p.originalIndex, h)} />
              {p.zh && <RichTextParagraph className="rich-text-content text-[8pt] leading-snug text-gray-400 mt-2 outline-none pl-3" style={{ fontFamily: 'sans-serif' }} html={p.zh} onChange={(h) => handleZhEdit(p.originalIndex, h)} />}
            </div>
          ))}
        </div>
        <div className="col-span-4 bg-[#faf8f5] p-5 rounded border border-[#e8e0d4] overflow-hidden flex flex-col gap-5">
          {page.vocabs.length > 0 && (
            <div>
              <h3 className="text-[8pt] uppercase tracking-[0.2em] text-[#8b0000] font-bold mb-3 pb-2 border-b border-[#e8e0d4]">Vocabulary</h3>
              <div className="space-y-3">
                {page.vocabs.map(v => (
                  <div key={v.id} className="border-l-[3px] pl-3 py-1" style={{ borderLeftColor: v.color || '#8b0000' }}>
                    <div className="editorial-serif font-bold text-[10pt] text-[#1a1a1a]">{v.word}</div>
                    {v.phonetic && <div className="text-[7pt] text-[#999]">{v.phonetic}</div>}
                    <div className="text-[7.5pt] text-[#6b6b6b] mt-1 leading-tight" style={{ fontFamily: 'sans-serif' }}>{v.definition}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {page.notes.length > 0 && (
            <div>
              <h3 className="text-[8pt] uppercase tracking-[0.2em] text-[#8b0000] font-bold mb-3 pb-2 border-b border-[#e8e0d4]">Notes</h3>
              <div className="space-y-3">
                {page.notes.map(n => (
                  <div key={n.id} className="border-l-[3px] pl-3 py-1" style={{ borderLeftColor: n.color || '#8b0000' }}>
                    <div className="editorial-serif text-[7.5pt] text-[#888] italic mb-1 line-clamp-2">&ldquo;{n.text}&rdquo;</div>
                    <div className="text-[8.5pt] text-[#2a2a2a] leading-tight" style={{ fontFamily: 'sans-serif' }}>{n.comment}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <footer className="shrink-0 mt-4 pt-3 border-t border-[#8b0000] flex justify-between items-center">
        <span className="editorial-serif text-[7pt] text-[#8b0000] uppercase tracking-[0.2em]">The Reader&rsquo;s Digest</span>
        <span className="editorial-serif text-[8pt] text-gray-400 italic">Page {page.pageIndex}</span>
      </footer>
    </div>
  );

  // ─── Handwritten / Visual Infographic Style ───
  const renderHandwrittenPage = (page: PageData) => (
    <div
      key={`handwritten-${page.pageIndex}`}
      className="a4-page shadow-2xl print:shadow-none relative flex flex-col"
      style={{
        width: '210mm', height: '297mm', padding: '14mm 16mm', boxSizing: 'border-box', overflow: 'hidden',
        backgroundColor: '#fdf6e3',
        backgroundImage: 'radial-gradient(circle, #d4c5a9 0.8px, transparent 0.8px)',
        backgroundSize: '16px 16px',
      }}
    >
      {page.pageIndex === 1 ? (
        <header className="mb-6 shrink-0">
          <div className="flex justify-between items-start mb-3">
            <div className="handwritten-font text-[10pt] text-[#6b5b3e] bg-[#fff8dc] px-3 py-1 rounded-lg border-2 border-dashed border-[#d4c5a9] inline-block">My Reading Notes</div>
            <div className="flex gap-2">
              <span className="text-[8pt] bg-[#FFD93D]/30 text-[#6b5b3e] px-2 py-1 rounded-full font-bold">{article.difficulty}</span>
              <span className="text-[8pt] bg-[#4ECDC4]/30 text-[#3a7a74] px-2 py-1 rounded-full font-bold">{article.wordCount}w</span>
            </div>
          </div>
          <h1 className="handwritten-font text-[28pt] leading-[1.15] text-[#2c2416] mb-2">{article.title}</h1>
          {article.subtitle && <p className="handwritten-font text-[11pt] text-[#8b7355] leading-relaxed">{article.subtitle}</p>}
          <div className="mt-3 h-[2px] bg-gradient-to-r from-[#FF6B6B] via-[#FFD93D] to-[#4ECDC4] rounded-full" />
        </header>
      ) : (
        <header className="mb-4 shrink-0 flex justify-between items-end pb-2 border-b-2 border-dashed border-[#d4c5a9]">
          <span className="handwritten-font text-[10pt] text-[#6b5b3e]">My Reading Notes</span>
          <span className="handwritten-font text-[10pt] text-[#8b7355]">p.{page.pageIndex}</span>
        </header>
      )}
      <div className="flex-1 min-h-0 grid grid-cols-12 gap-5">
        <div className="col-span-8 overflow-hidden">
          {page.paragraphs.map((p) => (
            <div key={p.originalIndex} className="mb-5 break-inside-avoid relative" style={{ breakInside: 'avoid' }}>
              <span className="handwritten-font text-[9pt] text-[#c4a882] absolute -left-0 top-0 select-none">{p.originalIndex + 1}</span>
              <RichTextParagraph className="rich-text-content text-[10.5pt] leading-[2] text-[#2c2416] outline-none pl-4" style={{ fontFamily: 'Georgia, serif' }} html={p.en} onChange={(h) => handleEnEdit(p.originalIndex, h)} />
              {p.zh && <RichTextParagraph className="rich-text-content handwritten-font text-[9pt] leading-relaxed text-[#8b7355] mt-1 outline-none pl-4" html={p.zh} onChange={(h) => handleZhEdit(p.originalIndex, h)} />}
            </div>
          ))}
        </div>
        <div className="col-span-4 overflow-hidden flex flex-col gap-3">
          {page.vocabs.length > 0 && (
            <div>
              <div className="handwritten-font text-[9pt] text-[#6b5b3e] mb-2 flex items-center gap-1">Words</div>
              <div className="space-y-2">
                {page.vocabs.map((v, i) => (
                  <div key={v.id} className="bg-white/80 p-3 rounded-xl shadow-[2px_2px_8px_rgba(0,0,0,0.06)] border border-[#e8dcc8]" style={{ transform: `rotate(${i % 2 === 0 ? -0.5 : 0.8}deg)`, borderLeftWidth: '4px', borderLeftColor: v.color || '#FF6B6B' }}>
                    <div className="handwritten-font font-bold text-[10pt] text-[#2c2416]">{v.word}</div>
                    {v.phonetic && <div className="text-[7pt] text-[#a89070]">{v.phonetic}</div>}
                    <div className="text-[7.5pt] text-[#8b7355] mt-1 leading-tight" style={{ fontFamily: 'sans-serif' }}>{v.definition}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {page.notes.length > 0 && (
            <div>
              <div className="handwritten-font text-[9pt] text-[#6b5b3e] mb-2 flex items-center gap-1">Notes</div>
              <div className="space-y-2">
                {page.notes.map((n, i) => (
                  <div key={n.id} className="p-3 rounded-xl border-2 border-dashed" style={{ transform: `rotate(${i % 2 === 0 ? 0.5 : -0.8}deg)`, borderColor: n.color || '#4ECDC4', backgroundColor: `${n.color || '#4ECDC4'}15` }}>
                    <div className="text-[7.5pt] text-[#8b7355] italic mb-1 line-clamp-2" style={{ fontFamily: 'Georgia, serif' }}>&ldquo;{n.text}&rdquo;</div>
                    <div className="handwritten-font text-[9pt] text-[#2c2416] leading-tight">{n.comment}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <footer className="shrink-0 mt-3 pt-2 border-t-2 border-dashed border-[#d4c5a9] flex justify-between items-center">
        <span className="handwritten-font text-[8pt] text-[#8b7355]">Lumina Reader</span>
        <span className="handwritten-font text-[8pt] text-[#8b7355]">p.{page.pageIndex}</span>
      </footer>
    </div>
  );

  const renderPage = (page: PageData) => {
    if (designStyle === 'editorial') return renderEditorialPage(page);
    if (designStyle === 'handwritten') return renderHandwrittenPage(page);
    return renderAcademicPage(page);
  };

  // ─── Worksheet (academic only) ───
  const renderWorksheet = () => (
    <div
      className="a4-page bg-white shadow-2xl print:shadow-none relative flex flex-col"
      style={{ width: '210mm', height: '297mm', padding: '15mm', boxSizing: 'border-box', overflow: 'hidden' }}
    >
      <header className="mb-6 shrink-0 border-b-2 border-black pb-2">
        <h1 className="academic-title font-black text-2xl text-gray-900 uppercase tracking-widest">Critical Thinking & Application</h1>
      </header>
      <div className="flex-1 flex flex-col gap-8">
        <div className="shrink-0">
          <h2 className="academic-title font-bold text-lg text-gray-800 mb-4 flex items-center gap-2">
            <span className="bg-black text-white px-2 py-1 text-xs">PART 1</span> Discussion & Inference
          </h2>
          <ul className="academic-body list-decimal pl-5 space-y-4 text-[10.5pt] text-gray-800">
            <li>What is the primary underlying assumption the author makes in this text, and how does it influence the overall argument?</li>
            <li>Based on the evidence provided, what potential counterarguments could be raised against the author&rsquo;s main thesis?</li>
            <li>How might the concepts discussed in this article apply to a broader global or historical context?</li>
          </ul>
        </div>
        <div className="flex-1 flex flex-col border-2 border-black rounded-sm overflow-hidden">
          <h2 className="academic-title font-bold text-sm text-center bg-black text-white py-1">Cornell Notes Summary</h2>
          <div className="flex-1 flex">
            <div className="w-1/3 border-r-2 border-black p-3 bg-gray-50"><span className="academic-title text-xs font-bold text-gray-500 uppercase">Cues & Questions</span></div>
            <div className="w-2/3 p-3"><span className="academic-title text-xs font-bold text-gray-500 uppercase">Notes & Details</span></div>
          </div>
          <div className="h-40 border-t-2 border-black p-3 bg-gray-50"><span className="academic-title text-xs font-bold text-gray-500 uppercase">Summary (Retell the main idea in your own words)</span></div>
        </div>
      </div>
      <footer className="shrink-0 mt-4 pt-2 border-t border-gray-200 flex justify-between items-center">
        <span className="academic-title text-[7pt] text-gray-400 uppercase tracking-widest">Digital Scholar Journal</span>
        <span className="academic-title text-[8pt] font-bold text-gray-900">Worksheet</span>
      </footer>
    </div>
  );

  const styleButtons: { key: DesignStyle; icon: React.ReactNode; label: string }[] = [
    { key: 'academic', icon: <GraduationCap className="w-4 h-4" />, label: '学术' },
    { key: 'editorial', icon: <Newspaper className="w-4 h-4" />, label: '杂志' },
    { key: 'handwritten', icon: <PenTool className="w-4 h-4" />, label: '手记' },
  ];

  return (
    <div className="min-h-screen bg-gray-200 p-4 md:p-12 pb-32 print:p-0 print:m-0 print:bg-white flex flex-col items-center">
      {/* Floating Rich Text Toolbar */}
      {selectionRect && (
        <div
          className="fixed z-50 bg-gray-900 text-white rounded-lg shadow-xl flex items-center px-2 py-1 gap-1 print:hidden"
          style={{ top: selectionRect.top - 40, left: selectionRect.left + selectionRect.width / 2, transform: 'translateX(-50%)' }}
        >
          <button onMouseDown={(e) => { e.preventDefault(); applyFormat('bold'); }} className="p-1.5 hover:bg-gray-700 rounded"><Bold size={14}/></button>
          <button onMouseDown={(e) => { e.preventDefault(); applyFormat('italic'); }} className="p-1.5 hover:bg-gray-700 rounded"><Italic size={14}/></button>
          <button onMouseDown={(e) => { e.preventDefault(); applyFormat('underline'); }} className="p-1.5 hover:bg-gray-700 rounded"><Underline size={14}/></button>
          <div className="w-px h-4 bg-gray-700 mx-1" />
          <button onMouseDown={(e) => { e.preventDefault(); applyFormat('hiliteColor', '#ffeb3b'); }} className="p-1.5 hover:bg-gray-700 rounded text-yellow-400"><Highlighter size={14}/></button>
          <button onMouseDown={(e) => { e.preventDefault(); applyFormat('removeFormat'); }} className="p-1.5 hover:bg-gray-700 rounded"><Eraser size={14}/></button>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&display=swap');
        .academic-title { font-family: Arial, Helvetica, sans-serif !important; }
        .academic-body { font-family: Georgia, "Times New Roman", serif !important; text-align: justify !important; -webkit-hyphens: auto; hyphens: auto; }
        .academic-body p { break-inside: avoid; }
        .editorial-serif { font-family: Georgia, "Playfair Display", "Times New Roman", serif !important; }
        .handwritten-font { font-family: 'Caveat', cursive !important; }
        .rich-text-content b, .rich-text-content strong { font-weight: 800 !important; }
        .rich-text-content i, .rich-text-content em { font-style: italic !important; }
        .rich-text-content u { text-decoration: underline !important; text-underline-offset: 4px; }
        .rich-text-content::selection, .rich-text-content *::selection { background-color: rgba(255, 36, 66, 0.2); color: inherit; }
      `}</style>

      {/* Toolbar */}
      <div className="w-full max-w-[210mm] flex flex-col md:flex-row justify-between items-center gap-4 mb-8 print:hidden">
        <button onClick={onBack} className="group flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm hover:shadow transition-all font-sans font-bold text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> 返回阅读
        </button>

        <div className="flex items-center gap-3">
          {/* Style Switcher */}
          <div className="flex items-center bg-white rounded-lg shadow-sm p-1 gap-1">
            {styleButtons.map(s => (
              <button
                key={s.key}
                onClick={() => setDesignStyle(s.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  designStyle === s.key ? 'bg-black text-white' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {s.icon} {s.label}
              </button>
            ))}
          </div>

          {/* Export Controls */}
          <div className="flex items-center gap-2 p-2 bg-white rounded-lg shadow-sm">
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as 'png' | 'pdf')}
              className="bg-transparent font-sans font-bold text-sm text-gray-900 outline-none cursor-pointer"
              disabled={isExporting}
            >
              <option value="pdf">PDF</option>
              <option value="png">PNG</option>
            </select>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="bg-black text-white px-5 py-1.5 rounded-md hover:bg-gray-800 transition-all flex items-center gap-2 font-sans font-bold text-sm disabled:opacity-70"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {isExporting ? '...' : '导出'}
            </button>
          </div>
        </div>
      </div>

      {/* Iframe Warning Modal */}
      {showIframeWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm print:hidden">
          <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full mx-4 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6"><Download className="w-8 h-8 text-red-500" /></div>
            <h3 className="text-xl font-black text-gray-900 mb-4">需要新标签页打开</h3>
            <p className="text-gray-600 mb-8 leading-relaxed">由于浏览器的安全限制，在当前预览窗口中无法直接导出 PDF。</p>
            <div className="flex gap-4 justify-center">
              <button onClick={() => setShowIframeWarning(false)} className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-50 transition-colors">取消</button>
              <button onClick={() => { window.open(window.location.href, '_blank'); setShowIframeWarning(false); }} className="px-6 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors shadow-lg shadow-red-500/30">去新标签页打开</button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Page Container */}
      <div ref={layoutRef} className="flex flex-col gap-8 print:gap-0 print:block">
        {pages.map(renderPage)}
        {designStyle === 'academic' && renderWorksheet()}
      </div>
    </div>
  );
}
