// lib/storageClient.ts
export interface StorageItem {
  name: string;
  fullPath: string;
  isFolder: boolean;
  url?: string;
  size?: number;
  updated?: Date;
  starred?: boolean;
  trashId?: string;
  originalPath?: string;
  deletedAt?: Date;
}

export type BrowseMode = 'browse' | 'recent' | 'starred' | 'trash';

export interface FolderOption {
  name: string;
  relativePath: string;
  fullPath: string;
}

export interface StorageQuotaInfo {
  usedBytes: number;
  totalBytes: number;
  remainingBytes: number;
  percentUsed: number;
  configured?: boolean;
  planType?: 'paid' | 'free';
  totalObjects?: number;
  freeTierBytes?: number;
  estimatedCostUsd?: number;
  hardCapEnabled?: boolean;
  isLocked?: boolean;
}

export interface ShareLinkResult {
  shareUrl: string;
  downloadUrl: string;
  publicUrl: string | null;
  expiresAt: string;
}

/**
 * Lấy danh sách files/folders theo chế độ (browse, recent, starred, trash) hoặc tìm kiếm
 */
export async function listStorageItems(
  currentPath: string = '',
  searchTerm: string = '',
  mode: BrowseMode = 'browse',
  showHidden: boolean = false
): Promise<{ items: StorageItem[]; configured: boolean; error?: string }> {
  const params = new URLSearchParams();
  if (currentPath) params.set('currentPath', currentPath);
  if (searchTerm) params.set('search', searchTerm);
  if (mode !== 'browse') params.set('mode', mode);
  if (showHidden) params.set('showHidden', 'true');

  const res = await fetch(`/api/files?${params.toString()}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error ${res.status}`);
  }

  const data = await res.json();
  const items: StorageItem[] = (data.items || []).map((i: any) => ({
    name: i.name,
    fullPath: i.fullPath,
    isFolder: Boolean(i.isFolder),
    url: i.url,
    size: i.size,
    updated: i.updated ? new Date(i.updated) : undefined,
    starred: Boolean(i.starred),
    trashId: i.trashId,
    originalPath: i.originalPath,
    deletedAt: i.deletedAt ? new Date(i.deletedAt) : undefined,
  }));

  return { items, configured: Boolean(data.configured) };
}

/**
 * Lấy toàn bộ cây thư mục để hiển thị trong hộp thoại Di chuyển / Sao chép
 */
export async function listAllStorageFolders(): Promise<FolderOption[]> {
  const res = await fetch('/api/files?mode=folders');
  if (!res.ok) return [];
  const data = await res.json();
  return data.folders || [];
}

/**
 * Xóa 1 mục (mặc định chuyển vào Thùng rác trừ khi permanent = true)
 */
export async function deleteStorageItem(
  fullPath: string,
  isFolder: boolean = false,
  options?: { permanent?: boolean; trashId?: string }
): Promise<void> {
  const res = await fetch('/api/files', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key: fullPath,
      isFolder,
      permanent: Boolean(options?.permanent),
      trashId: options?.trashId,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Lỗi khi xóa mục này');
  }
}

/**
 * Xóa nhiều mục cùng lúc
 */
export async function deleteMultipleStorageItems(
  items: Array<{ fullPath: string; isFolder: boolean; trashId?: string }>,
  permanent: boolean = false
): Promise<void> {
  const res = await fetch('/api/files', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: items.map((i) => ({ key: i.fullPath, isFolder: i.isFolder, trashId: i.trashId })),
      permanent,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Lỗi khi xóa các mục đã chọn');
  }
}

/**
 * Làm trống toàn bộ Thùng rác
 */
export async function emptyStorageTrash(): Promise<void> {
  const res = await fetch('/api/files', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emptyTrash: true }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Lỗi khi dọn sạch thùng rác');
  }
}

/**
 * Khôi phục các mục từ Thùng rác về vị trí gốc
 */
export async function restoreStorageTrashItems(trashIds: string[]): Promise<void> {
  const res = await fetch('/api/files', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'restore', trashIds }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Lỗi khi khôi phục mục đã xóa');
  }
}

/**
 * Đổi tên file hoặc thư mục trực tiếp trên Cloudflare R2
 */
export async function renameStorageItem(
  sourcePath: string,
  newName: string,
  isFolder: boolean
): Promise<string> {
  const res = await fetch('/api/files', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'rename', sourcePath, newName, isFolder }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Lỗi khi đổi tên');
  }
  return data.newPath;
}

/**
 * Di chuyển hoặc Sao chép nhiều file/thư mục trực tiếp trên Cloudflare R2 (Server-to-Server, không tốn băng thông)
 */
export async function moveOrCopyStorageItems(
  action: 'move' | 'copy',
  items: Array<{ fullPath: string; isFolder: boolean; name: string }>,
  targetFolderPath: string,
  conflictResolution: 'rename' | 'overwrite' = 'rename'
): Promise<{ processed: number; skipped: string[] }> {
  const res = await fetch('/api/files', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, items, targetFolderPath, conflictResolution }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Lỗi khi ${action === 'move' ? 'di chuyển' : 'sao chép'} mục`);
  }
  return { processed: data.processed || 0, skipped: data.skipped || [] };
}

/**
 * Bật / tắt gắn sao (Starred) cho file hoặc thư mục
 */
export async function toggleStarStorageItem(fullPath: string): Promise<boolean> {
  const res = await fetch('/api/files', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'toggle_star', fullPath }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Không thể cập nhật gắn sao');
  }
  return Boolean(data.starred);
}

/**
 * Tạo Link chia sẻ trực tiếp (Presigned URL có thời hạn)
 */
export async function createStorageShareLink(
  key: string,
  expiresInSeconds: number = 86400
): Promise<ShareLinkResult> {
  const res = await fetch('/api/files', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'share', key, expiresInSeconds }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Không thể tạo liên kết chia sẻ');
  }
  return data;
}

/**
 * Tạo thư mục mới trên Cloudflare R2
 */
export async function createStorageFolder(folderPath: string): Promise<void> {
  const res = await fetch('/api/folder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: folderPath }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Lỗi khi tạo thư mục');
  }
}

export interface UploadOptions {
  signal?: AbortSignal;
  relativePath?: string; // Ví dụ "MyFolder/sub/file.txt" khi kéo thả cả thư mục
  conflictMode?: 'overwrite' | 'rename';
}

/**
 * Upload qua Multipart FormData (Phương án dự phòng / Fallback)
 */
async function uploadViaMultipart(
  file: File,
  effectivePath: string,
  onProgress?: (percent: number) => void,
  options?: UploadOptions
): Promise<{ url: string; key: string }> {
  return new Promise((resolve, reject) => {
    if (options?.signal?.aborted) {
      reject(new Error('Đã hủy tải lên'));
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', effectivePath);
    if (options?.conflictMode) {
      formData.append('conflictMode', options.conflictMode);
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');

    const onAbort = () => {
      xhr.abort();
      reject(new Error('Đã hủy tải lên'));
    };
    options?.signal?.addEventListener('abort', onAbort, { once: true });

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      options?.signal?.removeEventListener('abort', onAbort);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          resolve({ url: res.url, key: res.key });
        } catch {
          resolve({ url: '', key: '' });
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.error || `Upload thất bại: ${xhr.status}`));
        } catch {
          reject(new Error(`Upload thất bại với mã lỗi HTTP ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => {
      options?.signal?.removeEventListener('abort', onAbort);
      reject(new Error('Lỗi kết nối mạng khi tải file lên'));
    };

    xhr.onabort = () => {
      options?.signal?.removeEventListener('abort', onAbort);
      reject(new Error('Đã hủy tải lên'));
    };

    xhr.send(formData);
  });
}

/**
 * Upload một file trực tiếp lên Cloudflare R2 qua Presigned URL (Direct Upload)
 * Hỗ trợ: Hủy giữa chừng (AbortSignal), Upload nguyên cấu trúc thư mục (relativePath), và Xử lý trùng tên
 */
export async function uploadFileToR2(
  file: File,
  currentPath: string,
  onProgress?: (percent: number) => void,
  options?: UploadOptions
): Promise<{ url: string; key: string }> {
  // Tính đường dẫn thư mục đích nếu file nằm trong thư mục con
  let effectivePath = currentPath || '';
  if (effectivePath && !effectivePath.endsWith('/')) effectivePath += '/';

  const rel = (options?.relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (rel && rel.includes('/')) {
    const subDir = rel.slice(0, rel.lastIndexOf('/') + 1);
    effectivePath = `${effectivePath}${subDir}`;
  }

  try {
    if (options?.signal?.aborted) {
      throw new Error('Đã hủy tải lên');
    }

    const presignedRes = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: options?.signal,
      body: JSON.stringify({
        action: 'get_presigned_url',
        fileName: file.name,
        path: effectivePath,
        fileSize: file.size,
        contentType: file.type || 'application/octet-stream',
        conflictMode: options?.conflictMode || 'overwrite',
      }),
    });

    if (!presignedRes.ok) {
      const errData = await presignedRes.json().catch(() => ({}));
      if (presignedRes.status === 403 || errData.error?.includes('KHÓA AN TOÀN')) {
        throw new Error(errData.error || 'Dung lượng đã vượt quá ngưỡng an toàn cho phép');
      }
      return await uploadViaMultipart(file, effectivePath, onProgress, options);
    }

    const { presignedUrl, key, url: publicUrl } = await presignedRes.json();

    if (!presignedUrl) {
      return await uploadViaMultipart(file, effectivePath, onProgress, options);
    }

    await new Promise<void>((resolve, reject) => {
      if (options?.signal?.aborted) {
        reject(new Error('Đã hủy tải lên'));
        return;
      }

      const xhr = new XMLHttpRequest();
      xhr.open('PUT', presignedUrl);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

      const onAbort = () => {
        xhr.abort();
        reject(new Error('Đã hủy tải lên'));
      };
      options?.signal?.addEventListener('abort', onAbort, { once: true });

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        options?.signal?.removeEventListener('abort', onAbort);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Tải tệp lên Cloudflare R2 thất bại với mã lỗi HTTP ${xhr.status}`));
        }
      };

      xhr.onerror = () => {
        options?.signal?.removeEventListener('abort', onAbort);
        reject(new Error('Lỗi kết nối mạng khi tải trực tiếp lên Cloudflare R2'));
      };

      xhr.onabort = () => {
        options?.signal?.removeEventListener('abort', onAbort);
        reject(new Error('Đã hủy tải lên'));
      };

      xhr.send(file);
    });

    try {
      await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete_presigned_upload',
          key,
          fileName: file.name,
          fileSize: file.size,
        }),
      });
    } catch (e) {
      console.warn('Lỗi khi làm mới cache dung lượng sau upload:', e);
    }

    return { url: publicUrl || '', key };
  } catch (err: any) {
    if (err?.name === 'AbortError' || err?.message === 'Đã hủy tải lên') {
      throw new Error('Đã hủy tải lên');
    }
    if (err.message && err.message.includes('KHÓA AN TOÀN')) {
      throw err;
    }
    if (file.size < 4 * 1024 * 1024) {
      return await uploadViaMultipart(file, effectivePath, onProgress, options);
    }
    throw err;
  }
}

/**
 * Upload nội dung text thô (Tạo file mới, Monaco Code Editor hoặc Docx HTML)
 */
export async function uploadRawContentToR2(
  content: string,
  fullPath: string,
  contentType: string = 'text/plain; charset=utf-8',
  conflictMode: 'overwrite' | 'rename' = 'overwrite'
): Promise<{ key: string; url: string }> {
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content,
      path: fullPath,
      contentType,
      conflictMode,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Lỗi lưu nội dung file');
  }
  return { key: data.key, url: data.url };
}

/**
 * Lấy hạn mức Quota Cloudflare R2 (10 GB)
 */
export async function fetchR2StorageQuota(): Promise<StorageQuotaInfo> {
  const res = await fetch('/api/quota');
  if (!res.ok) {
    throw new Error('Lỗi khi lấy thông tin dung lượng storage');
  }
  return await res.json();
}
