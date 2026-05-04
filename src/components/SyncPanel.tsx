import React, { useState } from 'react';
import { X, Cloud, Link, Copy, Check } from 'lucide-react';

interface SyncPanelProps {
  syncCode: string | null;
  onLinkDevice: (code: string) => Promise<{ ok: boolean; error?: string }>;
  onClose: () => void;
}

export default function SyncPanel({ syncCode, onLinkDevice, onClose }: SyncPanelProps) {
  const [inputCode, setInputCode] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [linkSuccess, setLinkSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!syncCode) return;
    navigator.clipboard.writeText(syncCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLink = async () => {
    const code = inputCode.trim().toUpperCase();
    if (code.length !== 6) {
      setLinkError('请输入 6 位同步码');
      return;
    }
    setLinking(true);
    setLinkError('');
    const result = await onLinkDevice(code);
    setLinking(false);
    if (result.ok) {
      setLinkSuccess(true);
      setTimeout(() => onClose(), 1500);
    } else {
      setLinkError(result.error || '同步失败');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-sm mx-4 p-8 relative"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center">
            <Cloud className="w-5 h-5 text-gray-600" />
          </div>
          <div>
            <h2 className="font-sans font-black text-ink text-base">跨设备同步</h2>
            <p className="text-gray-400 text-xs mt-0.5">在另一台设备上输入同步码即可共享数据</p>
          </div>
        </div>

        {/* 本机同步码 */}
        <div className="mb-6">
          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">本机同步码</div>
          {syncCode ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-gray-50 rounded-2xl px-5 py-3 font-mono text-2xl font-black text-ink tracking-[0.3em] text-center">
                {syncCode}
              </div>
              <button
                onClick={handleCopy}
                className="w-11 h-11 flex items-center justify-center rounded-2xl bg-gray-50 text-gray-500 hover:bg-gray-100 transition-all flex-shrink-0"
              >
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-2xl px-5 py-3 text-center text-gray-400 text-sm">
              保存一篇文章后自动生成
            </div>
          )}
        </div>

        <div className="relative flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">或</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>

        {/* 输入另一台设备的同步码 */}
        <div>
          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">输入其他设备的同步码</div>
          <div className="flex gap-2">
            <input
              type="text"
              value={inputCode}
              onChange={e => {
                setInputCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
                setLinkError('');
              }}
              placeholder="XXXXXX"
              maxLength={6}
              className="flex-1 bg-gray-50 rounded-2xl px-5 py-3 font-mono text-xl font-black text-ink tracking-[0.3em] text-center outline-none focus:ring-2 focus:ring-gray-200 transition-all"
            />
            <button
              onClick={handleLink}
              disabled={linking || linkSuccess}
              className="w-11 h-11 flex items-center justify-center rounded-2xl bg-ink text-white hover:bg-black transition-all flex-shrink-0 disabled:opacity-50"
            >
              {linkSuccess ? <Check className="w-4 h-4 text-green-400" /> : <Link className="w-4 h-4" />}
            </button>
          </div>
          {linkError && <p className="text-red-400 text-xs mt-2 ml-1">{linkError}</p>}
          {linkSuccess && <p className="text-green-500 text-xs mt-2 ml-1">同步成功，正在跳转...</p>}
        </div>
      </div>
    </div>
  );
}
