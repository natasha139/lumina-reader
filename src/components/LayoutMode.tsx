import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Article, Vocabulary, Note } from '../types';
import html2canvas from 'html2canvas';
import { Download, ArrowLeft, Loader2, Bold, Italic, Underline, Highlighter, Eraser } from 'lucide-react';

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

  // Rich Text Editing State
  const [localEnParas, setLocalEnParas] = useState<string[]>(() => article.body.split(/\n+/).filter(p => p.trim()));
  const [localZhParas, setLocalZhParas] = useState<string[]>(() => article.translationBody ? article.translationBody.split(/\n+/).filter(p => p.trim()) : []);
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    setLocalEnParas(article.body.split(/\n+/).filter(p => p.trim()));
    setLocalZhParas(article.translationBody ? article.translationBody.split(/\n+/).filter(p => p.trim()) : []);
  }, [article.body, article.translationBody]);

  // Heuristic Pagination Engine
  const pages = useMemo(() => {
    const result: PageData[] = [];
    let currentPage: PageData = { pageIndex: 1, paragraphs: [], vocabs: [], notes: [] };
    let currentCharCount = 0;
    
    // Approximate character limits per A4 page (210x297mm)
    // Page 1 has a large header, so it holds less text.
    const PAGE_1_LIMIT = 1500; 
    const PAGE_N_LIMIT = 3200;

    localEnParas.forEach((en, idx) => {
      const zh = localZhParas[idx] || '';
      const paraChars = en.length + zh.length;
      const limit = currentPage.pageIndex === 1 ? PAGE_1_LIMIT : PAGE_N_LIMIT;

      // If adding this paragraph exceeds the limit AND the page isn't empty, push to next page
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
  }, [localEnParas, localZhParas, vocabularies, notes]);

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
          if (rect.width > 0) {
            setSelectionRect(rect);
            return;
          }
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
    if (onUpdateArticle) {
      onUpdateArticle({
        ...article,
        body: newParas.join('\n\n')
      });
    }
  };

  const handleZhEdit = (idx: number, newHtml: string) => {
    const newParas = [...localZhParas];
    newParas[idx] = newHtml;
    setLocalZhParas(newParas);
    if (onUpdateArticle) {
      onUpdateArticle({
        ...article,
        translationBody: newParas.join('\n\n')
      });
    }
  };

  const handleExport = async () => {
    if (exportFormat === 'pdf') {
      if (window !== window.parent) {
        setShowIframeWarning(true);
        return;
      }

      const style = document.createElement('style');
      style.innerHTML = `
        @page {
          size: A4;
          margin: 0;
        }
        @media print {
          html, body {
            width: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            background: white !important;
          }
          body > *:not(#root) { display: none !important; }
          .print\\:hidden { display: none !important; }
          #root { width: 210mm !important; }
          
          .a4-page {
            width: 210mm !important;
            height: 297mm !important;
            margin: 0 !important;
            padding: 15mm !important;
            box-shadow: none !important;
            page-break-after: always !important;
            break-after: page !important;
          }
          .a4-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
        }
      `;
      document.head.appendChild(style);
      
      window.getComputedStyle(document.body).getPropertyValue('display');
      window.print();
      
      setTimeout(() => {
        if (document.head.contains(style)) {
          document.head.removeChild(style);
        }
      }, 2000);
      
      return;
    }

    if (!layoutRef.current) return;
    setIsExporting(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const element = layoutRef.current;
      
      const canvas = await html2canvas(element, {
        scale: 2, // Reduced scale slightly to handle very long multi-page images
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#e5e7eb', // Match the gray background
        logging: true,
      });
      
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

  return (
    <div className="min-h-screen bg-gray-200 p-4 md:p-12 pb-32 print:p-0 print:m-0 print:bg-white flex flex-col items-center">
      {/* Floating Rich Text Toolbar */}
      {selectionRect && (
        <div 
          className="fixed z-50 bg-gray-900 text-white rounded-lg shadow-xl flex items-center px-2 py-1 gap-1 print:hidden"
          style={{
            top: selectionRect.top - 40,
            left: selectionRect.left + selectionRect.width / 2,
            transform: 'translateX(-50%)'
          }}
        >
          <button onMouseDown={(e) => { e.preventDefault(); applyFormat('bold'); }} className="p-1.5 hover:bg-gray-700 rounded"><Bold size={14}/></button>
          <button onMouseDown={(e) => { e.preventDefault(); applyFormat('italic'); }} className="p-1.5 hover:bg-gray-700 rounded"><Italic size={14}/></button>
          <button onMouseDown={(e) => { e.preventDefault(); applyFormat('underline'); }} className="p-1.5 hover:bg-gray-700 rounded"><Underline size={14}/></button>
          <div className="w-px h-4 bg-gray-700 mx-1" />
          <button onMouseDown={(e) => { e.preventDefault(); applyFormat('hiliteColor', '#ffeb3b'); }} className="p-1.5 hover:bg-gray-700 rounded text-yellow-400"><Highlighter size={14}/></button>
          <button onMouseDown={(e) => { e.preventDefault(); applyFormat('removeFormat'); }} className="p-1.5 hover:bg-gray-700 rounded"><Eraser size={14}/></button>
        </div>
      )}

      <style>
        {`
          .academic-title {
            font-family: Arial, Helvetica, sans-serif !important;
          }
          .academic-body {
            font-family: Georgia, "Times New Roman", serif !important;
            text-align: justify !important;
            -webkit-hyphens: auto;
            hyphens: auto;
          }
          .academic-body p {
            break-inside: avoid;
          }
          .rich-text-content b, 
          .rich-text-content strong {
            font-weight: 800 !important;
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
            background-color: rgba(255, 36, 66, 0.2);
            color: inherit;
          }
        `}
      </style>

      {/* Toolbar */}
      <div className="w-full max-w-[210mm] flex flex-col md:flex-row justify-between items-center gap-4 mb-8 print:hidden">
        <button 
          onClick={onBack} 
          className="group flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm hover:shadow transition-all font-sans font-bold text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> 
          返回阅读
        </button>
        
        <div className="flex items-center gap-4 p-2 bg-white rounded-lg shadow-sm">
          <div className="flex items-center gap-2 px-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">格式</span>
            <select 
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as 'png' | 'pdf')}
              className="bg-transparent font-sans font-bold text-sm text-gray-900 outline-none cursor-pointer"
              disabled={isExporting}
            >
              <option value="pdf">PDF 文档 (多页 A4)</option>
              <option value="png">PNG 图片 (长图)</option>
            </select>
          </div>

          <button 
            onClick={handleExport}
            disabled={isExporting}
            className="bg-black text-white px-6 py-2 rounded-md hover:bg-gray-800 transition-all flex items-center gap-2 font-sans font-bold text-sm disabled:opacity-70"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {isExporting ? '生成中...' : '导出'}
          </button>
        </div>
      </div>

      {/* Iframe Warning Modal */}
      {showIframeWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm print:hidden">
          <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full mx-4 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Download className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-4">需要新标签页打开</h3>
            <p className="text-gray-600 mb-8 leading-relaxed">
              由于浏览器的安全限制，在当前预览窗口中无法直接导出 PDF。请点击下方按钮在新标签页中打开应用，然后再进行导出。
            </p>
            <div className="flex gap-4 justify-center">
              <button 
                onClick={() => setShowIframeWarning(false)}
                className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button 
                onClick={() => {
                  window.open(window.location.href, '_blank');
                  setShowIframeWarning(false);
                }}
                className="px-6 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors shadow-lg shadow-red-500/30"
              >
                去新标签页打开
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Page Container */}
      <div ref={layoutRef} className="flex flex-col gap-8 print:gap-0 print:block">
        {pages.map((page) => (
          <div 
            key={page.pageIndex}
            className="a4-page bg-white shadow-2xl print:shadow-none relative flex flex-col"
            style={{
              width: '210mm',
              height: '297mm',
              padding: '15mm',
              boxSizing: 'border-box',
              overflow: 'hidden'
            }}
          >
            {/* Header Area */}
            {page.pageIndex === 1 ? (
              <header className="mb-6 shrink-0">
                <div className="flex justify-between items-start mb-4">
                  <div className="academic-title px-3 py-1 bg-black text-white text-[8pt] font-bold uppercase tracking-widest">Digital Scholar</div>
                  <div className="flex gap-2">
                    <span className="academic-title px-2 py-1 border border-gray-300 text-gray-600 text-[8pt] font-bold rounded-full uppercase">#{article.difficulty || 'READING'}</span>
                    <span className="academic-title px-2 py-1 border border-gray-300 text-gray-600 text-[8pt] font-bold rounded-full uppercase">#{article.wordCount}W</span>
                  </div>
                </div>
                <h1 className="academic-title font-black text-4xl leading-[1.1] text-gray-900 mb-3 text-justify">
                  {article.title}
                </h1>
                {article.subtitle && (
                  <h2 className="academic-title text-sm text-gray-600 italic text-justify border-l-2 border-red-500 pl-3">
                    {article.subtitle}
                  </h2>
                )}
              </header>
            ) : (
              <header className="mb-4 shrink-0 border-b border-gray-200 pb-2 flex justify-between items-end">
                <h1 className="academic-title font-bold text-[10pt] text-gray-900 uppercase tracking-widest line-clamp-1">{article.title}</h1>
                <span className="academic-title text-[8pt] text-gray-400">Part {page.pageIndex}</span>
              </header>
            )}

            {/* Grid Content Area */}
            <div className="flex-1 min-h-0 grid grid-cols-12 gap-6">
              {/* Left Column: Text */}
              <div className="col-span-8 overflow-hidden" style={{ columnCount: 2, columnGap: '15px', textAlign: 'justify' }}>
                {page.paragraphs.map((p) => (
                  <div key={p.originalIndex} className="mb-4 break-inside-avoid" style={{ breakInside: 'avoid', orphans: 3, widows: 3 }}>
                    <RichTextParagraph 
                      className="rich-text-content academic-body text-[10.5pt] leading-relaxed text-gray-900 outline-none"
                      html={p.en}
                      onChange={(newHtml) => handleEnEdit(p.originalIndex, newHtml)}
                    />
                    {p.zh && (
                      <RichTextParagraph 
                        className="rich-text-content academic-title text-[8pt] leading-snug text-gray-500 mt-1 outline-none"
                        html={p.zh}
                        onChange={(newHtml) => handleZhEdit(p.originalIndex, newHtml)}
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Right Column: Sidebar */}
              <div className="col-span-4 bg-[#f9f9f9] p-4 rounded-lg overflow-hidden flex flex-col gap-4 border border-gray-100">
                {page.pageIndex === 1 && (
                  <>
                    <div className="mb-2 shrink-0">
                      <h3 className="academic-title font-bold text-[8pt] uppercase tracking-widest text-gray-900 mb-2 border-b border-gray-200 pb-1">Summary</h3>
                      <p className="academic-body text-[8.5pt] text-gray-600 leading-relaxed">
                        {article.subtitle || "An in-depth exploration of the topic, highlighting key concepts and vocabulary for advanced reading comprehension."}
                      </p>
                    </div>
                    <div className="mb-2 shrink-0">
                      <h3 className="academic-title font-bold text-[8pt] uppercase tracking-widest text-gray-900 mb-2 border-b border-gray-200 pb-1">Collocation Library</h3>
                      <div className="space-y-2">
                        <div className="bg-white border-l-[3px] border-red-500 p-2 rounded shadow-sm">
                          <div className="academic-body font-bold text-[9pt] text-gray-900 italic">boost critical awareness</div>
                          <div className="academic-title text-[7.5pt] text-gray-600 mt-1">Enhance the ability to analyze and evaluate information critically.</div>
                        </div>
                        <div className="bg-white border-l-[3px] border-red-500 p-2 rounded shadow-sm">
                          <div className="academic-body font-bold text-[9pt] text-gray-900 italic">unprecedented feat</div>
                          <div className="academic-title text-[7.5pt] text-gray-600 mt-1">An achievement that has never been done or known before.</div>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <div className="flex-1 overflow-hidden flex flex-col gap-4">
                  {page.vocabs.length > 0 && (
                    <div>
                      <h3 className="academic-title font-bold text-[8pt] uppercase tracking-widest text-gray-400 mb-3 border-b border-gray-200 pb-1">Core Vocabulary</h3>
                      <div className="space-y-2">
                        {page.vocabs.map(v => (
                          <div key={v.id} className="bg-white border-l-[3px] p-2 rounded shadow-sm" style={{ borderLeftColor: v.color || '#333' }}>
                            <div className="academic-body font-bold text-[9.5pt] text-gray-900">{v.word}</div>
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
                            <div className="academic-body text-[7.5pt] text-gray-500 italic mb-1 line-clamp-2">"{n.text}"</div>
                            <div className="academic-title text-[8.5pt] text-gray-900 leading-tight">{n.comment}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Area */}
            <footer className="shrink-0 mt-4 pt-2 border-t border-gray-200 flex justify-between items-center">
              <span className="academic-title text-[7pt] text-gray-400 uppercase tracking-widest">Digital Scholar Journal</span>
              <span className="academic-title text-[8pt] font-bold text-gray-900">Page {page.pageIndex}</span>
            </footer>
          </div>
        ))}

        {/* Worksheet Page */}
        <div 
          className="a4-page bg-white shadow-2xl print:shadow-none relative flex flex-col"
          style={{
            width: '210mm',
            height: '297mm',
            padding: '15mm',
            boxSizing: 'border-box',
            overflow: 'hidden'
          }}
        >
          <header className="mb-6 shrink-0 border-b-2 border-black pb-2">
            <h1 className="academic-title font-black text-2xl text-gray-900 uppercase tracking-widest">Critical Thinking & Application</h1>
          </header>
          
          <div className="flex-1 flex flex-col gap-8">
            {/* Critical Thinking */}
            <div className="shrink-0">
              <h2 className="academic-title font-bold text-lg text-gray-800 mb-4 flex items-center gap-2">
                <span className="bg-black text-white px-2 py-1 text-xs">PART 1</span> 
                Discussion & Inference
              </h2>
              <ul className="academic-body list-decimal pl-5 space-y-4 text-[10.5pt] text-gray-800">
                <li>What is the primary underlying assumption the author makes in this text, and how does it influence the overall argument?</li>
                <li>Based on the evidence provided, what potential counterarguments could be raised against the author's main thesis?</li>
                <li>How might the concepts discussed in this article apply to a broader global or historical context?</li>
              </ul>
            </div>

            {/* Cornell Notes */}
            <div className="flex-1 flex flex-col border-2 border-black rounded-sm overflow-hidden">
              <h2 className="academic-title font-bold text-sm text-center bg-black text-white py-1">
                Cornell Notes Summary
              </h2>
              <div className="flex-1 flex">
                <div className="w-1/3 border-r-2 border-black p-3 bg-gray-50">
                  <span className="academic-title text-xs font-bold text-gray-500 uppercase">Cues & Questions</span>
                </div>
                <div className="w-2/3 p-3">
                  <span className="academic-title text-xs font-bold text-gray-500 uppercase">Notes & Details</span>
                </div>
              </div>
              <div className="h-40 border-t-2 border-black p-3 bg-gray-50">
                <span className="academic-title text-xs font-bold text-gray-500 uppercase">Summary (Retell the main idea in your own words)</span>
              </div>
            </div>
          </div>
          
          <footer className="shrink-0 mt-4 pt-2 border-t border-gray-200 flex justify-between items-center">
            <span className="academic-title text-[7pt] text-gray-400 uppercase tracking-widest">Digital Scholar Journal</span>
            <span className="academic-title text-[8pt] font-bold text-gray-900">Worksheet</span>
          </footer>
        </div>
      </div>
    </div>
  );
}
