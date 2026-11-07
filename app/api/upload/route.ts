import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  r2Client,
  BUCKET_NAME,
  isR2Configured,
  getFileUrl,
  HARD_CAP_ENABLED,
  R2_SAFETY_LIMIT_BYTES,
  getUsedStorageBytes,
  invalidateStorageUsageCache,
} from '@/lib/cloudflareR2';

export const dynamic = 'force-dynamic';

/**
 * Chuẩn hóa S3 Key cho file upload
 */
function buildUploadKey(rawPath: string, fileName: string): string {
  let clean = (rawPath || '').replace(/^\//, '');
  if (clean.startsWith('uploads/')) {
    clean = clean.slice('uploads/'.length);
  }
  if (clean && !clean.endsWith('/')) {
    clean += '/';
  }
  return `uploads/${clean}${fileName}`;
}

/**
 * Kiểm tra xem upload mới có vượt quá 10 GB miễn phí hay không
 */
async function verifySafetyLimit(additionalBytes: number): Promise<{ allowed: boolean; message?: string }> {
  if (!HARD_CAP_ENABLED) return { allowed: true };

  const { usedBytes } = await getUsedStorageBytes();
  if (usedBytes + additionalBytes > R2_SAFETY_LIMIT_BYTES) {
    const usedGb = (usedBytes / (1024 * 1024 * 1024)).toFixed(2);
    const addMb = (additionalBytes / (1024 * 1024)).toFixed(1);
    const limitGb = (R2_SAFETY_LIMIT_BYTES / (1024 * 1024 * 1024)).toFixed(0);
    return {
      allowed: false,
      message: `🚫 ĐÃ KHÓA AN TOÀN BẢO VỆ THẺ: Tải thêm file này (${addMb} MB) sẽ làm dung lượng đạt ${((usedBytes + additionalBytes) / (1024 * 1024 * 1024)).toFixed(2)} GB, vượt quá ngưỡng an toàn ${limitGb} GB miễn phí của gói Cloudflare R2. Hệ thống đã chặn tự động để bạn KHÔNG BAO GIỜ bị trừ tiền vào thẻ ngân hàng! Vui lòng xóa bớt file cũ.`,
    };
  }
  return { allowed: true };
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

    // Trường hợp 1: JSON body (dành cho Text/Code upload, Docx HTML save, hoặc xin Presigned URL)
    if (contentType.includes('application/json')) {
      const data = await request.json();

            // Nếu client yêu cầu Presigned URL cho client-side direct upload
      if (data.action === 'get_presigned_url') {
        const { fileName, path = '', fileSize = 0, contentType: fileContentType } = data;
        if (!fileName) {
          return NextResponse.json({ error: 'Thiếu fileName' }, { status: 400 });
        }

        const safetyCheck = await verifySafetyLimit(fileSize);
        if (!safetyCheck.allowed) {
          return NextResponse.json({ error: safetyCheck.message }, { status: 403 });
        }

        const key = buildUploadKey(path, fileName);

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
      
      // Upload text/raw content trực tiếp từ JSON (ví dụ Monaco Editor hoặc Docx Editor)
      if (data.content !== undefined && data.path) {
        const cleanPath = data.path.replace(/^\//, '');
        const key = cleanPath.startsWith('uploads/') ? cleanPath : `uploads/${cleanPath}`;
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

        // Trường hợp 2: FormData multipart upload (dành cho file thông thường, file zip)
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const path = (formData.get('path') as string | null) || '';

    if (!file) {
      return NextResponse.json({ error: 'Không tìm thấy file để upload' }, { status: 400 });
    }
    
    const key = buildUploadKey(path, file.name);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Chốt chặn an toàn bảo vệ thẻ
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
      name: file.name,
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
