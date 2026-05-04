import React, { useState } from 'react';
import { Article } from '../types';
import { BookOpen, Image as ImageIcon, Languages, History, Cloud } from 'lucide-react';

interface InputModeProps {
  onStartReading: (article: Article) => void;
  hasSavedSession?: boolean;
  onLoadSession?: () => void;
  initialArticle?: Article | null;
  syncCode?: string | null;
  syncStatus?: 'idle' | 'syncing' | 'synced' | 'error';
  onOpenSyncPanel?: () => void;
}

export default function InputMode({ onStartReading, hasSavedSession, onLoadSession, initialArticle, syncCode, syncStatus, onOpenSyncPanel }: InputModeProps) {
  const [title, setTitle] = useState(initialArticle?.title || '');
  const [subtitle, setSubtitle] = useState(initialArticle?.subtitle || '');
  const [body, setBody] = useState(initialArticle?.body || '');
  const [translationBody, setTranslationBody] = useState(initialArticle?.translationBody || '');
  const [isBilingual, setIsBilingual] = useState(!!initialArticle?.translationBody);
  const [difficulty, setDifficulty] = useState(initialArticle?.difficulty || 'Intermediate');
  const [imageUrl, setImageUrl] = useState(initialArticle?.imageUrl === 'https://picsum.photos/seed/reading/800/600' ? '' : (initialArticle?.imageUrl || ''));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !body) return;

    const wordCount = body.trim().split(/\s+/).length;
    const date = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    onStartReading({
      title,
      subtitle,
      body,
      translationBody: isBilingual && translationBody.trim() ? translationBody : undefined,
      date,
      difficulty,
      wordCount,
      imageUrl: imageUrl || 'https://picsum.photos/seed/reading/800/600',
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-8 pb-20">
      <div className="mb-12 text-center">
        <div className="inline-block px-4 py-1.5 rounded-full bg-xhs-red/5 text-xhs-red text-xs font-black mb-6 tracking-[0.2em] uppercase">
          Lumina Reader v2.0
        </div>
        <h1 className="font-display text-5xl md:text-6xl font-black text-ink mb-6 tracking-tighter">
          开始你的<span className="text-xhs-red">精读</span>之旅
        </h1>
        <p className="font-sans text-gray-400 text-lg font-medium">整理、标注并导出属于你的精美阅读笔记</p>
        
        {hasSavedSession && (
          <button
            onClick={onLoadSession}
            className="mt-8 inline-flex items-center gap-2 px-8 py-3 bg-white text-ink font-sans font-bold rounded-full hover:shadow-lg transition-all border border-gray-100 shadow-sm"
          >
            <History className="w-4 h-4 text-xhs-red" />
            恢复上次阅读
          </button>
        )}
        {onOpenSyncPanel && (
          <button
            onClick={onOpenSyncPanel}
            className="mt-4 inline-flex items-center gap-2 px-6 py-2.5 bg-white text-gray-500 font-sans font-bold rounded-full hover:shadow-md transition-all border border-gray-100 shadow-sm text-sm"
          >
            <Cloud className="w-4 h-4" />
            {syncCode ? `同步码 ${syncCode}` : '跨设备同步'}
            {syncStatus === 'syncing' && <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />}
            {syncStatus === 'synced' && <span className="w-2 h-2 rounded-full bg-green-400" />}
            {syncStatus === 'error' && <span className="w-2 h-2 rounded-full bg-red-400" />}
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-8 bg-white p-10 md:p-16 rounded-[3rem] shadow-[0_20px_60px_rgb(0,0,0,0.03)] border border-gray-50">
        <div className="space-y-6">
          <div>
            <label htmlFor="title" className="block font-sans font-black text-ink mb-3 text-sm uppercase tracking-wider">文章标题 *</label>
            <input
              type="text"
              id="title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-transparent focus:bg-white focus:border-xhs-red/20 focus:ring-4 focus:ring-xhs-red/5 outline-none transition-all font-serif text-xl font-bold"
              placeholder="例如: The Art of Minimalist Living"
            />
          </div>

          <div>
            <label htmlFor="subtitle" className="block font-sans font-black text-ink mb-3 text-sm uppercase tracking-wider">副标题 / 简介</label>
            <input
              type="text"
              id="subtitle"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-transparent focus:bg-white focus:border-xhs-red/20 focus:ring-4 focus:ring-xhs-red/5 outline-none transition-all font-sans"
              placeholder="简短的摘要或译文标题..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <label htmlFor="difficulty" className="block font-sans font-black text-ink mb-3 text-sm uppercase tracking-wider">难度等级</label>
              <select
                id="difficulty"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-transparent focus:bg-white focus:border-xhs-red/20 focus:ring-4 focus:ring-xhs-red/5 outline-none transition-all font-sans appearance-none cursor-pointer"
              >
                <option value="Beginner">Beginner (初级)</option>
                <option value="Intermediate">Intermediate (中级)</option>
                <option value="Advanced">Advanced (高级)</option>
                <option value="Academic">Academic (学术)</option>
              </select>
            </div>
            <div>
              <label htmlFor="imageUrl" className="block font-sans font-black text-ink mb-3 text-sm uppercase tracking-wider">封面图链接</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <ImageIcon className="h-5 w-5 text-gray-300" />
                </div>
                <input
                  type="url"
                  id="imageUrl"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full pl-14 pr-6 py-4 rounded-2xl bg-gray-50 border-transparent focus:bg-white focus:border-xhs-red/20 focus:ring-4 focus:ring-xhs-red/5 outline-none transition-all font-sans"
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-gray-50">
          <div className="flex items-center justify-between mb-6">
            <label className="block font-sans font-black text-ink text-sm uppercase tracking-wider">文章内容 *</label>
            <button
              type="button"
              onClick={() => setIsBilingual(!isBilingual)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-black transition-all ${
                isBilingual 
                ? 'bg-xhs-red text-white shadow-lg shadow-xhs-red/20' 
                : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
              }`}
            >
              <Languages className="w-4 h-4" />
              中英对照模式
            </button>
          </div>
          
          <div className={`grid gap-8 ${isBilingual ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
            <div className="space-y-3">
              {isBilingual && <div className="text-[10px] font-black text-gray-300 uppercase tracking-widest ml-2">Original Text</div>}
              <textarea
                id="body"
                required
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={12}
                className="w-full px-6 py-5 rounded-[2rem] bg-gray-50 border-transparent focus:bg-white focus:border-xhs-red/20 focus:ring-4 focus:ring-xhs-red/5 outline-none transition-all font-serif text-lg leading-relaxed resize-none"
                placeholder="在此粘贴英文原文..."
              />
            </div>
            
            {isBilingual && (
              <div className="space-y-3">
                <div className="text-[10px] font-black text-gray-300 uppercase tracking-widest ml-2">Translation</div>
                <textarea
                  id="translationBody"
                  required={isBilingual}
                  value={translationBody}
                  onChange={(e) => setTranslationBody(e.target.value)}
                  rows={12}
                  className="w-full px-6 py-5 rounded-[2rem] bg-gray-50 border-transparent focus:bg-white focus:border-xhs-red/20 focus:ring-4 focus:ring-xhs-red/5 outline-none transition-all font-intl text-base leading-relaxed resize-none"
                  placeholder="在此粘贴中文译文。请确保段落换行与原文一一对应..."
                />
              </div>
            )}
          </div>
        </div>

        <div className="pt-6">
          <button
            type="submit"
            className="w-full bg-xhs-red text-white font-sans font-black py-5 rounded-2xl hover:shadow-2xl hover:shadow-xhs-red/30 transition-all flex items-center justify-center gap-3 text-xl tracking-tight"
          >
            <BookOpen className="w-6 h-6" />
            开启沉浸式阅读
          </button>
        </div>
      </form>
    </div>
  );
}
