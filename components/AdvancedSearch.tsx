// components/AdvancedSearch.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  FaSearch,
  FaTimes,
  FaFilter,
  FaHistory,
  FaImage,
  FaVideo,
  FaMusic,
  FaFilePdf,
  FaFileCode,
  FaFile,
  FaFolder,
  FaTrashAlt,
} from 'react-icons/fa';
import { StorageItem, listStorageItems } from '@/lib/storageClient';

export interface SearchResult extends StorageItem {
  type?: 'image' | 'video' | 'audio' | 'pdf' | 'markdown' | 'csv' | 'code' | 'document' | 'other';
  score?: number;
}

interface SearchFilter {
  type: 'all' | 'image' | 'video' | 'audio' | 'document' | 'code' | 'folders';
  dateRange: 'all' | 'today' | 'week' | 'month' | 'year';
  sizeRange: 'all' | 'small' | 'medium' | 'large';
  sortBy: 'name' | 'date' | 'size' | 'relevance';
  sortOrder: 'asc' | 'desc';
}

interface AdvancedSearchProps {
  onResultSelect?: (result: SearchResult) => void;
  onNavigate?: (path: string) => void;
  className?: string;
}

const AdvancedSearch: React.FC<AdvancedSearchProps> = ({
  onResultSelect,
  onNavigate,
  className = '',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  const [filters, setFilters] = useState<SearchFilter>({
    type: 'all',
    dateRange: 'all',
    sizeRange: 'all',
    sortBy: 'relevance',
    sortOrder: 'desc',
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('searchHistory');
      if (savedHistory) {
        setSearchHistory(JSON.parse(savedHistory));
      }
    } catch {
      // Ignore invalid JSON
    }
  }, []);

  // Đóng dropdown khi click ra ngoài hoặc bấm phím Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
        setShowFilters(false);
        setShowHistory(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsExpanded(false);
        setShowFilters(false);
        setShowHistory(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  const saveSearchHistory = useCallback(
    (term: string) => {
      const clean = term.trim();
      if (!clean) return;
      const newHistory = [clean, ...searchHistory.filter((h) => h !== clean)].slice(0, 10);
      setSearchHistory(newHistory);
      localStorage.setItem('searchHistory', JSON.stringify(newHistory));
    },
    [searchHistory]
  );

  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('searchHistory');
  };

  const detectCategory = (fileName: string): SearchResult['type'] => {
    const ext = fileName.toLowerCase().split('.').pop() || '';
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'tiff'].includes(ext)) return 'image';
    if (['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'flv', '3gp'].includes(ext)) return 'video';
    if (['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'wma'].includes(ext)) return 'audio';
    if (ext === 'pdf') return 'pdf';
    if (['md', 'markdown', 'txt'].includes(ext)) return 'markdown';
    if (['csv', 'tsv'].includes(ext)) return 'csv';
    if (['doc', 'docx', 'rtf', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) return 'document';
    if (['js', 'ts', 'jsx', 'tsx', 'css', 'html', 'json', 'xml', 'yaml', 'yml', 'py', 'java', 'go', 'sql', 'sh'].includes(ext)) return 'code';
    return 'other';
  };

  const getFileIcon = (fileName: string, isFolder: boolean) => {
    if (isFolder) return <FaFolder className="w-4 h-4 text-amber-500 flex-shrink-0" />;
    const type = detectCategory(fileName);
    switch (type) {
      case 'image':
        return <FaImage className="w-4 h-4 text-sky-500 flex-shrink-0" />;
      case 'video':
        return <FaVideo className="w-4 h-4 text-rose-500 flex-shrink-0" />;
      case 'audio':
        return <FaMusic className="w-4 h-4 text-emerald-500 flex-shrink-0" />;
      case 'pdf':
      case 'document':
      case 'markdown':
      case 'csv':
        return <FaFilePdf className="w-4 h-4 text-red-500 flex-shrink-0" />;
      case 'code':
        return <FaFileCode className="w-4 h-4 text-indigo-500 flex-shrink-0" />;
      default:
        return <FaFile className="w-4 h-4 text-gray-500 flex-shrink-0" />;
    }
  };

  const matchesFilter = useCallback(
    (item: SearchResult): boolean => {
      if (filters.type !== 'all') {
        if (filters.type === 'folders') {
          if (!item.isFolder) return false;
        } else {
          if (item.isFolder) return false;
          const cat = item.type;
          if (filters.type === 'document') {
            if (!['pdf', 'document', 'markdown', 'csv'].includes(cat || '')) return false;
          } else if (cat !== filters.type) {
            return false;
          }
        }
      }

      if (filters.dateRange !== 'all' && item.updated) {
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        const timeDiff = now - item.updated.getTime();
        switch (filters.dateRange) {
          case 'today':
            if (timeDiff > dayMs) return false;
            break;
          case 'week':
            if (timeDiff > 7 * dayMs) return false;
            break;
          case 'month':
            if (timeDiff > 30 * dayMs) return false;
            break;
          case 'year':
            if (timeDiff > 365 * dayMs) return false;
            break;
        }
      }

      if (filters.sizeRange !== 'all' && item.size !== undefined) {
        const sizeMB = item.size / (1024 * 1024);
        switch (filters.sizeRange) {
          case 'small':
            if (sizeMB > 10) return false;
            break;
          case 'medium':
            if (sizeMB <= 10 || sizeMB > 100) return false;
            break;
          case 'large':
            if (sizeMB <= 100) return false;
            break;
        }
      }

      return true;
    },
    [filters]
  );

  const calculateRelevanceScore = (text: string, term: string): number => {
    const lowerText = text.toLowerCase();
    const lowerTerm = term.toLowerCase();
    if (lowerText === lowerTerm) return 100;
    if (lowerText.startsWith(lowerTerm)) return 80;
    if (lowerText.includes(lowerTerm)) return 60;
    const words = lowerTerm.split(/\s+/);
    let score = 0;
    words.forEach((word) => {
      if (word && lowerText.includes(word)) score += 20;
    });
    return score;
  };

  const searchFiles = useCallback(
    async (term: string) => {
      if (!term.trim()) {
        setResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const res = await listStorageItems('', term);
        const enrichedResults: SearchResult[] = res.items.map((item) => ({
          ...item,
          type: detectCategory(item.name),
          score: calculateRelevanceScore(item.name, term),
        }));

        const filteredResults = enrichedResults.filter(matchesFilter).sort((a, b) => {
          switch (filters.sortBy) {
            case 'name':
              return filters.sortOrder === 'asc'
                ? a.name.localeCompare(b.name)
                : b.name.localeCompare(a.name);
            case 'date': {
              const tA = a.updated?.getTime() || 0;
              const tB = b.updated?.getTime() || 0;
              return filters.sortOrder === 'asc' ? tA - tB : tB - tA;
            }
            case 'size':
              return filters.sortOrder === 'asc'
                ? (a.size || 0) - (b.size || 0)
                : (b.size || 0) - (a.size || 0);
            case 'relevance':
            default:
              return (b.score || 0) - (a.score || 0);
          }
        });

        setResults(filteredResults);
      } catch (error) {
        console.error('Search error Cloudflare R2:', error);
      } finally {
        setIsSearching(false);
      }
    },
    [filters, matchesFilter]
  );

  // Tự chạy lại lọc khi đổi bộ lọc mà đang có từ khóa
  useEffect(() => {
    if (searchTerm.trim()) {
      searchFiles(searchTerm);
    }
  }, [filters, searchFiles]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    setIsExpanded(true);
    setShowHistory(false);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      if (value.trim()) {
        searchFiles(value);
        saveSearchHistory(value);
      } else {
        setResults([]);
      }
    }, 280);
  };

  const handleHistorySearch = (term: string) => {
    setSearchTerm(term);
    setShowHistory(false);
    setIsExpanded(true);
    searchFiles(term);
  };

  const handleResultClick = (result: SearchResult) => {
    setIsExpanded(false);
    setShowFilters(false);
    setShowHistory(false);
    if (result.isFolder && onNavigate) {
      const folderPath = result.fullPath.replace(/^uploads\//, '');
      onNavigate(folderPath);
    } else if (onResultSelect) {
      onResultSelect(result);
    }
  };

  const clearSearch = () => {
    setSearchTerm('');
    setResults([]);
    setIsExpanded(false);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const activeFilterCount =
    (filters.type !== 'all' ? 1 : 0) +
    (filters.dateRange !== 'all' ? 1 : 0) +
    (filters.sizeRange !== 'all' ? 1 : 0);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <FaSearch className="h-3.5 w-3.5 text-gray-400" />
        </div>
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Tìm kiếm toàn bộ kho lưu trữ..."
          value={searchTerm}
          onChange={handleSearchChange}
          onFocus={() => setIsExpanded(true)}
          className="w-full pl-9 pr-20 py-1.5 text-sm border border-gray-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 dark:bg-zinc-800 dark:text-white"
        />

        <div className="absolute inset-y-0 right-0 flex items-center space-x-1 pr-2">
          <button
            type="button"
            onClick={() => {
              setShowHistory(!showHistory);
              setShowFilters(false);
            }}
            className={`p-1 rounded ${
              showHistory ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/30' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
            title="Lịch sử tìm kiếm"
          >
            <FaHistory className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setShowFilters(!showFilters);
              setShowHistory(false);
            }}
            className={`relative p-1 rounded ${
              showFilters || activeFilterCount > 0
                ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/30'
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
            title="Bộ lọc nâng cao"
          >
            <FaFilter className="w-3.5 h-3.5" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 text-[9px] bg-blue-600 text-white rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
          {searchTerm && (
            <button
              type="button"
              onClick={clearSearch}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title="Xóa tìm kiếm"
            >
              <FaTimes className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {showHistory && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-800 rounded-xl shadow-xl border border-gray-200 dark:border-zinc-700 z-30">
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Lịch sử tìm kiếm</h3>
              {searchHistory.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="text-xs text-red-500 hover:text-red-600 inline-flex items-center gap-1"
                >
                  <FaTrashAlt className="w-2.5 h-2.5" />
                  Xóa
                </button>
              )}
            </div>
            {searchHistory.length > 0 ? (
              <div className="space-y-1">
                {searchHistory.map((term, index) => (
                  <button
                    key={index}
                    onClick={() => handleHistorySearch(term)}
                    className="w-full text-left px-2.5 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-md"
                  >
                    {term}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400 py-2">Chưa có lịch sử tìm kiếm</p>
            )}
          </div>
        </div>
      )}

      {showFilters && (
        <div className="absolute top-full right-0 w-72 sm:w-80 mt-2 bg-white dark:bg-zinc-800 rounded-xl shadow-xl border border-gray-200 dark:border-zinc-700 z-30">
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Bộ lọc tìm kiếm</h3>
              <button
                type="button"
                onClick={() =>
                  setFilters({
                    type: 'all',
                    dateRange: 'all',
                    sizeRange: 'all',
                    sortBy: 'relevance',
                    sortOrder: 'desc',
                  })
                }
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Đặt lại
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Loại mục</label>
              <select
                value={filters.type}
                onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value as SearchFilter['type'] }))}
                className="w-full text-sm border border-gray-300 dark:border-zinc-600 rounded-md px-2.5 py-1.5 dark:bg-zinc-700 dark:text-white"
              >
                <option value="all">Tất cả định dạng</option>
                <option value="folders">Thư mục</option>
                <option value="image">Hình ảnh</option>
                <option value="video">Video</option>
                <option value="audio">Âm thanh</option>
                <option value="document">Tài liệu (PDF, Word, Excel, MD, CSV)</option>
                <option value="code">Mã nguồn (Code)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Thời gian</label>
                <select
                  value={filters.dateRange}
                  onChange={(e) => setFilters((prev) => ({ ...prev, dateRange: e.target.value as SearchFilter['dateRange'] }))}
                  className="w-full text-sm border border-gray-300 dark:border-zinc-600 rounded-md px-2 py-1.5 dark:bg-zinc-700 dark:text-white"
                >
                  <option value="all">Mọi lúc</option>
                  <option value="today">Hôm nay</option>
                  <option value="week">7 ngày qua</option>
                  <option value="month">30 ngày qua</option>
                  <option value="year">Năm nay</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Dung lượng</label>
                <select
                  value={filters.sizeRange}
                  onChange={(e) => setFilters((prev) => ({ ...prev, sizeRange: e.target.value as SearchFilter['sizeRange'] }))}
                  className="w-full text-sm border border-gray-300 dark:border-zinc-600 rounded-md px-2 py-1.5 dark:bg-zinc-700 dark:text-white"
                >
                  <option value="all">Tất cả</option>
                  <option value="small">&lt; 10 MB</option>
                  <option value="medium">10 - 100 MB</option>
                  <option value="large">&gt; 100 MB</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Sắp xếp theo</label>
                <select
                  value={filters.sortBy}
                  onChange={(e) => setFilters((prev) => ({ ...prev, sortBy: e.target.value as SearchFilter['sortBy'] }))}
                  className="w-full text-sm border border-gray-300 dark:border-zinc-600 rounded-md px-2 py-1.5 dark:bg-zinc-700 dark:text-white"
                >
                  <option value="relevance">Độ khớp</option>
                  <option value="name">Tên A-Z</option>
                  <option value="date">Ngày sửa</option>
                  <option value="size">Kích thước</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Thứ tự</label>
                <select
                  value={filters.sortOrder}
                  onChange={(e) => setFilters((prev) => ({ ...prev, sortOrder: e.target.value as SearchFilter['sortOrder'] }))}
                  className="w-full text-sm border border-gray-300 dark:border-zinc-600 rounded-md px-2 py-1.5 dark:bg-zinc-700 dark:text-white"
                >
                  <option value="desc">Giảm dần</option>
                  <option value="asc">Tăng dần</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {isExpanded && !showFilters && !showHistory && searchTerm.trim() && (
        <div className="absolute top-full left-0 right-0 sm:w-96 mt-2 bg-white dark:bg-zinc-800 rounded-xl shadow-xl border border-gray-200 dark:border-zinc-700 z-30 max-h-96 overflow-y-auto">
          {isSearching ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" />
              <span className="ml-2 text-sm text-gray-500">Đang tìm trong kho lưu trữ...</span>
            </div>
          ) : results.length > 0 ? (
            <div className="p-2">
              <div className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1">
                Tìm thấy {results.length} kết quả
              </div>
              {results.map((result) => (
                <button
                  key={result.fullPath}
                  onClick={() => handleResultClick(result)}
                  className="w-full flex items-center space-x-3 px-2.5 py-2 text-left hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                >
                  {getFileIcon(result.name, result.isFolder)}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {result.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      /{result.fullPath.replace(/^uploads\//, '')}
                    </div>
                  </div>
                  {!result.isFolder && result.size !== undefined && (
                    <span className="text-xs text-gray-400 whitespace-nowrap">{formatFileSize(result.size)}</span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              Không tìm thấy mục nào khớp bộ lọc
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdvancedSearch;
