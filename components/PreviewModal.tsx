// components/PreviewModal.tsx
'use client';

import { Dialog, Transition } from '@headlessui/react';
import { Fragment, useState, useEffect, useRef } from 'react';
import { FaTimes, FaDownload, FaExpand, FaCompress, FaVolumeUp, FaPlay, FaPause, FaForward, FaBackward, FaVolumeOff, FaFilePdf, FaCube, FaFileCode } from 'react-icons/fa';
import { useAppStore } from '../store/useAppStore';

interface PreviewFile {
  name: string;
  url: string;
  type: 'pdf' | 'video' | 'audio' | 'markdown' | 'image' | '3d' | 'code' | 'unknown';
}

// Helper function để xác định loại file
const getFileType = (fileName: string): PreviewFile['type'] => {
  const ext = fileName.toLowerCase().split('.').pop();
  
  if (['pdf'].includes(ext || '')) return 'pdf';
  if (['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'flv', '3gp'].includes(ext || '')) return 'video';
  if (['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'wma'].includes(ext || '')) return 'audio';
  if (['md', 'markdown', 'txt'].includes(ext || '')) return 'markdown';
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'tiff'].includes(ext || '')) return 'image';
  if (['obj', 'stl', 'ply', 'gltf', 'glb', '3ds'].includes(ext || '')) return '3d';
  if (['json', 'xml', 'csv', 'yaml', 'yml', 'toml', 'ini'].includes(ext || '')) return 'code';
  
  return 'unknown';
};

const PreviewModal: React.FC = () => {
  const isOpen = useAppStore((state) => state.isPreviewModalOpen);
  const previewFile = useAppStore((state) => state.previewFile);
  const closeModal = useAppStore((state) => state.closePreviewModal);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [markdownContent, setMarkdownContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Video/Audio player states
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  
  // Refs for media elements
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Reset states khi modal đóng
  useEffect(() => {
    if (!isOpen) {
      setIsFullscreen(false);
      setMarkdownContent('');
      setIsLoading(false);
    }
  }, [isOpen]);

  // Load markdown content
  useEffect(() => {
    if (previewFile?.type === 'markdown' && previewFile.url) {
      setIsLoading(true);
      fetch(previewFile.url)
        .then(res => res.text())
        .then(text => {
          setMarkdownContent(text);
          setIsLoading(false);
        })
        .catch(err => {
          console.error('Error loading markdown:', err);
          setIsLoading(false);
        });
    }
  }, [previewFile]);

  if (!previewFile) return null;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = previewFile.url;
    link.download = previewFile.name;
    link.click();
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Media player controls
  const togglePlay = () => {
    const media = videoRef.current || audioRef.current;
    if (media) {
      if (isPlaying) {
        media.pause();
      } else {
        media.play();
      }
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
      media.currentTime += seconds;
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const renderPreviewContent = () => {
    switch (previewFile.type) {
      case 'pdf':
        return (
          <div className="w-full h-full min-h-[70vh] bg-gray-100 dark:bg-zinc-900 rounded-lg">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-zinc-700">
              <div className="flex items-center space-x-2">
                <FaFilePdf className="w-5 h-5 text-red-500" />
                <span className="text-sm font-medium">PDF Viewer</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => window.open(previewFile.url, '_blank')}
                  className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                >
                  Mở trong tab mới
                </button>
              </div>
            </div>
            <iframe
              src={`${previewFile.url}#toolbar=1&navpanes=1&scrollbar=1&view=FitH`}
              className="w-full h-full border-0"
              title={`PDF Preview: ${previewFile.name}`}
              style={{ minHeight: '60vh' }}
            />
          </div>
        );

      case 'video':
        return (
          <div className="w-full">
            <video
              ref={videoRef}
              className="w-full h-auto max-h-[70vh] rounded-lg bg-black"
              onLoadedMetadata={(e) => {
                setDuration(e.currentTarget.duration);
              }}
              onTimeUpdate={(e) => {
                setCurrentTime(e.currentTarget.currentTime);
              }}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            >
              <source src={previewFile.url} />
              Trình duyệt của bạn không hỗ trợ video HTML5.
            </video>
            
            {/* Custom video controls */}
            <div className="mt-4 p-4 bg-gray-100 dark:bg-zinc-800 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => skipTime(-10)}
                    className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-zinc-700"
                    title="Lùi 10s"
                  >
                    <FaBackward className="w-4 h-4" />
                  </button>
                  <button
                    onClick={togglePlay}
                    className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
                  >
                    {isPlaying ? <FaPause className="w-5 h-5" /> : <FaPlay className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => skipTime(10)}
                    className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-zinc-700"
                    title="Tiến 10s"
                  >
                    <FaForward className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="flex items-center space-x-3">
                  <span className="text-sm">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                  <button
                    onClick={toggleMute}
                    className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-zinc-700"
                  >
                    {isMuted ? <FaVolumeOff className="w-4 h-4" /> : <FaVolumeUp className="w-4 h-4" />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="w-20"
                  />
                </div>
              </div>
              
              {/* Progress bar */}
              <div className="w-full bg-gray-300 dark:bg-zinc-600 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-100"
                  style={{ width: `${(currentTime / duration) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        );

      case 'audio':
        return (
          <div className="w-full">
            <div className="flex flex-col items-center justify-center py-8">
              <div className="mb-6">
                <FaVolumeUp className="w-16 h-16 text-blue-500" />
              </div>
              <h3 className="text-lg font-medium mb-6 text-gray-800 dark:text-gray-200">
                {previewFile.name}
              </h3>
              
              <audio
                ref={audioRef}
                className="w-full max-w-md mb-4"
                onLoadedMetadata={(e) => {
                  setDuration(e.currentTarget.duration);
                }}
                onTimeUpdate={(e) => {
                  setCurrentTime(e.currentTarget.currentTime);
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              >
                <source src={previewFile.url} />
                Trình duyệt của bạn không hỗ trợ audio HTML5.
              </audio>
              
              {/* Custom audio controls */}
              <div className="w-full max-w-md p-4 bg-gray-100 dark:bg-zinc-800 rounded-lg">
                <div className="flex items-center justify-center space-x-4 mb-3">
                  <button
                    onClick={() => skipTime(-10)}
                    className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-zinc-700"
                    title="Lùi 10s"
                  >
                    <FaBackward className="w-4 h-4" />
                  </button>
                  <button
                    onClick={togglePlay}
                    className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
                  >
                    {isPlaying ? <FaPause className="w-5 h-5" /> : <FaPlay className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => skipTime(10)}
                    className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-zinc-700"
                    title="Tiến 10s"
                  >
                    <FaForward className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="flex items-center justify-between mb-3 text-sm">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
                
                {/* Progress bar */}
                <div className="w-full bg-gray-300 dark:bg-zinc-600 rounded-full h-2 mb-3">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-100"
                    style={{ width: `${(currentTime / duration) * 100}%` }}
                  ></div>
                </div>
                
                <div className="flex items-center justify-center space-x-2">
                  <button
                    onClick={toggleMute}
                    className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-zinc-700"
                  >
                    {isMuted ? <FaVolumeOff className="w-4 h-4" /> : <FaVolumeUp className="w-4 h-4" />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="w-20"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 'markdown':
        return (
          <div className="w-full h-full max-h-[70vh] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span className="ml-3">Đang tải...</span>
              </div>
            ) : (
              <div className="prose dark:prose-invert max-w-none p-6">
                <pre className="whitespace-pre-wrap font-sans">{markdownContent}</pre>
              </div>
            )}
          </div>
        );

      case 'image':
        return (
          <div className="flex justify-center items-center max-h-[70vh]">
            <img
              src={previewFile.url}
              alt={previewFile.name}
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </div>
        );

      case '3d':
        return (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="mb-6">
              <FaCube className="w-16 h-16 text-purple-500" />
            </div>
            <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-gray-200">
              3D Model: {previewFile.name}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
              3D model preview sẽ được hỗ trợ trong phiên bản tương lai
            </p>
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
            >
              Tải xuống để xem
            </button>
          </div>
        );

      case 'code':
        return (
          <div className="w-full h-full max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-zinc-700">
              <div className="flex items-center space-x-2">
                <FaFileCode className="w-5 h-5 text-green-500" />
                <span className="text-sm font-medium">Code Preview</span>
              </div>
            </div>
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span className="ml-3">Đang tải...</span>
              </div>
            ) : (
              <div className="p-6">
                <pre className="bg-gray-100 dark:bg-zinc-900 p-4 rounded-lg text-sm overflow-x-auto">
                  <code>{markdownContent}</code>
                </pre>
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 0v12h8V4H6z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              Không thể xem trước file này
            </p>
          </div>
        );
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={closeModal}>
        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-75" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className={`flex min-h-full items-center justify-center p-4 text-center ${
            isFullscreen ? 'p-0' : ''
          }`}>
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className={`relative w-full transform overflow-hidden rounded-lg bg-white dark:bg-zinc-800 text-left align-middle shadow-xl transition-all ${
                isFullscreen ? 'h-screen max-w-none rounded-none' : 'max-w-6xl'
              }`}>
                
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-zinc-700">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 truncate">
                      {previewFile.name}
                    </h3>
                    <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">
                      {previewFile.type.toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {/* Download button */}
                    <button
                      onClick={handleDownload}
                      className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-md transition-colors"
                      title="Tải xuống"
                    >
                      <FaDownload className="w-4 h-4" />
                    </button>
                    
                    {/* Fullscreen toggle */}
                    <button
                      onClick={toggleFullscreen}
                      className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-md transition-colors"
                      title={isFullscreen ? "Thu nhỏ" : "Toàn màn hình"}
                    >
                      {isFullscreen ? <FaCompress className="w-4 h-4" /> : <FaExpand className="w-4 h-4" />}
                    </button>
                    
                    {/* Close button */}
                    <button
                      onClick={closeModal}
                      className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-md transition-colors"
                      title="Đóng"
                    >
                      <FaTimes className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className={`${isFullscreen ? 'h-[calc(100vh-4rem)]' : 'max-h-[80vh]'} overflow-hidden`}>
                  {renderPreviewContent()}
                </div>

              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default PreviewModal;
