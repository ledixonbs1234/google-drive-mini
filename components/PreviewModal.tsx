// components/PreviewModal.tsx
'use client';

import { Dialog, Transition } from '@headlessui/react';
import { Fragment, useState, useEffect, useRef, useMemo } from 'react';
import {
  FaTimes,
  FaDownload,
  FaExpand,
  FaCompress,
  FaVolumeUp,
  FaPlay,
  FaPause,
  FaForward,
  FaBackward,
  FaVolumeOff,
  FaFilePdf,
  FaCube,
  FaFileCode,
  FaTable,
  FaEdit,
} from 'react-icons/fa';
import { useAppStore } from '../store/useAppStore';

/**
 * Parser CSV nhẹ hỗ trợ cả dấu ngoặc kép
 */
function parseCsvRows(raw: string, delimiter = ','): string[][] {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  return lines.slice(0, 500).map((line) => {
    const row: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === delimiter && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    row.push(current.trim());
    return row;
  });
}

/**
 * Trình render Markdown an toàn sang JSX (hỗ trợ Tiêu đề, Code block, Danh sách, Checklist, In đậm/nghiêng)
 */
function SimpleMarkdownView({ content }: { content: string }) {
  const lines = content.split(/\r?\n/);
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBuffer: string[] = [];

  const renderInline = (text: string) => {
    const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={idx} className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-zinc-700 font-mono text-xs text-pink-600 dark:text-pink-400">
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={idx}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  lines.forEach((line, idx) => {
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`code-${idx}`} className="my-3 p-3.5 rounded-lg bg-zinc-900 text-zinc-100 font-mono text-xs overflow-x-auto">
            <code>{codeBuffer.join('\n')}</code>
          </pre>
        );
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      return;
    }

    if (line.startsWith('# ')) {
      elements.push(<h1 key={idx} className="text-2xl font-bold mt-4 mb-2 text-gray-900 dark:text-white">{renderInline(line.slice(2))}</h1>);
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={idx} className="text-xl font-semibold mt-4 mb-2 text-gray-800 dark:text-gray-100 border-b border-gray-200 dark:border-zinc-700 pb-1">{renderInline(line.slice(3))}</h2>);
    } else if (line.startsWith('### ')) {
      elements.push(<h3 key={idx} className="text-lg font-semibold mt-3 mb-1.5 text-gray-800 dark:text-gray-200">{renderInline(line.slice(4))}</h3>);
    } else if (/^-\s*\[([ xX])\]\s+/.test(line)) {
      const checked = /^-\s*\[[xX]\]/.test(line);
      const label = line.replace(/^-\s*\[[ xX]\]\s+/, '');
      elements.push(
        <div key={idx} className="flex items-center gap-2 my-1 text-sm">
          <input type="checkbox" checked={checked} readOnly className="rounded text-blue-600" />
          <span className={checked ? 'line-through text-gray-400' : ''}>{renderInline(label)}</span>
        </div>
      );
    } else if (/^[-*]\s+/.test(line)) {
      elements.push(
        <li key={idx} className="ml-5 list-disc text-sm my-0.5 text-gray-700 dark:text-gray-300">
          {renderInline(line.replace(/^[-*]\s+/, ''))}
        </li>
      );
    } else if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={idx} className="border-l-4 border-blue-500 pl-3 italic text-gray-600 dark:text-gray-400 my-2 text-sm">
          {renderInline(line.slice(2))}
        </blockquote>
      );
    } else if (line.trim() === '---') {
      elements.push(<hr key={idx} className="my-4 border-gray-200 dark:border-zinc-700" />);
    } else if (line.trim() === '') {
      elements.push(<div key={idx} className="h-2" />);
    } else {
      elements.push(
        <p key={idx} className="text-sm leading-relaxed text-gray-700 dark:text-gray-300 my-1">
          {renderInline(line)}
        </p>
      );
    }
  });

  return <div>{elements}</div>;
}

const PreviewModal: React.FC = () => {
  const isOpen = useAppStore((state) => state.isPreviewModalOpen);
  const previewFile = useAppStore((state) => state.previewFile);
  const closeModal = useAppStore((state) => state.closePreviewModal);
  const openEditorModal = useAppStore((state) => state.openEditorModal);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [textContent, setTextContent] = useState('');
  const [rawMarkdownView, setRawMarkdownView] = useState(false);
  const [csvSearch, setCsvSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setIsFullscreen(false);
      setTextContent('');
      setIsLoading(false);
      setCsvSearch('');
      setRawMarkdownView(false);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
    }
  }, [isOpen]);

  // Tải nội dung văn bản cho cả Markdown, Code và CSV/TSV
  useEffect(() => {
    if (
      isOpen &&
      previewFile?.url &&
      (previewFile.type === 'markdown' || previewFile.type === 'code' || previewFile.type === 'csv')
    ) {
      setIsLoading(true);
      fetch(previewFile.url)
        .then((res) => res.text())
        .then((text) => {
          setTextContent(text);
          setIsLoading(false);
        })
        .catch((err) => {
          console.error('Error loading file text:', err);
          setTextContent('Không thể tải nội dung tệp.');
          setIsLoading(false);
        });
    }
  }, [isOpen, previewFile]);

  const csvRows = useMemo(() => {
    if (previewFile?.type !== 'csv' || !textContent) return [];
    const delim = previewFile.name.toLowerCase().endsWith('.tsv') ? '\t' : ',';
    return parseCsvRows(textContent, delim);
  }, [previewFile, textContent]);

  if (!previewFile) return null;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = previewFile.url.includes('/api/files/download')
      ? `${previewFile.url}&download=1`
      : previewFile.url;
    link.download = previewFile.name;
    link.click();
  };

  const handleOpenInEditor = () => {
    if (!previewFile.fullPath) return;
    const target = {
      name: previewFile.name,
      fullPath: previewFile.fullPath,
      url: previewFile.url,
    };
    closeModal();
    openEditorModal(target);
  };

  const togglePlay = () => {
    const media = videoRef.current || audioRef.current;
    if (media) {
      if (isPlaying) media.pause();
      else media.play();
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    const media = videoRef.current || audioRef.current;
    if (media) {
      media.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    const media = videoRef.current || audioRef.current;
    if (media) {
      media.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  };

  const skipTime = (seconds: number) => {
    const media = videoRef.current || audioRef.current;
    if (media) {
      media.currentTime = Math.min(Math.max(0, media.currentTime + seconds), duration || media.duration || 0);
    }
  };

  const handleSeekClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const media = videoRef.current || audioRef.current;
    if (!media || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(Math.max(0, (e.clientX - rect.left) / rect.width), 1);
    media.currentTime = ratio * duration;
    setCurrentTime(media.currentTime);
  };

  const formatTime = (time: number) => {
    if (!isFinite(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const canQuickEdit =
    Boolean(previewFile.fullPath) &&
    ['markdown', 'code', 'csv'].includes(previewFile.type);

  const renderPreviewContent = () => {
    switch (previewFile.type) {
      case 'pdf':
        return (
          <div className="w-full h-full min-h-[70vh] bg-gray-100 dark:bg-zinc-900">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-zinc-700">
              <div className="flex items-center space-x-2">
                <FaFilePdf className="w-4 h-4 text-red-500" />
                <span className="text-xs font-medium">Trình đọc PDF</span>
              </div>
              <button
                onClick={() => window.open(previewFile.url, '_blank')}
                className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Mở trong tab mới
              </button>
            </div>
            <iframe
              src={`${previewFile.url}#toolbar=1&navpanes=1&scrollbar=1&view=FitH`}
              className="w-full h-full border-0"
              title={`PDF Preview: ${previewFile.name}`}
              style={{ minHeight: isFullscreen ? 'calc(100vh - 7rem)' : '65vh' }}
            />
          </div>
        );

      case 'video':
        return (
          <div className="w-full p-4">
            <video
              ref={videoRef}
              className="w-full h-auto max-h-[62vh] rounded-lg bg-black mx-auto"
              onClick={togglePlay}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            >
              <source src={previewFile.url} />
              Trình duyệt của bạn không hỗ trợ video HTML5.
            </video>

            <div className="mt-3 p-3.5 bg-gray-100 dark:bg-zinc-900 rounded-xl">
              {/* Thanh tua nhanh có thể click bất kỳ vị trí nào */}
              <div
                onClick={handleSeekClick}
                className="w-full bg-gray-300 dark:bg-zinc-700 rounded-full h-2.5 cursor-pointer mb-3 group relative"
                title="Nhấp để tua nhanh"
              >
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-75"
                  style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <button onClick={() => skipTime(-10)} className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-zinc-700" title="Lùi 10s">
                    <FaBackward className="w-4 h-4" />
                  </button>
                  <button onClick={togglePlay} className="p-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-700">
                    {isPlaying ? <FaPause className="w-4 h-4" /> : <FaPlay className="w-4 h-4" />}
                  </button>
                  <button onClick={() => skipTime(10)} className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-zinc-700" title="Tiến 10s">
                    <FaForward className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-mono ml-2">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <button onClick={toggleMute} className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-zinc-700">
                    {isMuted ? <FaVolumeOff className="w-4 h-4" /> : <FaVolumeUp className="w-4 h-4" />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="w-20"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 'audio':
        return (
          <div className="w-full p-6 flex flex-col items-center justify-center">
            <FaVolumeUp className="w-14 h-14 text-emerald-500 mb-4" />
            <h3 className="text-base font-semibold mb-4 text-gray-800 dark:text-gray-200">{previewFile.name}</h3>
            <audio
              ref={audioRef}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            >
              <source src={previewFile.url} />
            </audio>

            <div className="w-full max-w-md p-4 bg-gray-100 dark:bg-zinc-900 rounded-xl">
              <div
                onClick={handleSeekClick}
                className="w-full bg-gray-300 dark:bg-zinc-700 rounded-full h-2.5 cursor-pointer mb-3"
                title="Nhấp để tua nhanh"
              >
                <div
                  className="bg-emerald-500 h-2.5 rounded-full transition-all duration-75"
                  style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs font-mono mb-3">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>

              <div className="flex items-center justify-center space-x-4">
                <button onClick={() => skipTime(-10)} className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-zinc-700">
                  <FaBackward className="w-4 h-4" />
                </button>
                <button onClick={togglePlay} className="p-3 bg-emerald-600 text-white rounded-full hover:bg-emerald-700">
                  {isPlaying ? <FaPause className="w-5 h-5" /> : <FaPlay className="w-5 h-5" />}
                </button>
                <button onClick={() => skipTime(10)} className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-zinc-700">
                  <FaForward className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        );

      case 'markdown':
        return (
          <div className="w-full h-full max-h-[72vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-2 bg-gray-50 dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700">
              <span className="text-xs text-gray-500">Tài liệu Văn bản / Markdown</span>
              <button
                onClick={() => setRawMarkdownView(!rawMarkdownView)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                {rawMarkdownView ? 'Chuyển sang Xem định dạng đẹp' : 'Xem văn bản gốc (Raw)'}
              </button>
            </div>
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-500" />
                <span className="ml-3 text-sm">Đang tải nội dung...</span>
              </div>
            ) : rawMarkdownView || previewFile.name.toLowerCase().endsWith('.txt') ? (
              <pre className="whitespace-pre-wrap font-mono text-sm p-6 text-gray-800 dark:text-gray-200">{textContent}</pre>
            ) : (
              <div className="p-6 max-w-4xl mx-auto">
                <SimpleMarkdownView content={textContent} />
              </div>
            )}
          </div>
        );

      case 'csv': {
        const headers = csvRows[0] || [];
        const bodyRows = csvRows.slice(1).filter((r) =>
          !csvSearch.trim() || r.some((cell) => cell.toLowerCase().includes(csvSearch.toLowerCase()))
        );
        return (
          <div className="w-full h-full max-h-[72vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700">
              <span className="text-xs font-medium flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <FaTable />
                Bảng dữ liệu ({bodyRows.length} dòng)
              </span>
              <input
                type="text"
                value={csvSearch}
                onChange={(e) => setCsvSearch(e.target.value)}
                placeholder="Lọc nhanh trong bảng..."
                className="px-2.5 py-1 text-xs border border-gray-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800"
              />
            </div>
            {isLoading ? (
              <div className="py-16 text-center text-sm">Đang tải bảng dữ liệu...</div>
            ) : (
              <div className="overflow-auto flex-1">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700 text-xs">
                  <thead className="bg-gray-100 dark:bg-zinc-800 sticky top-0">
                    <tr>
                      {headers.map((h, i) => (
                        <th key={i} className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-200 border-r border-gray-200 dark:border-zinc-700 last:border-r-0">
                          {h || `Cột ${i + 1}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                    {bodyRows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-blue-50/40 dark:hover:bg-zinc-700/40">
                        {headers.map((_, cIdx) => (
                          <td key={cIdx} className="px-3 py-1.5 whitespace-nowrap text-gray-700 dark:text-gray-300 border-r border-gray-100 dark:border-zinc-800 last:border-r-0">
                            {row[cIdx] ?? ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      }

      case 'code':
        return (
          <div className="w-full h-full max-h-[72vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700">
              <div className="flex items-center space-x-2">
                <FaFileCode className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-medium">Xem trước Mã nguồn</span>
              </div>
              <span className="text-xs text-gray-400">{textContent.split('\n').length} dòng</span>
            </div>
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-500" />
                <span className="ml-3 text-sm">Đang tải mã nguồn...</span>
              </div>
            ) : (
              <div className="p-4">
                <pre className="bg-zinc-950 text-zinc-100 p-4 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed">
                  <code>{textContent}</code>
                </pre>
              </div>
            )}
          </div>
        );

      case 'image':
        return (
          <div className="flex justify-center items-center p-4 max-h-[75vh]">
            <img src={previewFile.url} alt={previewFile.name} className="max-w-full max-h-full object-contain rounded-lg" />
          </div>
        );

      case '3d':
        return (
          <div className="flex flex-col items-center justify-center py-16">
            <FaCube className="w-14 h-14 text-purple-500 mb-4" />
            <h3 className="text-base font-medium mb-2">{previewFile.name}</h3>
            <p className="text-sm text-gray-500 mb-4">Tệp mô hình 3D — Tải về để mở bằng phần mềm chuyên dụng</p>
            <button onClick={handleDownload} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm">
              Tải xuống tệp 3D
            </button>
          </div>
        );

      default:
        return (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Định dạng này chưa hỗ trợ xem trực tiếp trên trình duyệt.</p>
            <button onClick={handleDownload} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm inline-flex items-center gap-2">
              <FaDownload />
              <span>Tải xuống máy</span>
            </button>
          </div>
        );
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={closeModal}>
        <div className="fixed inset-0 bg-black/75" />

        <div className="fixed inset-0 overflow-y-auto">
          <div className={`flex min-h-full items-center justify-center ${isFullscreen ? 'p-0' : 'p-4'}`}>
            <Dialog.Panel
              className={`relative w-full transform overflow-hidden bg-white dark:bg-zinc-800 text-left shadow-xl transition-all ${
                isFullscreen ? 'h-screen max-w-none rounded-none' : 'max-w-5xl rounded-2xl'
              }`}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-zinc-700">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {previewFile.name}
                  </h3>
                  <span className="px-2 py-0.5 text-[11px] bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded-full font-medium">
                    {previewFile.type.toUpperCase()}
                  </span>
                </div>

                <div className="flex items-center space-x-1.5">
                  {canQuickEdit && (
                    <button
                      onClick={handleOpenInEditor}
                      className="px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-md inline-flex items-center gap-1.5 mr-1"
                    >
                      <FaEdit className="w-3.5 h-3.5" />
                      <span>Chỉnh sửa</span>
                    </button>
                  )}
                  <button
                    onClick={handleDownload}
                    className="p-2 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg"
                    title="Tải xuống"
                  >
                    <FaDownload className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="p-2 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg"
                    title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
                  >
                    {isFullscreen ? <FaCompress className="w-4 h-4" /> : <FaExpand className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={closeModal}
                    className="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg"
                    title="Đóng"
                  >
                    <FaTimes className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className={`${isFullscreen ? 'h-[calc(100vh-3.5rem)]' : 'max-h-[82vh]'} overflow-hidden`}>
                {renderPreviewContent()}
              </div>
            </Dialog.Panel>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default PreviewModal;
