// components/CreateFileModal.tsx
'use client';

import React, { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { FaFileAlt, FaTimes, FaSpinner } from 'react-icons/fa';
import { useAppStore } from '../store/useAppStore';
import { uploadRawContentToR2 } from '@/lib/storageClient';

interface CreateFileModalProps {
  currentPath: string;
  onFileCreated: () => void;
}

const TEMPLATES: Array<{ label: string; ext: string; mime: string; sample: string }> = [
  { label: 'Văn bản (.txt)', ext: 'txt', mime: 'text/plain; charset=utf-8', sample: '' },
  { label: 'Tài liệu Markdown (.md)', ext: 'md', mime: 'text/markdown; charset=utf-8', sample: '# Tiêu đề tài liệu\n\n- Mục 1\n- Mục 2\n' },
  { label: 'Bảng dữ liệu (.csv)', ext: 'csv', mime: 'text/csv; charset=utf-8', sample: 'STT,Họ tên,Ghi chú\n1,Nguyễn Văn A,Mẫu dữ liệu\n' },
  { label: 'Dữ liệu JSON (.json)', ext: 'json', mime: 'application/json; charset=utf-8', sample: '{\n  "name": "drive-mini"\n}\n' },
  { label: 'Trang Web (.html)', ext: 'html', mime: 'text/html; charset=utf-8', sample: '<!DOCTYPE html>\n<html lang="vi">\n<head>\n  <meta charset="UTF-8" />\n  <title>Tài liệu</title>\n</head>\n<body>\n  <h1>Xin chào!</h1>\n</body>\n</html>\n' },
];

const CreateFileModal: React.FC<CreateFileModalProps> = ({ currentPath, onFileCreated }) => {
  const isOpen = useAppStore((state) => state.isCreateFileModalOpen);
  const closeModal = useAppStore((state) => state.closeCreateFileModal);
  const openEditorModal = useAppStore((state) => state.openEditorModal);
  const markUploadedKeys = useAppStore((state) => state.markUploadedKeys);

  const [baseName, setBaseName] = useState('');
  const [selectedExt, setSelectedExt] = useState('md');
  const [content, setContent] = useState(TEMPLATES[1].sample);
  const [openInMonacoAfter, setOpenInMonacoAfter] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTemplateChange = (ext: string) => {
    setSelectedExt(ext);
    const tpl = TEMPLATES.find((t) => t.ext === ext);
    if (tpl && (!content.trim() || TEMPLATES.some((t) => t.sample === content))) {
      setContent(tpl.sample);
    }
  };

  const resetAndClose = () => {
    setBaseName('');
    setError(null);
    setIsSaving(false);
    closeModal();
  };

  const handleCreate = async () => {
    const trimmed = baseName.trim();
    if (!trimmed) {
      setError('Vui lòng nhập tên tệp.');
      return;
    }
    if (/[\\/:\*\?"<>\|]/.test(trimmed)) {
      setError('Tên tệp không được chứa ký tự đặc biệt \\ / : * ? " < > |');
      return;
    }

    const finalFileName = trimmed.includes('.') ? trimmed : `${trimmed}.${selectedExt}`;
    const tpl = TEMPLATES.find((t) => finalFileName.toLowerCase().endsWith(`.${t.ext}`));
    const mime = tpl?.mime || 'text/plain; charset=utf-8';
    const targetPath = `uploads/${currentPath}${finalFileName}`;

    setIsSaving(true);
    setError(null);

    try {
      const result = await uploadRawContentToR2(content, targetPath, mime, 'rename');
      if (result.key) {
        markUploadedKeys([result.key]);
      }
      onFileCreated();
      resetAndClose();

      if (openInMonacoAfter && result.url) {
        openEditorModal({
          name: result.key.split('/').pop() || finalFileName,
          fullPath: result.key,
          url: result.url,
        });
      }
    } catch (err: any) {
      setError(err.message || 'Không thể tạo tệp mới.');
      setIsSaving(false);
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={resetAndClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-xl transform overflow-hidden rounded-2xl bg-white dark:bg-zinc-800 p-6 shadow-xl transition-all">
                <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <FaFileAlt className="text-blue-500" />
                    Tạo tệp mới trực tiếp
                  </span>
                  <button onClick={resetAndClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                    <FaTimes />
                  </button>
                </Dialog.Title>

                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Tên tệp
                      </label>
                      <input
                        type="text"
                        value={baseName}
                        onChange={(e) => {
                          setBaseName(e.target.value);
                          if (error) setError(null);
                        }}
                        placeholder="Ví dụ: ghi-chu-hop, danh-sach..."
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-700 dark:text-white"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Định dạng mẫu
                      </label>
                      <select
                        value={selectedExt}
                        onChange={(e) => handleTemplateChange(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-700 dark:text-white"
                      >
                        {TEMPLATES.map((t) => (
                          <option key={t.ext} value={t.ext}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Nội dung ban đầu
                    </label>
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      rows={7}
                      placeholder="Nhập nội dung tệp..."
                      className="w-full px-3 py-2 text-sm font-mono border border-gray-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-700 dark:text-white"
                    />
                  </div>

                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={openInMonacoAfter}
                      onChange={(e) => setOpenInMonacoAfter(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Mở ngay trong Trình soạn thảo Code chuyên sâu (Monaco) sau khi tạo</span>
                  </label>

                  {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                </div>

                <div className="mt-6 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={resetAndClose}
                    disabled={isSaving}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-zinc-600"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={isSaving || !baseName.trim()}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    {isSaving && <FaSpinner className="animate-spin w-4 h-4" />}
                    <span>{isSaving ? 'Đang lưu...' : 'Tạo tệp'}</span>
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default CreateFileModal;
