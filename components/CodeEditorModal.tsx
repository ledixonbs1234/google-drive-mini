// components/CodeEditorModal.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { useAppStore } from '../store/useAppStore';
import { FaSave, FaTimes, FaSpinner } from 'react-icons/fa';
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
    case 'gitignore':
    case 'txt':
    case 'log':
      return 'plaintext';
    default:
      return undefined;
  }
};

const CodeEditorModal: React.FC = () => {
  const isOpen = useAppStore((state) => state.isEditorModalOpen);
  const editingFile = useAppStore((state) => state.editingFile);
  const closeEditor = useAppStore((state) => state.closeEditorModal);
  const currentTheme = useAppStore((state) => state.theme);

  const [fileContent, setFileContent] = useState<string>('');
  const [editedContent, setEditedContent] = useState<string>('');
  const [isLoadingContent, setIsLoadingContent] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<string | undefined>('plaintext');
  const editorRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen && editingFile) {
      setIsLoadingContent(true);
      setError(null);
      setFileContent('');
      setEditedContent('');

      const fetchContent = async () => {
        try {
          const urlToFetch = editingFile.url;
          const response = await fetch(urlToFetch);
          if (!response.ok) {
            throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
          }
          const textContent = await response.text();
          setFileContent(textContent);
          setEditedContent(textContent);
          setLanguage(getLanguageFromFileName(editingFile.name));
        } catch (fetchError: any) {
          console.error("Error fetching file content:", fetchError);
          setError(`Không thể tải nội dung file. Lỗi: ${fetchError.message}`);
        } finally {
          setIsLoadingContent(false);
        }
      };

      fetchContent();
    } else {
      setFileContent('');
      setEditedContent('');
      setError(null);
      setIsLoadingContent(false);
      setLanguage('plaintext');
    }
  }, [isOpen, editingFile]);

  const handleSave = async () => {
    if (!editingFile || isSaving) return;
    setIsSaving(true);
    setError(null);

    try {
      // Lưu trực tiếp lên Cloudflare R2 qua API
      await uploadRawContentToR2(editedContent, editingFile.fullPath, 'text/plain; charset=utf-8');
      setFileContent(editedContent);
      alert('Lưu file thành công lên Cloudflare R2!');
    } catch (saveError: any) {
      console.error("Error saving file:", saveError);
      setError(`Lưu file thất bại. Lỗi: ${saveError.message}`);
      alert(`Lưu file thất bại!\n${saveError.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    setEditedContent(value || '');
  };

  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  const hasUnsavedChanges = fileContent !== editedContent;

  const handleClose = () => {
    if (hasUnsavedChanges) {
      if (window.confirm("Bạn có thay đổi chưa lưu. Bạn có chắc chắn muốn đóng?")) {
        closeEditor();
      }
    } else {
      closeEditor();
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-30" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-75" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-2 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-5xl h-[85vh] transform overflow-hidden rounded-lg bg-white dark:bg-zinc-800 text-left align-middle shadow-xl transition-all flex flex-col">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100 px-4 py-3 border-b border-gray-200 dark:border-zinc-700 flex justify-between items-center flex-shrink-0"
                >
                  <span>Chỉnh sửa: {editingFile?.name ?? 'File'} {hasUnsavedChanges ? '*' : ''}</span>
                  <div className="flex items-center space-x-2">
                    {error && <span className="text-xs text-red-500 truncate" title={error}>{error}</span>}
                    <button
                      onClick={handleSave}
                      disabled={isSaving || isLoadingContent || !hasUnsavedChanges}
                      className={twMerge(
                        "inline-flex items-center justify-center rounded-md border border-transparent px-3 py-1 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",
                        "bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500 dark:focus-visible:ring-offset-zinc-800"
                      )}
                    >
                      {isSaving ? <FaSpinner className="animate-spin mr-1.5" /> : <FaSave className="mr-1.5" />}
                      {isSaving ? 'Đang lưu...' : 'Lưu'}
                    </button>
                    <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 p-1 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400">
                      <FaTimes className="w-5 h-5" />
                    </button>
                  </div>
                </Dialog.Title>

                <div className="flex-grow overflow-hidden relative">
                  {isLoadingContent ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-zinc-800/50">
                      <FaSpinner className="animate-spin h-8 w-8 text-blue-500" />
                      <span className="ml-3 text-gray-700 dark:text-gray-300">Đang tải nội dung...</span>
                    </div>
                  ) : error && !fileContent ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-red-50 dark:bg-red-900/30 p-4">
                      <p className="text-red-600 dark:text-red-300 text-center">{error}</p>
                    </div>
                  ) : (
                    <Editor
                      height="100%"
                      language={language}
                      theme={currentTheme === 'dark' ? 'vs-dark' : 'light'}
                      value={editedContent}
                      onChange={handleEditorChange}
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
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default CodeEditorModal;
