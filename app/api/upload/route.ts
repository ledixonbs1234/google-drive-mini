import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  r2Client,
  BUCKET_NAME,
  isR2Configured,
  getFileUrl,
  verifySafetyLimit,
  invalidateStorageUsageCache,
} from '@/lib/cloudflareR2';

export const dynamic = 'force-dynamic';

/**
 * Chuẩn hóa S3 Key cho file upload (hỗ trợ cả relativePath khi kéo-thả nguyên thư mục)
 */
function buildUploadKey(rawPath: string, fileName: string): string {
  let clean = (rawPath || '').replace(/\\/g, '/').replace(/^\//, '');
  if (clean.includes('..')) {
    clean = clean.split('/').filter((s) => s !== '..').join('/');
  }
  if (clean.startsWith('uploads/')) {
    clean = clean.slice('uploads/'.length);
  }
  if (clean && !clean.endsWith('/')) {
    clean += '/';
  }
  const safeFileName = fileName.replace(/\\/g, '/').replace(/^\/+/, '');
  return `uploads/${clean}${safeFileName}`;
}

async function resolveNonConflictingKey(initialKey: string): Promise<string> {
  try {
    await r2Client.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: initialKey }));
  } catch {
    return initialKey; // Chưa tồn tại
  }

  const lastSlash = initialKey.lastIndexOf('/');
  const dir = initialKey.slice(0, lastSlash + 1);
  const name = initialKey.slice(lastSlash + 1);
  const dotIdx = name.lastIndexOf('.');
  const base = dotIdx > 0 ? name.slice(0, dotIdx) : name;
  const ext = dotIdx > 0 ? name.slice(dotIdx) : '';

  for (let i = 1; i < 100; i++) {
    const candidate = `${dir}${base} (${i})${ext}`;
    try {
      await r2Client.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: candidate }));
    } catch {
      return candidate;
    }
  }
  return `${dir}${base} (${Date.now()})${ext}`;
}

export async function POST(request: NextRequest) {
  try {
    if (!isR2Configured) {
      return NextResponse.json(
        { error: 'Cloudflare R2 chưa được cấu hình trong .env.local' },
        { status: 400 }
      );
    }

    const contentType = request.headers.get('content-type') || '';

    // Trường hợp 1: JSON body (dành cho Text/Code upload, Tạo file mới, Docx HTML save, hoặc xin Presigned URL)
    if (contentType.includes('application/json')) {
      const data = await request.json();

      // Nếu client yêu cầu Presigned URL cho client-side direct upload
      if (data.action === 'get_presigned_url') {
        const {
          fileName,
          path = '',
          fileSize = 0,
          contentType: fileContentType,
          conflictMode = 'overwrite', // 'overwrite' | 'rename'
        } = data;

        if (!fileName) {
          return NextResponse.json({ error: 'Thiếu fileName' }, { status: 400 });
        }

        const safetyCheck = await verifySafetyLimit(fileSize);
        if (!safetyCheck.allowed) {
          return NextResponse.json({ error: safetyCheck.message }, { status: 403 });
        }

        let key = buildUploadKey(path, fileName);
        if (conflictMode === 'rename') {
          key = await resolveNonConflictingKey(key);
        }

        const putCommand = new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
          ContentType: fileContentType || 'application/octet-stream',
        });

        const presignedUrl = await getSignedUrl(r2Client, putCommand, { expiresIn: 3600 });

        return NextResponse.json({
          presignedUrl,
          key,
          url: getFileUrl(key),
        });
      }

      // Khi client upload trực tiếp xong qua Presigned URL, gọi action này để làm mới cache dung lượng
      if (data.action === 'complete_presigned_upload') {
        const { key, fileName, fileSize = 0 } = data;
        invalidateStorageUsageCache();
        return NextResponse.json({
          success: true,
          key: key || '',
          url: key ? getFileUrl(key) : '',
          name: fileName,
          size: fileSize,
        });
      }

      // Upload text/raw content trực tiếp từ JSON (Tạo file mới, Monaco Editor hoặc Docx Editor)
      if (data.content !== undefined && data.path) {
        const cleanPath = String(data.path).replace(/\\/g, '/').replace(/^\//, '');
        if (cleanPath.includes('..') || cleanPath.startsWith('_system/')) {
          return NextResponse.json({ error: 'Đường dẫn lưu file không hợp lệ' }, { status: 400 });
        }
        let key = cleanPath.startsWith('uploads/') ? cleanPath : `uploads/${cleanPath}`;
        if (data.conflictMode === 'rename') {
          key = await resolveNonConflictingKey(key);
        }

        const buffer = Buffer.from(data.content, 'utf-8');

        const safetyCheck = await verifySafetyLimit(buffer.length);
        if (!safetyCheck.allowed) {
          return NextResponse.json({ error: safetyCheck.message }, { status: 403 });
        }

        await r2Client.send(
          new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: data.contentType || 'text/plain; charset=utf-8',
          })
        );
        invalidateStorageUsageCache();
        return NextResponse.json({
          success: true,
          key,
          url: getFileUrl(key),
          size: buffer.length,
        });
      }
    }

    // Trường hợp 2: FormData multipart upload (Fallback cho file thông thường)
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const path = (formData.get('path') as string | null) || '';
    const conflictMode = (formData.get('conflictMode') as string | null) || 'overwrite';

    if (!file) {
      return NextResponse.json({ error: 'Không tìm thấy file để upload' }, { status: 400 });
    }

    let key = buildUploadKey(path, file.name);
    if (conflictMode === 'rename') {
      key = await resolveNonConflictingKey(key);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const safetyCheck = await verifySafetyLimit(buffer.length);
    if (!safetyCheck.allowed) {
      return NextResponse.json({ error: safetyCheck.message }, { status: 403 });
    }

    await r2Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: file.type || 'application/octet-stream',
      })
    );

    invalidateStorageUsageCache();

    return NextResponse.json({
      success: true,
      key,
      url: getFileUrl(key),
      name: key.split('/').pop() || file.name,
      size: buffer.length,
    });
  } catch (error: any) {
    console.error('Lỗi upload file lên Cloudflare R2:', error);
    return NextResponse.json(
      { error: error.message || 'Lỗi xử lý upload file' },
      { status: 500 }
    );
  }
}
