import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2Client, BUCKET_NAME, isR2Configured, getFileUrl } from '@/lib/cloudflareR2';

export const dynamic = 'force-dynamic';

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
        const { fileName, path = '' } = data;
        if (!fileName) {
          return NextResponse.json({ error: 'Thiếu fileName' }, { status: 400 });
        }

        const cleanPath = path.replace(/^\//, '');
        const key = `uploads/${cleanPath}${fileName}`;

        const putCommand = new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
          ContentType: data.contentType || 'application/octet-stream',
        });

        const presignedUrl = await getSignedUrl(r2Client, putCommand, { expiresIn: 3600 });

        return NextResponse.json({
          presignedUrl,
          key,
          url: getFileUrl(key),
        });
      }

      // Upload text/raw content trực tiếp từ JSON (ví dụ Monaco Editor hoặc Docx Editor)
      if (data.content !== undefined && data.path) {
        const cleanPath = data.path.replace(/^\//, '');
        const key = cleanPath.startsWith('uploads/') ? cleanPath : `uploads/${cleanPath}`;

        const buffer = Buffer.from(data.content, 'utf-8');

        await r2Client.send(
          new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: data.contentType || 'text/plain; charset=utf-8',
          })
        );

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
    let path = (formData.get('path') as string | null) || '';

    if (!file) {
      return NextResponse.json({ error: 'Không tìm thấy file để upload' }, { status: 400 });
    }

    if (path.startsWith('/')) path = path.slice(1);
    const key = `uploads/${path}${file.name}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await r2Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: file.type || 'application/octet-stream',
      })
    );

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
