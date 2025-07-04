// components/AdvancedSearch.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { FaSearch, FaTimes, FaFilter, FaHistory, FaBookmark, FaImage, FaVideo, FaMusic, FaFilePdf, FaFileCode, FaFile, FaFolder, FaCalendarAlt, FaSort } from 'react-icons/fa';
import { storage } from '../lib/firebase';
import { ref, listAll, getMetadata, getDownloadURL } from 'firebase/storage';

interface SearchResult {
  name: string;
  fullPath: string;
  isFolder: boolean;
  url?: string;
  size?: number;
  updated?: Date;
  type?: string;
  matchType?: 'name' | 'content' | 'metadata';
  score?: number;
}

interface SearchFilter {
  type: 'all' | 'images' | 'videos' | 'audio' | 'documents' | 'code' | 'folders';
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
  className = ''
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [savedSearches, setSavedSearches] = useState<{ term: string; name: string }[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  
  const [filters, setFilters] = useState<SearchFilter>({
    type: 'all',
    dateRange: 'all',
    sizeRange: 'all',
    sortBy: 'relevance',
    sortOrder: 'desc'
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load search history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('searchHistory');
    const savedSearchesList = localStorage.getItem('savedSearches');
    
    if (savedHistory) {
      setSearchHistory(JSON.parse(savedHistory));
    }
    if (savedSearchesList) {
      setSavedSearches(JSON.parse(savedSearchesList));
    }
  }, []);

  // Save search history to localStorage
  const saveSearchHistory = useCallback((term: string) => {
    const newHistory = [term, ...searchHistory.filter(h => h !== term)].slice(0, 10);
    setSearchHistory(newHistory);
    localStorage.setItem('searchHistory', JSON.stringify(newHistory));
  }, [searchHistory]);

  // Save search to bookmarks
  const saveSearch = useCallback((term: string, name: string) => {
    const newSavedSearch = { term, name };
    const newSavedSearches = [...savedSearches, newSavedSearch];
    setSavedSearches(newSavedSearches);
    localStorage.setItem('savedSearches', JSON.stringify(newSavedSearches));
  }, [savedSearches]);

  // Get file type for filtering
  const getFileType = (fileName: string): string => {
    const ext = fileName.toLowerCase().split('.').pop();
    
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'tiff'].includes(ext || '')) return 'image';
    if (['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'flv', '3gp'].includes(ext || '')) return 'video';
    if (['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'wma'].includes(ext || '')) return 'audio';
    if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'md'].includes(ext || '')) return 'document';
    if (['js', 'ts', 'jsx', 'tsx', 'css', 'html', 'json', 'xml', 'yaml', 'yml'].includes(ext || '')) return 'code';
    
    return 'other';
  };

  // Get file icon
  const getFileIcon = (fileName: string, isFolder: boolean) => {
    if (isFolder) return <FaFolder className="w-4 h-4 text-blue-500" />;
    
    const type = getFileType(fileName);
    switch (type) {
      case 'image': return <FaImage className="w-4 h-4 text-blue-500" />;
      case 'video': return <FaVideo className="w-4 h-4 text-red-500" />;
      case 'audio': return <FaMusic className="w-4 h-4 text-green-500" />;
      case 'document': return <FaFilePdf className="w-4 h-4 text-red-600" />;
      case 'code': return <FaFileCode className="w-4 h-4 text-purple-500" />;
      default: return <FaFile className="w-4 h-4 text-gray-500" />;
    }
  };

  // Check if file matches filter
  const matchesFilter = (item: SearchResult): boolean => {
    // Type filter
    if (filters.type !== 'all') {
      if (filters.type === 'folders' && !item.isFolder) return false;
      if (filters.type !== 'folders' && item.isFolder) return false;
      if (!item.isFolder && filters.type !== getFileType(item.name)) return false;
    }

    // Date filter
    if (filters.dateRange !== 'all' && item.updated) {
      const now = new Date();
      const dayMs = 24 * 60 * 60 * 1000;
      const timeDiff = now.getTime() - item.updated.getTime();
      
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

    // Size filter
    if (filters.sizeRange !== 'all' && item.size) {
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
  };

  // Search through Firebase Storage
  const searchFiles = useCallback(async (term: string) => {
    if (!term.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    const allResults: SearchResult[] = [];

    try {
      // Recursive function to search through folders
      const searchInFolder = async (path: string = '') => {
        const storageRef = ref(storage, `uploads/${path}`);
        const listResult = await listAll(storageRef);

        // Search in folders
        for (const folderRef of listResult.prefixes) {
          const folderName = folderRef.name;
          const score = calculateRelevanceScore(folderName, term);
          
          if (score > 0) {
            allResults.push({
              name: folderName,
              fullPath: folderRef.fullPath,
              isFolder: true,
              matchType: 'name',
              score
            });
          }
          
          // Recursively search in subfolders (limit depth to avoid infinite loops)
          if (path.split('/').length < 3) {
            await searchInFolder(path + folderName + '/');
          }
        }

        // Search in files
        for (const fileRef of listResult.items) {
          const fileName = fileRef.name;
          const score = calculateRelevanceScore(fileName, term);
          
          if (score > 0) {
            try {
              const [url, metadata] = await Promise.all([
                getDownloadURL(fileRef),
                getMetadata(fileRef)
              ]);

              allResults.push({
                name: fileName,
                fullPath: fileRef.fullPath,
                isFolder: false,
                url,
                size: metadata.size,
                updated: metadata.updated ? new Date(metadata.updated) : undefined,
                type: getFileType(fileName),
                matchType: 'name',
                score
              });
            } catch (error) {
              console.error('Error getting file metadata:', error);
            }
          }
        }
      };

      await searchInFolder();

      // Filter and sort results
      const filteredResults = allResults
        .filter(matchesFilter)
        .sort((a, b) => {
          switch (filters.sortBy) {
            case 'name':
              return filters.sortOrder === 'asc' 
                ? a.name.localeCompare(b.name)
                : b.name.localeCompare(a.name);
            case 'date':
              if (!a.updated || !b.updated) return 0;
              return filters.sortOrder === 'asc'
                ? a.updated.getTime() - b.updated.getTime()
                : b.updated.getTime() - a.updated.getTime();
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
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  }, [filters]);

  // Calculate relevance score for search term
  const calculateRelevanceScore = (text: string, term: string): number => {
    const lowerText = text.toLowerCase();
    const lowerTerm = term.toLowerCase();
    
    if (lowerText === lowerTerm) return 100;
    if (lowerText.startsWith(lowerTerm)) return 80;
    if (lowerText.includes(lowerTerm)) return 60;
    
    // Fuzzy matching
    const words = lowerTerm.split(' ');
    let score = 0;
    words.forEach(word => {
      if (lowerText.includes(word)) score += 20;
    });
    
    return score;
  };

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    // Debounce search
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
    }, 300);
  };

  // Handle search from history
  const handleHistorySearch = (term: string) => {
    setSearchTerm(term);
    searchFiles(term);
    setShowHistory(false);
  };

  // Handle result click
  const handleResultClick = (result: SearchResult) => {
    if (result.isFolder && onNavigate) {
      // Navigate to folder
      const folderPath = result.fullPath.replace('uploads/', '');
      onNavigate(folderPath);
    } else if (onResultSelect) {
      // Select file
      onResultSelect(result);
    }
  };

  // Clear search
  const clearSearch = () => {
    setSearchTerm('');
    setResults([]);
    setIsExpanded(false);
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Format date
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <FaSearch className="h-4 w-4 text-gray-400" />
        </div>
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Tìm kiếm files và folders..."
          value={searchTerm}
          onChange={handleSearchChange}
          onFocus={() => setIsExpanded(true)}
          className="w-full pl-10 pr-20 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-white"
        />
        
        {/* Action buttons */}
        <div className="absolute inset-y-0 right-0 flex items-center space-x-1 pr-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            title="Lịch sử tìm kiếm"
          >
            <FaHistory className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            title="Bộ lọc"
          >
            <FaFilter className="w-4 h-4" />
          </button>
          {searchTerm && (
            <button
              onClick={clearSearch}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title="Xóa tìm kiếm"
            >
              <FaTimes className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Search History Dropdown */}
      {showHistory && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-gray-200 dark:border-zinc-700 z-10">
          <div className="p-3">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Lịch sử tìm kiếm</h3>
            {searchHistory.length > 0 ? (
              <div className="space-y-1">
                {searchHistory.map((term, index) => (
                  <button
                    key={index}
                    onClick={() => handleHistorySearch(term)}
                    className="w-full text-left px-2 py-1 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded"
                  >
                    {term}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">Chưa có lịch sử tìm kiếm</p>
            )}
          </div>
        </div>
      )}

      {/* Filter Panel */}
      {showFilters && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-gray-200 dark:border-zinc-700 z-10">
          <div className="p-4 space-y-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Bộ lọc</h3>
            
            {/* Type Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Loại file</label>
              <select
                value={filters.type}
                onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value as any }))}
                className="w-full text-sm border border-gray-300 dark:border-zinc-600 rounded px-2 py-1 dark:bg-zinc-700"
              >
                <option value="all">Tất cả</option>
                <option value="folders">Thư mục</option>
                <option value="images">Hình ảnh</option>
                <option value="videos">Video</option>
                <option value="audio">Âm thanh</option>
                <option value="documents">Tài liệu</option>
                <option value="code">Code</option>
              </select>
            </div>

            {/* Date Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Thời gian</label>
              <select
                value={filters.dateRange}
                onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value as any }))}
                className="w-full text-sm border border-gray-300 dark:border-zinc-600 rounded px-2 py-1 dark:bg-zinc-700"
              >
                <option value="all">Tất cả</option>
                <option value="today">Hôm nay</option>
                <option value="week">Tuần này</option>
                <option value="month">Tháng này</option>
                <option value="year">Năm này</option>
              </select>
            </div>

            {/* Size Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Kích thước</label>
              <select
                value={filters.sizeRange}
                onChange={(e) => setFilters(prev => ({ ...prev, sizeRange: e.target.value as any }))}
                className="w-full text-sm border border-gray-300 dark:border-zinc-600 rounded px-2 py-1 dark:bg-zinc-700"
              >
                <option value="all">Tất cả</option>
                <option value="small">Nhỏ (&lt;10MB)</option>
                <option value="medium">Trung bình (10-100MB)</option>
                <option value="large">Lớn (&gt;100MB)</option>
              </select>
            </div>

            {/* Sort Options */}
            <div className="flex space-x-2">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Sắp xếp</label>
                <select
                  value={filters.sortBy}
                  onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value as any }))}
                  className="w-full text-sm border border-gray-300 dark:border-zinc-600 rounded px-2 py-1 dark:bg-zinc-700"
                >
                  <option value="relevance">Độ liên quan</option>
                  <option value="name">Tên</option>
                  <option value="date">Ngày</option>
                  <option value="size">Kích thước</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Thứ tự</label>
                <select
                  value={filters.sortOrder}
                  onChange={(e) => setFilters(prev => ({ ...prev, sortOrder: e.target.value as any }))}
                  className="w-full text-sm border border-gray-300 dark:border-zinc-600 rounded px-2 py-1 dark:bg-zinc-700"
                >
                  <option value="desc">Giảm dần</option>
                  <option value="asc">Tăng dần</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search Results */}
      {isExpanded && (searchTerm || results.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-gray-200 dark:border-zinc-700 z-10 max-h-96 overflow-y-auto">
          {isSearching ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              <span className="ml-2 text-sm text-gray-500">Đang tìm kiếm...</span>
            </div>
          ) : results.length > 0 ? (
            <div className="p-2">
              <div className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1">
                {results.length} kết quả
              </div>
              {results.map((result, index) => (
                <button
                  key={index}
                  onClick={() => handleResultClick(result)}
                  className="w-full flex items-center space-x-3 px-2 py-2 text-left hover:bg-gray-100 dark:hover:bg-zinc-700 rounded"
                >
                  {getFileIcon(result.name, result.isFolder)}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {result.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {result.fullPath.replace('uploads/', '')}
                    </div>
                  </div>
                  {!result.isFolder && (
                    <div className="flex flex-col text-xs text-gray-500 dark:text-gray-400 text-right">
                      {result.size && <span>{formatFileSize(result.size)}</span>}
                      {result.updated && <span>{formatDate(result.updated)}</span>}
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : searchTerm && (
            <div className="flex items-center justify-center py-8">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Không tìm thấy kết quả nào
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdvancedSearch;
