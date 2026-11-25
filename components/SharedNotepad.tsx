// components/SharedNotepad.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FaSync,
  FaExclamationTriangle,
  FaKeyboard,
  FaCloud,
  FaPlus,
  FaTrash,
  FaCopy,
  FaCheck,
  FaDownload,
  FaTasks,
  FaEye,
  FaEdit,
  FaThumbtack,
} from 'react-icons/fa';
import { SharedNoteItem } from '@/types/shared-notepad';

interface SharedNotepadProps {
  fullHeight?: boolean;
}

const MAX_NOTE_LENGTH = 100000;

const SharedNotepad: React.FC<SharedNotepadProps> = ({ fullHeight = false }) => {
  const [notes, setNotes] = useState<SharedNoteItem[]>([
    {
      id: 'main_note',
      title: 'Ghi chú chung',
      content: '',
      pinned: true,
      updatedAt: new Date().toISOString(),
    },
  ]);
  const [activeNoteId, setActiveNoteId] = useState<string>('main_note');
  const [version, setVersion] = useState<number>(1);
  const [previewMode, setPreviewMode] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline' | 'error'>('synced');
  const [storageSource, setStorageSource] = useState<string>('Cloudflare R2');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestNotesRef = useRef<SharedNoteItem[]>(notes);
  const versionRef = useRef<number>(1);
  const isSavingRef = useRef<boolean>(false);
  const hasPendingChangesRef = useRef<boolean>(false);

  const activeNote = notes.find((n) => n.id === activeNoteId) || notes[0];

  const countWords = (text: string): number => {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  };

  const saveToServer = useCallback(async (notesToSave: SharedNoteItem[]) => {
    if (typeof window !== 'undefined' && !navigator.onLine) {
      setSyncStatus('offline');
      return;
    }

    isSavingRef.current = true;
    setSyncStatus('syncing');

    try {
      const res = await fetch('/api/notepad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notesToSave, version: versionRef.current }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      hasPendingChangesRef.current = false;
      if (data.version) {
        versionRef.current = data.version;
        setVersion(data.version);
      }
      setSyncStatus('synced');
      setLastSyncTime(new Date());

      if (data.source) {
        setStorageSource(data.source === 'cloudflare-d1' ? 'Cloudflare D1' : 'Cloudflare R2');
      }
    } catch (error) {
      console.error('Lỗi lưu ghi chú:', error);
      setSyncStatus('error');
    } finally {
      isSavingRef.current = false;
    }
  }, []);

  const scheduleSave = useCallback(
    (updatedNotes: SharedNoteItem[]) => {
      latestNotesRef.current = updatedNotes;
      hasPendingChangesRef.current = true;
      setSyncStatus('syncing');

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveToServer(updatedNotes);
      }, 700);
    },
    [saveToServer]
  );

  const fetchNotes = useCallback(async (isInitial = false) => {
    try {
      const isFocused =
        typeof document !== 'undefined' &&
        textareaRef.current &&
        document.activeElement === textareaRef.current;

      if (!isInitial && (hasPendingChangesRef.current || isSavingRef.current || isFocused)) {
        return;
      }

      const res = await fetch('/api/notepad');
      if (res.ok) {
        const data = await res.json();
        if (data.source) {
          setStorageSource(data.source === 'cloudflare-d1' ? 'Cloudflare D1' : 'Cloudflare R2');
        }

        const serverNotes: SharedNoteItem[] =
          Array.isArray(data.notes) && data.notes.length > 0
            ? data.notes
            : [
                {
                  id: 'main_note',
                  title: 'Ghi chú chung',
                  content: data.content || '',
                  pinned: true,
                  updatedAt: data.updatedAt || new Date().toISOString(),
                },
              ];

        const stillFocused =
          typeof document !== 'undefined' &&
          textareaRef.current &&
          document.activeElement === textareaRef.current;

        if (isInitial || (!hasPendingChangesRef.current && !isSavingRef.current && !stillFocused)) {
          setNotes(serverNotes);
          latestNotesRef.current = serverNotes;
          if (data.version) {
            versionRef.current = data.version;
            setVersion(data.version);
          }
          setActiveNoteId((prevId) =>
            serverNotes.some((n) => n.id === prevId) ? prevId : serverNotes[0].id
          );
          setSyncStatus('synced');
          if (data.updatedAt) {
            setLastSyncTime(new Date(data.updatedAt));
          }
        }
      }
    } catch (err) {
      if (isInitial) setSyncStatus('error');
    } finally {
      if (isInitial) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') setIsOnline(navigator.onLine);
    fetchNotes(true);

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchNotes(false);
      }
    }, 15000);

    const handleOnline = () => {
      setIsOnline(true);
      if (hasPendingChangesRef.current) saveToServer(latestNotesRef.current);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [fetchNotes, saveToServer]);

  const updateActiveNote = (patch: Partial<SharedNoteItem>) => {
    const now = new Date().toISOString();
    const updated = notes.map((n) =>
      n.id === activeNote.id ? { ...n, ...patch, updatedAt: now } : n
    );
    setNotes(updated);
    scheduleSave(updated);
  };

  const handleAddNote = () => {
    const newId = `note_${Date.now().toString(36)}`;
    const newNote: SharedNoteItem = {
      id: newId,
      title: `Trang mới ${notes.length + 1}`,
      content: '',
      pinned: false,
      updatedAt: new Date().toISOString(),
    };
    const updated = [...notes, newNote];
    setNotes(updated);
    setActiveNoteId(newId);
    setPreviewMode(false);
    scheduleSave(updated);
  };

  const handleDeleteNote = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (notes.length <= 1) {
      alert('Cần giữ lại ít nhất 1 trang ghi chú chung.');
      return;
    }
    const target = notes.find((n) => n.id === id);
    if (!window.confirm(`Xóa trang ghi chú "${target?.title}"?`)) return;

    const updated = notes.filter((n) => n.id !== id);
    setNotes(updated);
    if (activeNoteId === id) {
      setActiveNoteId(updated[0].id);
    }
    scheduleSave(updated);
  };

  const handleInsertChecklist = () => {
    const addition = (activeNote.content && !activeNote.content.endsWith('\n') ? '\n' : '') + '- [ ] Công việc cần làm\n';
    updateActiveNote({ content: (activeNote.content + addition).slice(0, MAX_NOTE_LENGTH) });
    setPreviewMode(false);
  };

  const handleToggleChecklistLine = (lineIdx: number) => {
    const lines = activeNote.content.split('\n');
    const line = lines[lineIdx] || '';
    if (/^-\s*\[\s\]/.test(line)) {
      lines[lineIdx] = line.replace(/^-\s*\[\s\]/, '- [x]');
    } else if (/^-\s*\[[xX]\]/.test(line)) {
      lines[lineIdx] = line.replace(/^-\s*\[[xX]\]/, '- [ ]');
    }
    updateActiveNote({ content: lines.join('\n') });
  };

  const handleCopyContent = async () => {
    try {
      await navigator.clipboard.writeText(activeNote.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore
    }
  };

  const handleDownloadMd = () => {
    const blob = new Blob([activeNote.content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeNote.title.replace(/\s+/g, '-').toLowerCase() || 'note'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveToServer(latestNotesRef.current);
    }
  };

  if (isLoading) {
    return (
      <div className="mt-6 pt-5 border-t border-gray-200 dark:border-zinc-700 animate-pulse">
        <div className="h-5 bg-gray-200 dark:bg-zinc-700 rounded w-48 mb-3" />
        <div className="h-44 bg-gray-100 dark:bg-zinc-800 rounded-xl" />
      </div>
    );
  }

  // Sắp xếp tab ghim lên đầu
  const orderedNotes = [...notes].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));

  return (
    <div className={`${fullHeight ? '' : 'mt-8 pt-6 border-t border-gray-200 dark:border-zinc-700'}`}>
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-100">
            📝 Sổ tay & Ghi chú dùng chung ({notes.length} trang)
          </h2>
          <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
            <FaCloud className="mr-1" /> {storageSource} • v{version}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {syncStatus === 'synced' && <span className="text-emerald-600 dark:text-emerald-400 font-medium">✓ Đã đồng bộ</span>}
          {syncStatus === 'syncing' && (
            <span className="text-amber-600 dark:text-amber-400 flex items-center">
              <FaSync className="animate-spin mr-1" /> Đang lưu...
            </span>
          )}
          {syncStatus === 'offline' && <span className="text-red-500">🔴 Đang ngoại tuyến</span>}
          {syncStatus === 'error' && (
            <span className="text-red-500 flex items-center">
              <FaExclamationTriangle className="mr-1" /> Lỗi đồng bộ
            </span>
          )}
          {lastSyncTime && (
            <span className="text-gray-400 hidden sm:inline">({lastSyncTime.toLocaleTimeString('vi-VN')})</span>
          )}
        </div>
      </div>

      {/* Thanh Tabs các trang ghi chú */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-2">
        {orderedNotes.map((note) => {
          const isActive = note.id === activeNote.id;
          return (
            <div
              key={note.id}
              onClick={() => setActiveNoteId(note.id)}
              className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer border transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-700'
              }`}
            >
              {note.pinned && <FaThumbtack className="w-2.5 h-2.5 opacity-80" />}
              <span>{note.title}</span>
              {notes.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => handleDeleteNote(note.id, e)}
                  className={`ml-1 p-0.5 rounded opacity-60 hover:opacity-100 ${
                    isActive ? 'hover:bg-blue-700 text-white' : 'hover:text-red-500'
                  }`}
                  title="Xóa trang này"
                >
                  <FaTrash className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={handleAddNote}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 whitespace-nowrap"
        >
          <FaPlus className="w-2.5 h-2.5" />
          <span>Thêm trang</span>
        </button>
      </div>

      {/* Khung chính của trang ghi chú đang chọn */}
      <div className="border border-gray-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800/80 overflow-hidden shadow-sm">
        {/* Thanh công cụ của trang */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-gray-50 dark:bg-zinc-900/70 border-b border-gray-200 dark:border-zinc-700">
          <div className="flex items-center gap-2 flex-1 min-w-[180px]">
            <input
              type="text"
              value={activeNote.title}
              onChange={(e) => updateActiveNote({ title: e.target.value })}
              placeholder="Tiêu đề trang ghi chú..."
              className="px-2 py-1 text-sm font-semibold bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none text-gray-900 dark:text-white w-full max-w-xs"
            />
            <button
              type="button"
              onClick={() => updateActiveNote({ pinned: !activeNote.pinned })}
              className={`p-1.5 rounded-md text-xs ${
                activeNote.pinned ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'text-gray-400 hover:text-gray-600'
              }`}
              title={activeNote.pinned ? 'Bỏ ghim trang này' : 'Ghim trang này lên đầu'}
            >
              <FaThumbtack className="w-3 h-3" />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleInsertChecklist}
              className="px-2.5 py-1 text-xs rounded-md bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 inline-flex items-center gap-1"
              title="Thêm dòng công việc cần làm"
            >
              <FaTasks className="w-3 h-3 text-blue-500" />
              <span className="hidden sm:inline">+ Việc cần làm</span>
            </button>

            <button
              type="button"
              onClick={() => setPreviewMode(!previewMode)}
              className={`px-2.5 py-1 text-xs rounded-md border inline-flex items-center gap-1 ${
                previewMode
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100'
              }`}
            >
              {previewMode ? <FaEdit className="w-3 h-3" /> : <FaEye className="w-3 h-3" />}
              <span>{previewMode ? 'Soạn thảo' : 'Xem Checklist / MD'}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyContent}
              className="px-2.5 py-1 text-xs rounded-md bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 inline-flex items-center gap-1"
              title="Sao chép toàn bộ nội dung"
            >
              {copied ? <FaCheck className="w-3 h-3 text-emerald-500" /> : <FaCopy className="w-3 h-3" />}
              <span className="hidden sm:inline">{copied ? 'Đã chép' : 'Copy'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadMd}
              className="p-1.5 text-xs rounded-md bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100"
              title="Tải ghi chú về máy (.md)"
            >
              <FaDownload className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Nội dung Soạn thảo hoặc Xem Checklist tương tác */}
        {previewMode ? (
          <div className={`p-4 overflow-y-auto space-y-1.5 ${fullHeight ? 'min-h-[60vh]' : 'min-h-[14rem] max-h-96'}`}>
            {activeNote.content.trim() === '' ? (
              <p className="text-sm text-gray-400 italic">Trang ghi chú này đang trống.</p>
            ) : (
              activeNote.content.split('\n').map((line, idx) => {
                if (/^-\s*\[([ xX])\]\s*/.test(line)) {
                  const isDone = /^-\s*\[[xX]\]/.test(line);
                  const text = line.replace(/^-\s*\[[ xX]\]\s*/, '');
                  return (
                    <label
                      key={idx}
                      className="flex items-center gap-2.5 py-1 px-2 rounded hover:bg-gray-50 dark:hover:bg-zinc-700/40 cursor-pointer text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={isDone}
                        onChange={() => handleToggleChecklistLine(idx)}
                        className="h-4 w-4 rounded text-blue-600"
                      />
                      <span className={isDone ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-100'}>
                        {text}
                      </span>
                    </label>
                  );
                }
                if (line.startsWith('# ')) {
                  return <h3 key={idx} className="text-lg font-bold text-gray-900 dark:text-white pt-2">{line.slice(2)}</h3>;
                }
                if (line.startsWith('## ')) {
                  return <h4 key={idx} className="text-base font-semibold text-gray-800 dark:text-gray-200 pt-1">{line.slice(3)}</h4>;
                }
                return (
                  <p key={idx} className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {line || '\u00A0'}
                  </p>
                );
              })
            )}
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={activeNote.content}
            onChange={(e) => {
              if (e.target.value.length <= MAX_NOTE_LENGTH) {
                updateActiveNote({ content: e.target.value });
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder="Nhập ghi chú chung, link chia sẻ nhanh, hoặc danh sách việc cần làm (- [ ] Việc 1)... Tự động đồng bộ cho mọi người!"
            className={`w-full p-3.5 bg-transparent focus:outline-none text-sm text-gray-900 dark:text-gray-100 resize-y ${
              fullHeight ? 'min-h-[60vh]' : 'min-h-[13rem]'
            }`}
          />
        )}

        {/* Footer thông tin số từ */}
        <div className="px-3.5 py-2 bg-gray-50/70 dark:bg-zinc-900/50 border-t border-gray-100 dark:border-zinc-700/70 flex justify-between items-center text-[11px] text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <FaKeyboard /> {countWords(activeNote.content)} từ
            </span>
            <span>
              {activeNote.content.length.toLocaleString('vi-VN')} / {MAX_NOTE_LENGTH.toLocaleString('vi-VN')} ký tự
            </span>
          </div>
          <span>{isOnline ? '🟢 Trực tuyến' : '🔴 Mất mạng'}</span>
        </div>
      </div>
    </div>
  );
};

export default SharedNotepad;
