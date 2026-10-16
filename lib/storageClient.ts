// lib/storageClient.ts
export interface StorageItem {
  name: string;
  fullPath: string;
  isFolder: boolean;
  url?: string;
  size?: number;
  updated?: Date;
}

export interface StorageQuotaInfo {
  usedBytes: number;
  totalBytes: number;
  remainingBytes: number;
  percentUsed: number;
  configured?: boolean;
}

/**
 * Lấy danh sách files và folders hoặc tìm kiếm
 */
export async function listStorageItems(
  currentPath: string = '',
  searchTerm: string = ''
): Promise<{ items: StorageItem[]; configured: boolean; error?: string }> {
  const params = new URLSearchParams();
  if (currentPath) params.set('currentPath', currentPath);
  if (searchTerm) params.set('search', searchTerm);

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
  }));

  return { items, configured: Boolean(data.configured) };
}

/**
 * Xóa file hoặc thư mục
 */
export async function deleteStorageItem(fullPath: string, isFolder: boolean = false): Promise<void> {
  const res = await fetch('/api/files', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: fullPath, isFolder }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Lỗi khi xóa mục này');
  }
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

/**
 * Upload một file trực tiếp lên Cloudflare R2 qua API Route với hỗ trợ Progress giả lập / XHR
 */
export async function uploadFileToR2(
  file: File,
  currentPath: string,
  onProgress?: (percent: number) => void
): Promise<{ url: string; key: string }> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', currentPath);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
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
      reject(new Error('Lỗi kết nối mạng khi tải file lên'));
    };

    xhr.send(formData);
  });
}

/**
 * Upload nội dung text thô (Monaco Code Editor hoặc Docx HTML)
 */
export async function uploadRawContentToR2(
  content: string,
  fullPath: string,
  contentType: string = 'text/plain; charset=utf-8'
): Promise<void> {
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content,
      path: fullPath,
      contentType,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Lỗi lưu nội dung file');
  }
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
