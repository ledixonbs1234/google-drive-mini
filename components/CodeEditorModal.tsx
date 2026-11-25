// components/CodeEditorModal.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { useAppStore } from '../store/useAppStore';
import { FaSave, FaTimes, FaSpinner, FaCheck } from 'react-icons/fa';
import { twMerge } from 'tailwind-merge';
import { uploadRawContentToR2 } from '@/lib/storageClient';

const getLanguageFromFileName = (fileName: string): string | undefined => {
  const extension = fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase();
  switch (extension) {
    case 'js':
    case 'jsx':
    case 'mjs':
      return 'javascript';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'json':
      return 'json';
    case 'css':
      return 'css';
    case 'scss':
    case 'sass':
      return 'scss';
    case 'less':
      return 'less';
    case 'html':
    case 'htm':
      return 'html';
    case 'xml':
      return 'xml';
    case 'php':
      return 'php';
    case 'py':
      return 'python';
    case 'java':
      return 'java';
    case 'cs':
      return 'csharp';
    case 'rb':
      return 'ruby';
    case 'go':
      return 'go';
    case 'rs':
      return 'rust';
    case 'sql':
      return 'sql';
    case 'md':
      return 'markdown';
    case 'sh':
    case 'bash':
      return 'shell';
    case 'yaml':
    case 'yml':
      return 'yaml';
    case 'dockerfile':
      return 'dockerfile';
    default:
      return 'plaintext';
  }
};

const CodeEditorModal: React.FC = () => {
  const isOpen = useAppStore((state) => state.isEditorModalOpen);
  const editingFile = useAppStore((state) => state.editingFile);
  const closeEditor = useAppStore((state) => state.closeEditorModal);
  const currentTheme = useAppStore((state) => state.theme);
  const triggerGlobalRefresh = useAppStore((state) => state.triggerGlobalRefresh);

  const [fileContent, setFileContent] = useState<string>('');
  const [editedContent, setEditedContent] = useState<string>('');
  const [isLoadingContent, setIsLoadingContent] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [savedNotice, setSavedNotice] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<string | undefined>('plaintext');
  const editorRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen && editingFile) {
      setIsLoadingContent(true);
      setError(null);
      setSavedNotice(false);
      setFileContent('');
      setEditedContent('');

      const fetchContent = async () => {
        try {
          const response = await fetch(editingFile.url, { cache: 'no-store' });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          const textContent = await response.text();
          setFileContent(textContent);
          setEditedContent(textContent);
          setLanguage(getLanguageFromFileName(editingFile.name));
        } catch (fetchError: any) {
          setError(`Không thể tải nội dung file. Lỗi: ${fetchError.message}`);
        } finally {
          setIsLoadingContent(false);
        }
      };

      fetchContent();
    }
  }, [isOpen, editingFile]);

  const handleSave = useCallback(async () => {
    if (!editingFile || isSaving) return;
    setIsSaving(true);
    setError(null);

    try {
      await uploadRawContentToR2(editedContent, editingFile.fullPath, 'text/plain; charset=utf-8');
      setFileContent(editedContent);
      setSavedNotice(true);
      triggerGlobalRefresh();
      setTimeout(() => setSavedNotice(false), 2500);
    } catch (saveError: any) {
      setError(`Lưu thất bại: ${saveError.message}`);
    } finally {
      setIsSaving(false);
    }
  }, [editingFile, isSaving, editedContent, triggerGlobalRefresh]);

  // Hỗ trợ phím tắt Ctrl+S lưu nhanh
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, handleSave]);

  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  const hasUnsavedChanges = fileContent !== editedContent;

  const handleClose = () => {
    if (hasUnsavedChanges) {
      if (window.confirm('Bạn có thay đổi chưa lưu. Bạn có chắc chắn muốn đóng?')) {
        closeEditor();
      }
    } else {
      closeEditor();
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <div className="fixed inset-0 bg-black/60" />

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-2 sm:p-4">
            <Dialog.Panel className="w-full max-w-6xl h-[88vh] transform overflow-hidden rounded-xl bg-white dark:bg-zinc-800 text-left shadow-xl flex flex-col">
              <Dialog.Title
                as="div"
                className="px-4 py-3 border-b border-gray-200 dark:border-zinc-700 flex justify-between items-center flex-shrink-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {editingFile?.name ?? 'File'} {hasUnsavedChanges ? '• (Chưa lưu)' : ''}
                  </span>
                  {savedNotice && (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <FaCheck /> Đã lưu lên R2
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {error && <span className="text-xs text-red-500 max-w-xs truncate" title={error}>{error}</span>}
                  <button
                    onClick={handleSave}
                    disabled={isSaving || isLoadingContent || !hasUnsavedChanges}
                    className={twMerge(
                      'inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed',
                      'bg-blue-600 hover:bg-blue-700'
                    )}
                    title="Lưu thay đổi (Ctrl+S)"
                  >
                    {isSaving ? <FaSpinner className="animate-spin mr-1.5" /> : <FaSave className="mr-1.5" />}
                    {isSaving ? 'Đang lưu...' : 'Lưu (Ctrl+S)'}
                  </button>
                  <button
                    onClick={handleClose}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-lg"
                  >
                    <FaTimes className="w-5 h-5" />
                  </button>
                </div>
              </Dialog.Title>

              <div className="flex-grow overflow-hidden relative">
                {isLoadingContent ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <FaSpinner className="animate-spin h-7 w-7 text-blue-500" />
                    <span className="ml-3 text-sm text-gray-700 dark:text-gray-300">Đang tải nội dung...</span>
                  </div>
                ) : (
                  <Editor
                    height="100%"
                    language={language}
                    theme={currentTheme === 'dark' ? 'vs-dark' : 'light'}
                    value={editedContent}
                    onChange={(val) => setEditedContent(val || '')}
                    onMount={handleEditorDidMount}
                    options={{
                      minimap: { enabled: true },
                      wordWrap: 'on',
                      fontSize: 14,
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                    }}
                  />
                )}
              </div>
            </Dialog.Panel>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default CodeEditorModal;
