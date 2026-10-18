import { useCallback, useEffect, useRef, useState } from 'react';
import { emptyLibrary, mergeLibraries, normalizeLibrary, type ReadingLibrary } from './library';

const KEY = 'lumina-reader-library-v2';
const API = '/api/library';
interface CachedLibrary { library: ReadingLibrary; base: ReadingLibrary }
function loadCache(): CachedLibrary {
  try {
    const cached = localStorage.getItem(KEY);
    if (cached) {
      const data = JSON.parse(cached);
      return { library: normalizeLibrary(data.library), base: normalizeLibrary(data.base) };
    }
    const legacy = localStorage.getItem('lumina-reader-session');
    return { library: normalizeLibrary(legacy ? JSON.parse(legacy) : null), base: emptyLibrary() };
  } catch { return { library: emptyLibrary(), base: emptyLibrary() }; }
}

export function useReadingLibrary() {
  const [cache, setCache] = useState(loadCache);
  const cacheRef = useRef(cache);
  const [status, setStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [storageError, setStorageError] = useState('');
  const [syncCode, setSyncCode] = useState<string | null>(null);
  const device = useRef('');
  const busy = useRef(false);
  const linking = useRef(false);
  const pendingLink = useRef<string | null>(null);
  const mounted = useRef(true);

  const store = useCallback((next: CachedLibrary) => {
    cacheRef.current = next;
    if (mounted.current) setCache(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      if (mounted.current) setStorageError('');
    } catch {
      if (mounted.current) setStorageError('浏览器未能保存本机数据，请立即导出文章库备份。');
    }
  }, []);

  const update = useCallback((fn: (library: ReadingLibrary) => ReadingLibrary) => {
    store({ ...cacheRef.current, library: fn(cacheRef.current.library) });
    setStatus('idle');
  }, [store]);

  const sync = useCallback(async () => {
    if (busy.current || linking.current || !device.current) return;
    busy.current = true;
    setStatus('syncing');
    try {
      // Always refresh the shared revision before writing, including after offline edits.
      let response = await fetch(`${API}?user_id=${encodeURIComponent(device.current)}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('云端暂不可用，本机内容已保留；联网后会自动重试。');
      let remote = await response.json();
      for (let attempt = 0; attempt < 4; attempt++) {
        const remoteLibrary = normalizeLibrary(remote.library);
        const merged = mergeLibraries(pendingLink.current ? emptyLibrary() : cacheRef.current.base, cacheRef.current.library, remoteLibrary);
        store({ library: merged, base: remoteLibrary });
        setSyncCode(remote.sync_code);
        if (JSON.stringify(merged) === JSON.stringify(remoteLibrary)) {
          setStatus('synced'); setMessage(''); return;
        }
        const sent = merged;
        response = await fetch(API, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: device.current, library: sent, revision: remote.revision }),
        });
        const data = await response.json();
        if (response.status === 409) { remote = data; continue; }
        if (!response.ok || !data.ok) throw new Error(data.error || '同步失败，本机内容已保留。');
        // The user may have edited while the request was in flight.
        store({ library: cacheRef.current.library, base: sent });
        pendingLink.current = null; setSyncCode(data.sync_code); setStatus('synced'); setMessage(''); return;
      }
      throw new Error('其他设备正在编辑，已保留本机内容，将自动重试。');
    } catch (error) {
      if (mounted.current) { setStatus('error'); setMessage(error instanceof Error ? error.message : '同步失败，本机内容已保留。'); }
    } finally { busy.current = false; }
  }, [store]);

  useEffect(() => {
    mounted.current = true;
    try {
      device.current = localStorage.getItem('lumina-user-id') || crypto.randomUUID();
      localStorage.setItem('lumina-user-id', device.current);
    } catch {
      setStorageError('浏览器存储不可用，请导出备份后再关闭页面。');
      device.current ||= crypto.randomUUID();
    }
    void sync();
    const refresh = () => { if (document.visibilityState !== 'hidden') void sync(); };
    const timer = window.setInterval(refresh, 20000);
    window.addEventListener('online', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      mounted.current = false; clearInterval(timer);
      window.removeEventListener('online', refresh); window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [sync]);

  useEffect(() => {
    if (JSON.stringify(cache.library) === JSON.stringify(cache.base)) return;
    const timer = setTimeout(() => void sync(), 1500);
    return () => clearTimeout(timer);
  }, [cache, sync]);

  const linkDevice = async (code: string): Promise<{ ok: boolean; error?: string }> => {
    if (busy.current || linking.current) return { ok: false, error: '正在同步，请稍后再连接。' };
    linking.current = true;
    // Retain the local library even if the device has never synced successfully.
    try {
      localStorage.setItem(`${KEY}-before-link`, JSON.stringify(cacheRef.current));
      // A failed response can follow a successful server-side rebind; on retry,
      // merge as an import until the first new-library write is acknowledged.
      pendingLink.current = code;
      const response = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: device.current, action: 'link', sync_code: code }) });
      const data = await response.json();
      if (!response.ok || !data.ok) return { ok: false, error: data.error || '连接失败，请重试。' };
      const remote = normalizeLibrary(data.library);
      store({ library: mergeLibraries(emptyLibrary(), cacheRef.current.library, remote), base: remote });
      setSyncCode(data.sync_code); setStatus('idle'); setMessage(''); pendingLink.current = null;
      return { ok: true };
    } catch { return { ok: false, error: '连接失败，本机文章库已保留，请重试。' }; }
    finally { linking.current = false; }
  };

  return { library: cache.library, update, status, message, storageError, syncCode, sync, linkDevice };
}
