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
  planType?: 'paid' | 'free';
  totalObjects?: number;
  freeTierBytes?: number;
  estimatedCostUsd?: number;
  hardCapEnabled?: boolean;
  isLocked?: boolean;
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
 * Upload qua Multipart FormData (Phương án dự phòng / Fallback)
 */
async function uploadViaMultipart(
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
 * Upload một file trực tiếp lên Cloudflare R2 qua Presigned URL (Direct Upload)
 * Giúp vượt qua giới hạn 4.5MB của Serverless/Route Handler, hỗ trợ file lớn và hiển thị chính xác % tiến trình
 */
export async function uploadFileToR2(
  file: File,
  currentPath: string,
  onProgress?: (percent: number) => void
): Promise<{ url: string; key: string }> {
  try {
    // Bước 1: Xin Presigned URL từ server (đồng thời kiểm tra quota 10GB an toàn)
    const presignedRes = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'get_presigned_url',
        fileName: file.name,
        path: currentPath,
        fileSize: file.size,
        contentType: file.type || 'application/octet-stream',
      }),
    });

    // Nếu server từ chối (ví dụ hết dung lượng 10GB miễn phí), ném lỗi ngay
    if (!presignedRes.ok) {
      const errData = await presignedRes.json().catch(() => ({}));
      // Nếu là lỗi 403 do vượt hạn mức dung lượng hoặc lỗi cấu hình, không fallback
      if (presignedRes.status === 403 || errData.error?.includes('KHÓA AN TOÀN')) {
        throw new Error(errData.error || 'Dung lượng đã vượt quá ngưỡng an toàn cho phép');
      }
      // Thử fallback sang multipart nếu server không hỗ trợ presigned url
      console.warn('Không thể tạo Presigned URL, chuyển sang cơ chế Multipart fallback:', errData.error);
      return await uploadViaMultipart(file, currentPath, onProgress);
    }

    const { presignedUrl, key, url: publicUrl } = await presignedRes.json();

    if (!presignedUrl) {
      return await uploadViaMultipart(file, currentPath, onProgress);
    }

    // Bước 2: Tải file trực tiếp từ trình duyệt lên Cloudflare R2 bằng Presigned URL qua XMLHttpRequest
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', presignedUrl);

      // Thiết lập Content-Type tương ứng với loại file
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

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
          resolve();
        } else {
          reject(new Error(`Tải tệp lên Cloudflare R2 thất bại với mã lỗi HTTP ${xhr.status}`));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Lỗi kết nối mạng khi tải trực tiếp lên Cloudflare R2'));
      };

      xhr.send(file);
    });

    // Bước 3: Thông báo server làm mới cache dung lượng storage
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
    // Nếu lỗi là do vượt hạn mức quota, thông báo rõ ràng
    if (err.message && err.message.includes('KHÓA AN TOÀN')) {
      throw err;
    }
    // Nếu là lỗi khác và file nhỏ (< 4MB), có thể thử lại bằng multipart
    if (file.size < 4 * 1024 * 1024) {
      console.warn('Lỗi direct upload, thử lại qua multipart:', err);
      return await uploadViaMultipart(file, currentPath, onProgress);
    }
    throw err;
  }
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
