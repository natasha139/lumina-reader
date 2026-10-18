import React, { useRef, useState } from 'react';
import { Plus, BookOpen, Cloud, Search, Download, Upload, ArrowRight } from 'lucide-react';
import type { LibraryEntry, ReadingLibrary, ReadingStatus } from '../lib/library';
import { normalizeLibrary } from '../lib/library';

const labels: Record<ReadingStatus, string> = { unread: '待读', reading: '精读中', completed: '已完成' };
interface Props {
  library: ReadingLibrary;
  onOpen: (id: string) => void;
  onNew: () => void;
  onStatus: (id: string, status: ReadingStatus) => void;
  onImport: (library: ReadingLibrary) => void;
  onSync: () => void;
  onOpenSync: () => void;
  syncStatus: string;
  syncMessage: string;
  storageError: string;
}
export default function ArticleLibrary({ library, onOpen, onNew, onStatus, onImport, onSync, onOpenSync, syncStatus, syncMessage, storageError }: Props) {
  const [filter, setFilter] = useState<ReadingStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const entries = [...library.entries].sort((a, b) => b.updatedAt - a.updatedAt)
    .filter(e => (filter === 'all' || e.status === filter) && `${e.article.title} ${e.article.subtitle}`.toLowerCase().includes(query.toLowerCase()));
  const last = library.entries.find(e => e.id === library.activeId);
  const backup = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(library, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'lumina-reading-library.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    try {
      if (selected.size > 4 * 1024 * 1024) throw new Error('备份文件过大。');
      const raw = JSON.parse(await selected.text());
      const imported = normalizeLibrary(raw);
      if (!imported.entries.length || (raw.version === 2 && imported.entries.length !== raw.entries.length)) throw new Error('请选择有效的 Lumina 文章库备份。');
      onImport(imported); setError('');
    } catch (err) { setError(err instanceof Error ? err.message : '无法读取备份。'); }
    event.target.value = '';
  };
  const count = (status: ReadingStatus) => library.entries.filter(e => e.status === status).length;
  return (
    <main className="min-h-dvh bg-cream px-5 py-10 md:py-16">
      <div className="max-w-5xl mx-auto">
        <header className="flex flex-wrap items-start justify-between gap-6 mb-10">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-gray-400 font-bold mb-3">Lumina Reader</p>
            <h1 className="font-serif text-4xl md:text-5xl text-ink font-bold">我的精读书架</h1>
            <p className="mt-4 text-gray-500 text-sm">一篇篇读懂，一点点积累。文章、译文和生词都留在这里。</p>
          </div>
          <div className="flex gap-3">
            <button onClick={onOpenSync} className="library-secondary"><Cloud size={16} />{syncStatus === 'syncing' ? '同步中' : syncStatus === 'synced' ? '已同步' : '跨设备同步'}</button>
            <button onClick={onNew} className="library-primary"><Plus size={17} />添加文章</button>
          </div>
        </header>
        {(storageError || syncMessage) && <div role="status" className="mb-6 p-4 bg-white border border-amber-200 rounded-xl text-sm text-amber-800 flex flex-wrap gap-3 items-center">
          <span className="flex-1">{storageError || syncMessage}</span>
          <button onClick={backup} className="underline underline-offset-4">导出备份</button>
          <button onClick={onSync} disabled={syncStatus === 'syncing'} className="underline underline-offset-4 disabled:opacity-50">重试同步</button>
        </div>}
        {last && <button onClick={() => onOpen(last.id)} className="w-full text-left py-6 border-y border-gray-200 flex justify-between items-center gap-4 mb-9 group">
          <div><span className="text-xs text-xhs-red font-bold">继续上次阅读</span><p className="font-serif text-xl text-ink mt-2">{last.article.title}</p>
          <p className="text-xs text-gray-500 mt-2">{last.progress ? `读至第 ${Math.max(1, last.article.paragraphs?.findIndex(p => p.id === last.progress?.paragraphId)! + 1)} 段 · ` : ''}{last.vocabularies.length} 个生词</p></div>
          <ArrowRight size={22} className="text-gray-400 group-hover:text-ink transition-colors shrink-0" />
        </button>}
        <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
          <nav aria-label="文章状态" className="flex gap-2 flex-wrap">
            {(['all', 'unread', 'reading', 'completed'] as const).map(s => <button key={s} onClick={() => setFilter(s)} aria-pressed={filter === s}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${filter === s ? 'bg-ink text-white' : 'text-gray-500 hover:bg-white'}`}>
              {s === 'all' ? '全部' : labels[s]} <span className="ml-1 opacity-60">{s === 'all' ? library.entries.length : count(s)}</span>
            </button>)}
          </nav>
          <label className="flex gap-2 items-center bg-white rounded-lg px-3 py-2 border border-gray-100 text-gray-400"><Search size={16} />
            <input aria-label="搜索文章" value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索文章标题" className="outline-none text-sm text-ink bg-transparent w-40" />
          </label>
        </div>
        {!entries.length ? <div className="py-20 text-center border-y border-gray-200">
          <BookOpen className="mx-auto text-gray-300 mb-5" size={32} />
          <h2 className="font-serif text-2xl text-ink">{library.entries.length ? '没有找到文章' : '从第一篇外刊开始'}</h2>
          <p className="text-sm text-gray-500 mt-3 mb-6">{library.entries.length ? '试试其他状态或关键词。' : '粘贴原文，留待慢慢读；已有阅读记录会自动保留。'}</p>
          {!library.entries.length && <button onClick={onNew} className="library-primary mx-auto"><Plus size={16} />添加第一篇文章</button>}
        </div> : <div className="divide-y divide-gray-200 border-y border-gray-200">
          {entries.map((entry: LibraryEntry) => <article key={entry.id} className="py-6 flex flex-col sm:flex-row sm:items-center gap-4">
            <button className="flex-1 text-left group min-w-0" onClick={() => onOpen(entry.id)}>
              <p className="text-xs text-gray-400 mb-2">{entry.article.wordCount} 词 · {entry.article.difficulty}</p>
              <h2 className="font-serif text-xl md:text-2xl text-ink group-hover:text-xhs-red transition-colors break-words">{entry.article.title}</h2>
              {entry.article.subtitle && <p className="text-sm text-gray-500 mt-2 line-clamp-2">{entry.article.subtitle}</p>}
              <p className="text-xs text-gray-400 mt-3">{entry.vocabularies.length} 个生词 · {entry.notes.length} 条笔记</p>
            </button>
            <div className="flex items-center gap-3 shrink-0">
              <select aria-label={`${entry.article.title} 阅读状态`} value={entry.status} onChange={e => onStatus(entry.id, e.target.value as ReadingStatus)} className="text-sm rounded-lg p-2 bg-white border border-gray-200 text-gray-600">
                {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <button onClick={() => onOpen(entry.id)} className="library-secondary">{entry.status === 'unread' ? '开始精读' : '打开文章'}<ArrowRight size={15} /></button>
            </div>
          </article>)}
        </div>}
        <footer className="flex flex-wrap items-center justify-between gap-4 mt-8 text-xs text-gray-400">
          <p>本机自动保存 · 联网后同步</p>
          <div className="flex gap-5"><button onClick={backup} className="flex gap-1.5 items-center hover:text-ink"><Download size={14} />导出文章库</button>
            <button onClick={() => file.current?.click()} className="flex gap-1.5 items-center hover:text-ink"><Upload size={14} />导入备份</button>
            <input ref={file} type="file" accept=".json,application/json" onChange={importFile} className="hidden" aria-label="选择文章库备份" />
          </div>
        </footer>
        {error && <p role="alert" className="text-sm text-red-600 mt-4">{error}</p>}
      </div>
    </main>
  );
}
