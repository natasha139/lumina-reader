import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
export default function StudyDialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    dialog.querySelector<HTMLElement>('input, textarea')?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { dialog.close(); document.body.style.overflow = previous; };
  }, []);
  return <dialog ref={ref} aria-label={title} onCancel={event => { event.preventDefault(); onClose(); }} className="study-dialog">
    <div className="flex items-center justify-between gap-4 mb-6">
      <h2 className="font-serif text-2xl font-bold text-ink">{title}</h2>
      <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" aria-label="关闭编辑器"><X size={19} /></button>
    </div>
    {children}
  </dialog>;
}
